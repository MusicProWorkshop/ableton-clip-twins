// A tiny in-memory stand-in for @ableton-extensions/sdk, covering only what
// this extension touches. It lets `npm test` run the real extension code
// without Live. It is NOT the SDK and proves nothing about the real host.
export interface NoteDescription {
  pitch: number; startTime: number; duration: number;
  velocity?: number; releaseVelocity?: number; probability?: number;
  velocityDeviation?: number; muted?: boolean; selected?: boolean;
}
class DataModelObject_ {}
class Clip_ extends DataModelObject_ {
  name = ""; color = 0; looping = true;
  loopStart = 0; loopEnd = 4; startMarker = 0; endMarker = 4;
  startTime = 0; endTime = 4; duration = 4;
}
class MidiClip_ extends Clip_ { notes: NoteDescription[] = []; }
class AudioClip_ extends Clip_ {}
class ClipSlot_ extends DataModelObject_ { clip: Clip_ | null = null; }
class Track_ extends DataModelObject_ {
  clipSlots: ClipSlot[] = []; arrangementClips: Clip_[] = [];
  constructor(public name: string) { super(); }
}
class MidiTrack_ extends Track_ {}
class AudioTrack_ extends Track_ {}

// The tests load this file twice (once inside the bundled extension, once
// directly), so share one set of classes or `instanceof` would never match.
const local = { DataModelObject: DataModelObject_, Clip: Clip_, MidiClip: MidiClip_, AudioClip: AudioClip_, ClipSlot: ClipSlot_, Track: Track_, MidiTrack: MidiTrack_, AudioTrack: AudioTrack_ };
const shared: typeof local = ((globalThis as { __fakeSdk?: typeof local }).__fakeSdk ??= local);
export const DataModelObject = shared.DataModelObject;
export type DataModelObject = DataModelObject_;
export const Clip = shared.Clip;
export type Clip = Clip_;
export const MidiClip = shared.MidiClip;
export type MidiClip = MidiClip_;
export const AudioClip = shared.AudioClip;
export type AudioClip = AudioClip_;
export const ClipSlot = shared.ClipSlot;
export type ClipSlot = ClipSlot_;
export const Track = shared.Track;
export type Track = Track_;
export const MidiTrack = shared.MidiTrack;
export type MidiTrack = MidiTrack_;
export const AudioTrack = shared.AudioTrack;
export type AudioTrack = AudioTrack_;

export interface ExtensionContext<_V = "1.0.0"> {
  application: { song: { tracks: Track_[] } };
  commands: { registerCommand(id: string, cb: (...args: unknown[]) => void): void };
  ui: {
    registerContextMenuAction(scope: string, title: string, commandId: string): Promise<() => Promise<void>>;
    showModalDialog(url: string, width: number, height: number): Promise<string>;
    withinProgressDialog(
      text: string, options: { progress?: number },
      body: (update: (text: string, progress?: number) => Promise<void>, signal: AbortSignal) => Promise<unknown>,
    ): Promise<unknown>;
  };
  environment: { storageDirectory: string; tempDirectory: string; language: string };
  withinTransaction<T>(fn: () => T): T;
}
export interface ActivationContext { hostApiVersion: string; fake: ExtensionContext; }
export function initialize(activation: ActivationContext, _version: "1.0.0"): ExtensionContext {
  return activation.fake;
}
