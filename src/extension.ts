import {
  initialize,
  MidiClip,
  MidiTrack,
  type ActivationContext,
  type ExtensionContext,
} from "@ableton-extensions/sdk";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Built by build.ts: ui/interface.html with the dialog script inlined.
import dialogHtml from "../build/interface.html";
import { identityKey, normalize } from "./core/fingerprint.js";
import { buildPlan } from "./core/plan.js";
import { similarityEdges } from "./core/similarity.js";
import { DEFAULT_OPTIONS, type Options, type Pattern, type PatternInfo, type SimEdge } from "./core/types.js";

type Context = ExtensionContext<"1.0.0">;
// SDK classes are generic over the API version, so pin it once here.
type LiveMidiClip = MidiClip<"1.0.0">;
type LiveMidiTrack = MidiTrack<"1.0.0">;

const COMMAND_ID = "clipTwins.match";
const MENU_TITLE = "Match MIDI Clips…";
const OPTIONS_FILE = "clip-twins-options.json";

/** What the dialog receives. */
export interface DialogData {
  patterns: PatternInfo[];
  edges: SimEdge[];
  options: Options;
  stats: { clips: number; tracks: number; empty: number };
}

/** What the dialog posts back. */
export interface DialogResult {
  action: "apply" | "cancel";
  options: Options;
}

interface ScannedClip {
  clip: LiveMidiClip;
  patternId: number;
}

interface Scan {
  clips: ScannedClip[];
  patterns: Pattern[];
  infos: PatternInfo[];
  tracks: number;
  empty: number;
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand(COMMAND_ID, () => {
    void run(context).catch((err) => {
      console.error("Clip Twins failed:", err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : err);
    });
  });

  // The scan always covers the whole Set, so offer it wherever MIDI lives.
  for (const scope of ["MidiClip", "MidiTrack", "ClipSlot"] as const) {
    void context.ui.registerContextMenuAction(scope, MENU_TITLE, COMMAND_ID);
  }
}

async function run(context: Context) {
  let scan: Scan | undefined;
  let edges: SimEdge[] = [];
  await context.ui.withinProgressDialog("Reading MIDI clips…", {}, async (update) => {
    scan = await scanSet(context, update);
    await update("Comparing clips…", undefined);
    edges = similarityEdges(scan.patterns);
  });
  if (!scan) return;

  const data: DialogData = {
    patterns: scan.infos,
    edges,
    options: loadOptions(context),
    stats: { clips: scan.clips.length, tracks: scan.tracks, empty: scan.empty },
  };
  // Escaping "<" keeps the JSON from ever closing the script tag; the function
  // replacement keeps "$" in clip names from being read as a pattern.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const html = dialogHtml.replace('"__DATA_JSON__"', () => json);
  const raw = await context.ui.showModalDialog(`data:text/html,${encodeURIComponent(html)}`, 760, 620);
  if (!raw) return;
  const result = JSON.parse(raw) as DialogResult;
  if (result.action !== "apply") return;

  const options = { ...DEFAULT_OPTIONS, ...result.options };
  saveOptions(context, options);
  const plan = buildPlan(scan.infos, edges, options);

  let renamed = 0;
  let recolored = 0;
  const clips = scan.clips;
  context.withinTransaction(() => {
    for (const { clip, patternId } of clips) {
      const target = plan.byPattern.get(patternId);
      if (!target) continue;
      if (target.name !== null && clip.name !== target.name) {
        clip.name = target.name;
        renamed++;
      }
      if (target.color !== null) {
        try {
          clip.color = target.color;
          recolored++;
        } catch (err) {
          console.warn("Clip Twins: couldn't set a clip color.", err);
        }
      }
    }
  });
  console.log(
    `Clip Twins: ${plan.families.length} group(s), ${plan.uniques.length} unmatched clip(s); ` +
      `renamed ${renamed}, recolored ${recolored}.`,
  );
}

/** Read every MIDI clip in Session, Arrangement and take lanes and sort them into exact patterns. */
async function scanSet(
  context: Context,
  update: (text: string, progress?: number) => Promise<void>,
): Promise<Scan> {
  const tracks = context.application.song.tracks.filter((t): t is LiveMidiTrack => t instanceof MidiTrack);
  const clips: ScannedClip[] = [];
  const patterns: Pattern[] = [];
  const infos: PatternInfo[] = [];
  const byKey = new Map<string, number>();
  const nameCounts: Map<string, number>[] = [];
  let empty = 0;

  const add = (clip: LiveMidiClip, trackName: string) => {
    const { notes, length } = normalize(clip.notes, clip);
    if (notes.length === 0) {
      empty++; // every empty clip would "match" every other one — not useful
      return;
    }
    const key = identityKey(notes, length);
    let id = byKey.get(key);
    if (id === undefined) {
      id = patterns.length;
      byKey.set(key, id);
      patterns.push({ id, key, length, notes });
      infos.push({ id, count: 0, order: id, noteCount: notes.length, length, names: [], track: trackName, tracks: [] });
      nameCounts.push(new Map());
    }
    const info = infos[id]!;
    info.count++;
    if (!info.tracks.includes(trackName) && info.tracks.length < 4) info.tracks.push(trackName);
    const names = nameCounts[id]!;
    names.set(clip.name, (names.get(clip.name) ?? 0) + 1);
    clips.push({ clip, patternId: id });
  };

  for (const [index, track] of tracks.entries()) {
    await update(`Reading "${track.name}"…`, Math.round((index / tracks.length) * 100));
    for (const slot of track.clipSlots) {
      if (slot.clip instanceof MidiClip) add(slot.clip, track.name);
    }
    const arranged = track.arrangementClips.filter((c): c is LiveMidiClip => c instanceof MidiClip);
    arranged.sort((a, b) => a.startTime - b.startTime);
    for (const clip of arranged) add(clip, track.name);
    for (const lane of track.takeLanes) {
      const takes = lane.clips.filter((c): c is LiveMidiClip => c instanceof MidiClip);
      takes.sort((a, b) => a.startTime - b.startTime);
      for (const clip of takes) add(clip, track.name);
    }
  }

  infos.forEach((info, id) => {
    info.names = [...nameCounts[id]!.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  });
  return { clips, patterns, infos, tracks: tracks.length, empty };
}

function optionsPath(context: Context): string {
  const dir = context.environment.storageDirectory || context.environment.tempDirectory || os.tmpdir();
  return path.join(dir, OPTIONS_FILE);
}

function loadOptions(context: Context): Options {
  try {
    const file = optionsPath(context);
    if (fs.existsSync(file)) return { ...DEFAULT_OPTIONS, ...(JSON.parse(fs.readFileSync(file, "utf8")) as Options) };
  } catch (err) {
    console.warn("Clip Twins: couldn't read saved options.", err);
  }
  return { ...DEFAULT_OPTIONS };
}

function saveOptions(context: Context, options: Options) {
  try {
    const file = optionsPath(context);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(options), "utf8");
  } catch (err) {
    console.warn("Clip Twins: couldn't save options.", err);
  }
}
