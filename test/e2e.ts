// Runs the real, bundled extension against a fake Live Set and "clicks" Apply.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { buildExtension, buildUi } from "../build.js";
import { ClipSlot, TakeLane, MidiClip, MidiTrack, AudioTrack, AudioClip, type ExtensionContext, type NoteDescription } from "./fake-sdk.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clip-twins-"));
await buildUi();
const fake = path.resolve("test/fake-sdk.ts");
const out = path.join(tmp, "extension.cjs");
await buildExtension(out, { "@ableton-extensions/sdk": fake });

const note = (pitch: number, startTime: number, velocity = 100): NoteDescription => ({ pitch, startTime, duration: 0.5, velocity });
const riff = [note(36, 0), note(36, 1), note(43, 2), note(41, 3)];
const clip = (notes: NoteDescription[], name = "", at = 0) => {
  const c = new MidiClip();
  c.notes = notes; c.name = name; c.startTime = at; c.endTime = at + 4;
  return c;
};
const slot = (c: MidiClip | AudioClip | null) => Object.assign(new ClipSlot(), { clip: c });

const bass = new MidiTrack("Bass");
const same1 = clip(riff, "Groove"), same2 = clip(riff), same3 = clip(riff, "Groove", 8);
const softer = clip(riff.map((n) => ({ ...n, velocity: 70 })), "", 4);
const lonely = clip([note(60, 0), note(64, 2)]);
const empty = clip([]);
bass.clipSlots = [slot(same1), slot(null), slot(same2), slot(lonely), slot(empty)];
bass.arrangementClips = [same3, softer];
const take = clip(riff, "Take 2");
bass.takeLanes = [Object.assign(new TakeLane(), { clips: [take] })];
const keys = new MidiTrack("Keys");
const chordsA = clip([note(60, 0), note(64, 0), note(67, 0)]), chordsB = clip([note(60, 0), note(64, 0), note(67, 0)]);
keys.clipSlots = [slot(chordsA), slot(chordsB)];
const audio = new AudioTrack("Vox");
audio.clipSlots = [slot(new AudioClip())];

let command: ((...args: unknown[]) => void) | undefined;
const scopes: string[] = [];
let transactions = 0;
let dialogData: any;
let done!: () => void;
const finished = new Promise<void>((resolve) => (done = resolve));

const context: ExtensionContext = {
  application: { song: { tracks: [bass, audio, keys] } },
  commands: { registerCommand: (_id, cb) => void (command = cb) },
  ui: {
    registerContextMenuAction: async (scope) => { scopes.push(scope); return async () => {}; },
    withinProgressDialog: async (_text, _options, body) => body(async () => {}, new AbortController().signal),
    showModalDialog: async (url) => {
      const html = decodeURIComponent(url.slice("data:text/html,".length));
      const match = /window\.__DATA__ = (.*?);<\/script>/s.exec(html);
      assert.ok(match, "dialog received its data");
      dialogData = JSON.parse(match[1]!);
      assert.ok(!html.includes("__DIALOG_JS__"), "dialog script was inlined");
      setTimeout(done, 20);
      return JSON.stringify({ action: "apply", options: { ...dialogData.options, colorMode: "shaded" } });
    },
  },
  environment: { storageDirectory: tmp, tempDirectory: tmp, language: "EN" },
  withinTransaction: (fn) => { transactions++; return fn(); },
};

createRequire(import.meta.url)(out).activate({ hostApiVersion: "1.0.0", fake: context });
assert.deepEqual(scopes.sort(), ["ClipSlot", "MidiClip", "MidiTrack"]);
command!();
await finished;

assert.deepEqual(dialogData.stats, { clips: 8, tracks: 2, empty: 1 });
assert.equal(dialogData.patterns.length, 4);
assert.deepEqual([same1.name, same2.name, same3.name], ["Groove v1", "Groove v1", "Groove v1"]);
assert.equal(softer.name, "Groove v2");
assert.deepEqual([take.name, take.color], ["Groove v1", same1.color], "take lane clips are matched too");
assert.ok(same1.color === same2.color && same1.color === same3.color && same1.color !== 0);
assert.notEqual(softer.color, same1.color);
assert.deepEqual([chordsA.name, chordsB.name], ["Keys A", "Keys A"]);
assert.deepEqual([lonely.name, lonely.color, empty.name, empty.color], ["", 0, "", 0], "unmatched and empty clips untouched");
assert.equal(transactions, 1, "one undo step");
assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, "clip-twins-options.json"), "utf8")).colorMode, "shaded", "options remembered");

console.log("end-to-end test passed");
