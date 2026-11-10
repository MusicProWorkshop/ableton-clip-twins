import type { Note, Pattern, SimEdge } from "./types.js";
import { MIN_SIMILARITY } from "./types.js";

/** Two notes of the same pitch count as "the same note" within this many beats (just over a 1/32 note). */
const START_TOLERANCE = 0.126;
const MAX_TILES = 16;

type ByPitch = Map<number, Note[]>;

function byPitch(notes: readonly Note[]): ByPitch {
  const map: ByPitch = new Map();
  for (const n of notes) {
    if (n.muted) continue; // a muted note doesn't sound, so it doesn't shape the pattern
    let list = map.get(n.pitch);
    if (!list) map.set(n.pitch, (list = []));
    list.push(n);
  }
  for (const list of map.values()) list.sort((a, b) => a.startTime - b.startTime);
  return map;
}

function tile(notes: readonly Note[], length: number, times: number): Note[] {
  const out: Note[] = [];
  for (let i = 0; i < times; i++) {
    for (const n of notes) out.push({ ...n, startTime: n.startTime + i * length });
  }
  return out;
}

function count(map: ByPitch): number {
  let total = 0;
  for (const list of map.values()) total += list.length;
  return total;
}

/**
 * How alike two patterns are, 0..1.
 *
 * Notes are paired up when they share a pitch and start within a 1/32 note of
 * each other. Each pair scores 1, minus a little for timing, length and
 * velocity differences; notes without a partner score nothing. The total is
 * divided by the number of distinct notes across both patterns.
 *
 * A 2-bar pattern is compared with a 4-bar one by repeating the short one, so
 * "the same loop with a fill in bar 4" still reads as a close match.
 */
export function similarity(a: Pattern, b: Pattern): number {
  let notesA: readonly Note[] = a.notes;
  let notesB: readonly Note[] = b.notes;
  let lengthFactor = 1;

  if (Math.abs(a.length - b.length) > 1e-3) {
    const aShort = a.length < b.length;
    const short = aShort ? a : b;
    const long = aShort ? b : a;
    const ratio = short.length > 0 ? long.length / short.length : 0;
    const whole = Math.round(ratio);
    if (whole >= 2 && whole <= MAX_TILES && Math.abs(ratio - whole) < 1e-3) {
      const tiled = tile(short.notes, short.length, whole);
      if (aShort) notesA = tiled;
      else notesB = tiled;
    } else {
      lengthFactor = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    }
  }

  const mapA = byPitch(notesA);
  const mapB = byPitch(notesB);
  const totalA = count(mapA);
  const totalB = count(mapB);
  if (totalA === 0 || totalB === 0) return totalA === totalB ? lengthFactor : 0;

  let matched = 0;
  let score = 0;
  for (const [pitch, listA] of mapA) {
    const listB = mapB.get(pitch);
    if (!listB) continue;
    let i = 0;
    let j = 0;
    while (i < listA.length && j < listB.length) {
      const na = listA[i]!;
      const nb = listB[j]!;
      const offset = Math.abs(na.startTime - nb.startTime);
      if (offset <= START_TOLERANCE) {
        const longer = Math.max(na.duration, nb.duration);
        const lengthDiff = longer > 0 ? Math.abs(na.duration - nb.duration) / longer : 0;
        const velocityDiff = Math.abs((na.velocity ?? 100) - (nb.velocity ?? 100)) / 127;
        score += 1 - 0.1 * (offset / START_TOLERANCE) - 0.25 * lengthDiff - 0.15 * velocityDiff;
        matched++;
        i++;
        j++;
      } else if (na.startTime < nb.startTime) i++;
      else j++;
    }
  }
  return (lengthFactor * score) / (totalA + totalB - matched);
}

/** Every pair of patterns that is at least loosely alike. */
export function similarityEdges(patterns: readonly Pattern[]): SimEdge[] {
  const edges: SimEdge[] = [];
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const s = similarity(patterns[i]!, patterns[j]!);
      if (s >= MIN_SIMILARITY) edges.push([patterns[i]!.id, patterns[j]!.id, Math.round(s * 1000) / 1000]);
    }
  }
  return edges;
}
