import type { ClipWindow, Note } from "./types.js";

const EPS = 1e-6;
/** Times are compared at 1/10000 beat so float noise never splits a group. */
const q = (x: number) => Math.round(x * 10000);
const opt = (x: number | undefined) => (x === undefined ? "" : String(Math.round(x * 1000)));

/**
 * Cut a clip down to the region that actually plays (the loop if looping,
 * otherwise start marker to end marker) and shift it to start at beat 0.
 */
export function normalize(notes: readonly Note[], win: ClipWindow): { notes: Note[]; length: number } {
  let start = win.looping ? win.loopStart : win.startMarker;
  let end = win.looping ? win.loopEnd : win.endMarker;
  if (!(end > start)) {
    // Markers we can't make sense of: fall back to everything in the clip.
    start = Math.min(0, ...notes.map((n) => n.startTime));
    end = Math.max(start, ...notes.map((n) => n.startTime + n.duration));
  }
  const out = notes
    .filter((n) => n.startTime >= start - EPS && n.startTime < end - EPS)
    .map((n) => ({ ...n, startTime: n.startTime - start }))
    .sort(
      (a, b) =>
        a.startTime - b.startTime ||
        a.pitch - b.pitch ||
        a.duration - b.duration ||
        (a.velocity ?? 0) - (b.velocity ?? 0),
    );
  return { notes: out, length: end - start };
}

/**
 * Strict identity: region length plus every note's pitch, position, length,
 * velocity, release velocity, probability, velocity deviation and mute state.
 * Clip name, color and note selection are ignored.
 */
export function identityKey(notes: readonly Note[], length: number): string {
  const parts = notes.map((n) =>
    [
      n.pitch,
      q(n.startTime),
      q(n.duration),
      opt(n.velocity),
      opt(n.releaseVelocity),
      opt(n.probability),
      opt(n.velocityDeviation),
      n.muted ? 1 : 0,
    ].join(","),
  );
  return `${q(length)}|${parts.join(";")}`;
}
