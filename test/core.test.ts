import assert from "node:assert/strict";
import { identityKey, normalize } from "../src/core/fingerprint.js";
import { buildPlan, letter, stripVersion } from "../src/core/plan.js";
import { similarity, similarityEdges } from "../src/core/similarity.js";
import { DEFAULT_OPTIONS, type ClipWindow, type Note, type Pattern, type PatternInfo } from "../src/core/types.js";

const win = (length: number, offset = 0): ClipWindow => ({
  looping: true, loopStart: offset, loopEnd: offset + length, startMarker: offset, endMarker: offset + length,
});
const n = (pitch: number, startTime: number, duration = 0.5, velocity = 100): Note => ({ pitch, startTime, duration, velocity });
let nextId = 0;
const pattern = (notes: Note[], length = 4, offset = 0): Pattern => {
  const norm = normalize(notes, win(length, offset));
  return { id: nextId++, key: identityKey(norm.notes, norm.length), length: norm.length, notes: norm.notes };
};
const riff = [n(36, 0), n(36, 1), n(43, 2), n(41, 3), n(36, 3.5)];

// Identity
assert.equal(pattern(riff).key, pattern([...riff].reverse()).key, "note order doesn't matter");
assert.equal(pattern(riff).key, pattern(riff.map((x) => ({ ...x, startTime: x.startTime + 8 })), 4, 8).key, "loop position doesn't matter");
assert.notEqual(pattern(riff).key, pattern(riff.map((x, i) => (i ? x : { ...x, velocity: 90 }))).key, "velocity matters");
assert.notEqual(pattern(riff).key, pattern(riff, 8).key, "loop length matters");
assert.notEqual(pattern(riff).key, pattern(riff.map((x, i) => (i ? x : { ...x, probability: 0.5 }))).key, "probability matters");
assert.notEqual(pattern(riff).key, pattern(riff.map((x, i) => (i ? x : { ...x, muted: true }))).key, "mute matters");
assert.equal(normalize([n(60, 0), n(60, 5)], win(4)).notes.length, 1, "notes outside the loop are ignored");

// Similarity
const base = pattern(riff);
assert.equal(similarity(base, pattern(riff)), 1);
const velocityOnly = similarity(base, pattern(riff.map((x) => ({ ...x, velocity: 80 }))));
assert.ok(velocityOnly > 0.95 && velocityOnly < 1, `velocity-only change ${velocityOnly}`);
const oneExtra = similarity(base, pattern([...riff, n(48, 2.5)]));
assert.ok(oneExtra > 0.8 && oneExtra < 0.9, `one extra note ${oneExtra}`);
const unrelated = similarity(base, pattern([n(72, 0.25), n(74, 1.25), n(76, 2.25)]));
assert.equal(unrelated, 0);
const doubled = pattern([...riff, ...riff.map((x) => ({ ...x, startTime: x.startTime + 4 }))], 8);
assert.equal(similarity(base, doubled), 1, "a loop repeated twice is fully alike");
const withFill = pattern([...riff, ...riff.map((x) => ({ ...x, startTime: x.startTime + 4 })), n(38, 7.75)], 8);
assert.ok(similarity(base, withFill) > 0.9, "repeat with a fill is a close version");
assert.ok(similarity(base, pattern(riff.map((x) => ({ ...x, pitch: x.pitch + 12 })))) === 0, "transposed is not a version");

// Planning
const info = (id: number, count: number, track: string, names: [string, number][] = []): PatternInfo => ({
  id, count, order: id, noteCount: 5, length: 4, names, track, tracks: [track],
});
const infos = [
  info(0, 1, "Bass"), info(1, 4, "Bass", [["Groove", 3], ["", 1]]), info(2, 1, "Bass"),
  info(3, 2, "Keys"), info(4, 1, "Keys"), info(5, 1, "Lead"),
];
const edges: [number, number, number][] = [[0, 1, 0.9], [1, 2, 0.7], [0, 2, 0.95], [3, 4, 0.6]];
let plan = buildPlan(infos, edges, DEFAULT_OPTIONS);
assert.equal(plan.families.length, 2);
assert.deepEqual(plan.families[0]!.versions.map((v) => v.name), ["Groove v1", "Groove v2"]);
assert.equal(plan.families[0]!.versions[0]!.pattern.id, 0, "versions are numbered in order of appearance");
assert.deepEqual(plan.families[1]!.versions.map((v) => v.name), ["Keys A"], "unnamed group falls back to track + letter, no tag when alone");
assert.equal(plan.uniques.length, 3, "pattern 2 is only close to a non-anchor, so it stays out");
assert.equal(plan.byPattern.get(5)!.name, null);
assert.equal(plan.families[0]!.versions[0]!.color, plan.families[0]!.versions[1]!.color);
assert.notEqual(plan.families[0]!.versions[0]!.color, plan.families[1]!.versions[0]!.color);

plan = buildPlan(infos, edges, { ...DEFAULT_OPTIONS, threshold: 0.6, tagFirst: false, suffixStyle: "paren", colorMode: "shaded", dimUnique: true });
assert.deepEqual(plan.families.map((f) => f.versions.map((v) => v.name)), [["Groove", "Groove (2)", "Groove (3)"], ["Keys A", "Keys A (2)"]]);
assert.equal(new Set(plan.families[0]!.versions.map((v) => v.color)).size, 3, "shaded: one shade per version");
assert.equal(plan.byPattern.get(5)!.color, 0x7b7b7b);

plan = buildPlan(infos, edges, { ...DEFAULT_OPTIONS, nameMode: "keep", colorMode: "keep" });
assert.ok([...plan.byPattern.values()].every((v) => v.name === null && v.color === null));
plan = buildPlan(infos, edges, { ...DEFAULT_OPTIONS, nameMode: "custom", prefix: "Idea" });
assert.deepEqual(plan.families.map((f) => f.label), ["Idea A", "Idea B"]);

// Two groups with the same existing name must not end up indistinguishable.
plan = buildPlan([info(0, 2, "A", [["Loop", 2]]), info(1, 2, "B", [["Loop", 2]])], [], DEFAULT_OPTIONS);
assert.deepEqual(plan.families.map((f) => f.label), ["Loop", "Loop B"]);

assert.equal(stripVersion("Groove v12"), "Groove");
assert.equal(stripVersion("Groove (3)"), "Groove");
assert.equal(stripVersion("Nov 5"), "Nov 5");
assert.deepEqual([0, 25, 26, 27].map(letter), ["A", "Z", "AA", "AB"]);
assert.equal(similarityEdges([base, pattern(riff.map((x) => ({ ...x, velocity: 80 }))), pattern([n(90, 0)])]).length, 1);

console.log("core tests passed");
