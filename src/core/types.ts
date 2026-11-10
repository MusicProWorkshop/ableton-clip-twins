/** A MIDI note as the SDK hands it over (times in beats). */
export interface Note {
  pitch: number;
  startTime: number;
  duration: number;
  velocity?: number;
  releaseVelocity?: number;
  probability?: number;
  velocityDeviation?: number;
  muted?: boolean;
}

/** The loop / marker settings that decide which part of a clip actually plays. */
export interface ClipWindow {
  looping: boolean;
  loopStart: number;
  loopEnd: number;
  startMarker: number;
  endMarker: number;
}

/** One distinct note pattern. Every clip with strictly identical content shares one. */
export interface Pattern {
  id: number;
  key: string;
  /** Length of the playing region in beats. */
  length: number;
  /** All notes in the playing region, shifted so the region starts at 0. */
  notes: Note[];
}

/** What the dialog and the planner need to know about a pattern (no note data). */
export interface PatternInfo {
  id: number;
  /** How many clips carry this exact pattern. */
  count: number;
  /** Rank of its first appearance in the Set (track order, then position). */
  order: number;
  noteCount: number;
  length: number;
  /** Existing clip names with how often each occurs, most common first. */
  names: [string, number][];
  /** Track of the first appearance. */
  track: string;
  /** Distinct track names it appears on (first few). */
  tracks: string[];
}

/** [patternIdA, patternIdB, similarity 0..1] — only pairs worth considering. */
export type SimEdge = [number, number, number];

export type NameMode = "keep" | "smart" | "track" | "custom";
export type SuffixStyle = "v" | "paren";
export type ColorMode = "keep" | "family" | "shaded";

export interface Options {
  /** Minimum similarity (0.5–0.99) for two patterns to count as versions. */
  threshold: number;
  nameMode: NameMode;
  /** Used by nameMode "custom": "Pattern" -> "Pattern A", "Pattern B"… */
  prefix: string;
  suffixStyle: SuffixStyle;
  /** Tag the first version too ("Bass v1") or leave it bare ("Bass"). */
  tagFirst: boolean;
  colorMode: ColorMode;
  /** Gray out clips that match nothing else. */
  dimUnique: boolean;
}

export const DEFAULT_OPTIONS: Options = {
  threshold: 0.8,
  nameMode: "smart",
  prefix: "Pattern",
  suffixStyle: "v",
  tagFirst: true,
  colorMode: "family",
  dimUnique: false,
};

/** Lowest similarity ever sent to the dialog; also the slider's loose end. */
export const MIN_SIMILARITY = 0.5;
