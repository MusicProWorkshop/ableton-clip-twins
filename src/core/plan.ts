import type { Options, PatternInfo, SimEdge } from "./types.js";

export interface VersionPlan {
  pattern: PatternInfo;
  /** 1-based version number inside the family. */
  version: number;
  /** New clip name, or null to leave names alone. */
  name: string | null;
  /** New clip color as 0xRRGGBB, or null to leave colors alone. */
  color: number | null;
  /** Similarity to the family's most-used version (1 for that version itself). */
  similarity: number;
}

export interface FamilyPlan {
  /** Name shared by the family (the existing one when names are left alone). */
  label: string;
  clipCount: number;
  versions: VersionPlan[];
}

export interface Plan {
  /** Groups of two or more clips: identical clips, plus their versions. */
  families: FamilyPlan[];
  /** Clips that match nothing else. */
  uniques: VersionPlan[];
  byPattern: Map<number, VersionPlan>;
}

const UNIQUE_GRAY = 0x7b7b7b;

/** 0 -> A, 25 -> Z, 26 -> AA … */
export function letter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Drop a version tag this extension added earlier, so re-running is stable. */
export function stripVersion(name: string): string {
  return name
    .replace(/\s+v\d+$/i, "")
    .replace(/\s+\(\d+\)$/, "")
    .trim();
}

function hslToRgb(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

interface Cluster {
  anchor: PatternInfo;
  members: { pattern: PatternInfo; similarity: number }[];
}

/**
 * Group patterns into families. The most-used pattern anchors a family and
 * others join the anchor they resemble most, if they clear the threshold.
 * Comparing against the anchor (not against any member) stops a chain of small
 * changes from dragging unrelated clips into one family.
 */
function cluster(patterns: readonly PatternInfo[], edges: readonly SimEdge[], threshold: number): Cluster[] {
  const sims = new Map<string, number>();
  for (const [a, b, s] of edges) sims.set(a < b ? `${a}:${b}` : `${b}:${a}`, s);
  const sim = (a: number, b: number) => sims.get(a < b ? `${a}:${b}` : `${b}:${a}`) ?? 0;

  const clusters: Cluster[] = [];
  const byUse = [...patterns].sort((a, b) => b.count - a.count || a.order - b.order);
  for (const pattern of byUse) {
    let best: Cluster | null = null;
    let bestSim = 0;
    for (const c of clusters) {
      const s = sim(pattern.id, c.anchor.id);
      if (s >= threshold && s > bestSim) {
        best = c;
        bestSim = s;
      }
    }
    if (best) best.members.push({ pattern, similarity: bestSim });
    else clusters.push({ anchor: pattern, members: [{ pattern, similarity: 1 }] });
  }
  for (const c of clusters) c.members.sort((a, b) => a.pattern.order - b.pattern.order);
  clusters.sort((a, b) => a.members[0]!.pattern.order - b.members[0]!.pattern.order);
  return clusters;
}

function existingName(c: Cluster): string {
  const counts = new Map<string, number>();
  for (const { pattern } of c.members) {
    for (const [raw, n] of pattern.names) {
      const name = stripVersion(raw);
      if (name) counts.set(name, (counts.get(name) ?? 0) + n);
    }
  }
  let best = "";
  let bestCount = 0;
  for (const [name, n] of counts) {
    if (n > bestCount) {
      best = name;
      bestCount = n;
    }
  }
  return best;
}

/** Turn scan results plus the chosen options into a name and color per pattern. */
export function buildPlan(patterns: readonly PatternInfo[], edges: readonly SimEdge[], options: Options): Plan {
  const clusters = cluster(patterns, edges, options.threshold);
  const families: FamilyPlan[] = [];
  const uniques: VersionPlan[] = [];
  const byPattern = new Map<number, VersionPlan>();

  const groups = clusters.filter((c) => c.members.reduce((n, m) => n + m.pattern.count, 0) >= 2);
  const loners = clusters.filter((c) => !groups.includes(c));

  // Base names, unique across families.
  const taken = new Set<string>();
  const perTrack = new Map<string, number>();
  let customIndex = 0;
  const claim = (base: string): string => {
    let name = base;
    for (let i = 0; taken.has(name.toLowerCase()); i++) name = `${base} ${letter(i + 1)}`;
    taken.add(name.toLowerCase());
    return name;
  };
  const trackName = (c: Cluster): string => {
    const track = c.members[0]!.pattern.track || "Clip";
    for (;;) {
      const i = perTrack.get(track) ?? 0;
      perTrack.set(track, i + 1);
      const name = `${track} ${letter(i)}`;
      if (!taken.has(name.toLowerCase())) return name;
    }
  };

  groups.forEach((c, index) => {
    const existing = existingName(c);
    let base: string | null = null;
    if (options.nameMode === "smart") base = claim(existing || trackName(c));
    else if (options.nameMode === "track") base = claim(trackName(c));
    else if (options.nameMode === "custom") base = claim(`${options.prefix.trim() || "Pattern"} ${letter(customIndex++)}`);

    const hue = (index * 137.508 + 20) % 360;
    const total = c.members.length;
    const versions = c.members.map(({ pattern, similarity }, i): VersionPlan => {
      const version = i + 1;
      let name: string | null = null;
      if (base !== null) {
        if (total === 1 || (version === 1 && !options.tagFirst)) name = base;
        else name = options.suffixStyle === "v" ? `${base} v${version}` : `${base} (${version})`;
      }
      let color: number | null = null;
      if (options.colorMode === "family") color = hslToRgb(hue, 0.62, 0.6);
      else if (options.colorMode === "shaded") {
        const step = total > 1 ? Math.min(0.11, 0.36 / (total - 1)) : 0;
        color = hslToRgb(hue, 0.62, 0.7 - i * step);
      }
      return { pattern, version, name, color, similarity };
    });
    for (const v of versions) byPattern.set(v.pattern.id, v);
    families.push({
      label: base ?? (existing || "(unnamed)"),
      clipCount: versions.reduce((n, v) => n + v.pattern.count, 0),
      versions,
    });
  });

  for (const c of loners) {
    const v: VersionPlan = {
      pattern: c.anchor,
      version: 1,
      name: null,
      color: options.dimUnique ? UNIQUE_GRAY : null,
      similarity: 1,
    };
    uniques.push(v);
    byPattern.set(v.pattern.id, v);
  }

  return { families, uniques, byPattern };
}
