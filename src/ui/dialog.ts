import { buildPlan, type VersionPlan } from "../core/plan.js";
import { DEFAULT_OPTIONS, MIN_SIMILARITY, type Options, type PatternInfo, type SimEdge } from "../core/types.js";

interface DialogData {
  patterns: PatternInfo[];
  edges: SimEdge[];
  options: Options;
  stats: { clips: number; tracks: number; empty: number };
}

declare global {
  interface Window {
    __DATA__: DialogData | string;
    webkit?: { messageHandlers?: { live?: { postMessage(message: unknown): void } } };
    chrome?: { webview?: { postMessage(message: unknown): void } };
  }
}

/** Shown when the page is opened in a normal browser (npm run preview). */
function demoData(): DialogData {
  const p = (id: number, count: number, track: string, name: string, noteCount: number, length = 16): PatternInfo => ({
    id, count, order: id, noteCount, length, names: [[name, count]], track, tracks: [track],
  });
  return {
    patterns: [
      p(0, 8, "Bass", "Bass main", 16), p(1, 2, "Bass", "", 17), p(2, 1, "Bass", "", 15),
      p(3, 6, "Keys", "Chords", 24, 32), p(4, 3, "Keys", "Chords", 24, 32),
      p(5, 4, "Drums", "", 48), p(6, 1, "Lead", "Solo", 61, 64), p(7, 1, "Lead", "", 12),
    ],
    edges: [[0, 1, 0.94], [0, 2, 0.83], [1, 2, 0.78], [3, 4, 0.97], [6, 7, 0.55]],
    options: { ...DEFAULT_OPTIONS },
    stats: { clips: 26, tracks: 4, empty: 2 },
  };
}

const data: DialogData = typeof window.__DATA__ === "string" ? demoData() : window.__DATA__;
const options: Options = { ...DEFAULT_OPTIONS, ...data.options };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const threshold = $<HTMLInputElement>("threshold");
const thresholdLabel = $("thresholdLabel");
const nameMode = $<HTMLSelectElement>("nameMode");
const prefix = $<HTMLInputElement>("prefix");
const suffixStyle = $<HTMLSelectElement>("suffixStyle");
const tagFirst = $<HTMLInputElement>("tagFirst");
const colorMode = $<HTMLSelectElement>("colorMode");
const dimUnique = $<HTMLInputElement>("dimUnique");
const preview = $("preview");
const summary = $("summary");
const applyButton = $<HTMLButtonElement>("apply");

function send(result: unknown) {
  const message = { method: "close_and_send", params: [JSON.stringify(result)] };
  const mac = window.webkit?.messageHandlers?.live;
  const win = window.chrome?.webview;
  if (mac) mac.postMessage(message);
  else if (win) win.postMessage(message);
  else console.log("Would send to Live:", result);
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const beats = (n: number) => `${Math.round(n * 100) / 100} beats`;

function swatch(color: number | null): HTMLElement {
  const node = el("span", color === null ? "swatch none" : "swatch");
  if (color !== null) node.style.background = css(color);
  return node;
}

function versionRow(v: VersionPlan, showVersion: boolean): HTMLElement {
  const row = el("div", "version");
  row.append(swatch(v.color));
  const current = v.pattern.names.map(([n]) => n || "(unnamed)").join(", ");
  row.append(el("span", "vname", v.name ?? current));
  const facts = [`×${v.pattern.count}`];
  if (showVersion && v.similarity < 1) facts.push(`${Math.round(v.similarity * 100)}% alike`);
  facts.push(plural(v.pattern.noteCount, "note"), beats(v.pattern.length), v.pattern.tracks.join(", "));
  row.append(el("span", "facts", facts.join(" · ")));
  return row;
}

function render() {
  const plan = buildPlan(data.patterns, data.edges, options);
  preview.replaceChildren();

  for (const family of plan.families) {
    const box = el("div", "family");
    const head = el("div", "head");
    head.append(el("span", "label", family.label));
    const versions = family.versions.length;
    head.append(
      el("span", "facts", `${plural(family.clipCount, "clip")}${versions > 1 ? ` · ${versions} versions` : " · identical"}`),
    );
    box.append(head);
    for (const v of family.versions) box.append(versionRow(v, versions > 1));
    preview.append(box);
  }
  if (plan.families.length === 0) {
    preview.append(el("div", "empty", "No two MIDI clips in this Set match. Try loosening the version slider."));
  }
  if (plan.uniques.length > 0) {
    const box = el("div", "family");
    const head = el("div", "head");
    head.append(el("span", "label muted", "No match"));
    head.append(el("span", "facts", `${plural(plan.uniques.length, "clip")} — ${options.dimUnique ? "grayed out" : "left as is"}`));
    box.append(head);
    preview.append(box);
  }

  const withVersions = plan.families.filter((f) => f.versions.length > 1).length;
  const parts = [
    plural(data.stats.clips, "MIDI clip"),
    plural(plan.families.length, "group"),
    `${withVersions} with versions`,
  ];
  if (data.stats.empty > 0) parts.push(`${plural(data.stats.empty, "empty clip")} skipped`);
  summary.textContent = parts.join(" · ");

  const pct = Math.round(options.threshold * 100);
  thresholdLabel.textContent = `${pct}% alike or more`;
  prefix.hidden = options.nameMode !== "custom";
  const naming = options.nameMode !== "keep";
  suffixStyle.disabled = !naming;
  tagFirst.disabled = !naming;
  applyButton.disabled = !naming && options.colorMode === "keep" && !options.dimUnique;
}

function read() {
  options.threshold = Number(threshold.value) / 100;
  options.nameMode = nameMode.value as Options["nameMode"];
  options.prefix = prefix.value;
  options.suffixStyle = suffixStyle.value as Options["suffixStyle"];
  options.tagFirst = tagFirst.checked;
  options.colorMode = colorMode.value as Options["colorMode"];
  options.dimUnique = dimUnique.checked;
  render();
}

threshold.min = String(MIN_SIMILARITY * 100);
threshold.value = String(Math.round(options.threshold * 100));
nameMode.value = options.nameMode;
prefix.value = options.prefix;
suffixStyle.value = options.suffixStyle;
tagFirst.checked = options.tagFirst;
colorMode.value = options.colorMode;
dimUnique.checked = options.dimUnique;

for (const control of [threshold, nameMode, prefix, suffixStyle, tagFirst, colorMode, dimUnique]) {
  control.addEventListener("input", read);
}
applyButton.addEventListener("click", () => send({ action: "apply", options }));
$("cancel").addEventListener("click", () => send({ action: "cancel", options }));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") send({ action: "cancel", options });
});

render();
