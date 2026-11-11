# Clip Twins

An Ableton Live Extension that finds MIDI clips with the same content, marks them
as the same (name and/or color), and marks near-copies as numbered versions.

Right-click a MIDI clip, MIDI track or clip slot → **Match MIDI Clips…**

## What it does

1. Reads every MIDI clip in the Set (Session, Arrangement and take lanes).
2. Groups clips that are **strictly identical**: same notes, positions, lengths,
   velocities, probability, mute state and loop length. Clip name, color and
   where the loop sits in the clip don't count. Empty clips are skipped.
3. Groups near-copies as **versions** of the same thing. The slider sets how
   alike two clips must be (default 80%). A 2-bar loop and a 4-bar clip that
   repeats it with a fill count as versions.
4. Shows a preview, then applies your naming and color choices in one undo step.

Options (remembered between runs):

- **Names** — keep the group's most common existing name (falls back to track
  name + letter), always track name + letter, your own prefix + letter, or
  don't rename. Versions get `v2` or `(2)`; the first version can stay untagged.
- **Colors** — one color per group, one color per group with a shade per
  version, or don't recolor. Optionally gray out clips that match nothing.

## Requirements

- Live 12 Suite beta 12.4.5 or later, Developer Mode on (Settings → Extensions)
- Node.js 24.16 or later
- The Extensions SDK download from Ableton's beta program

## Build and run

1. Copy the SDK and CLI `.tgz` files into `vendor/` (see `vendor/README.md`).
2. Create `.env` with the path to Live's extension host, e.g.

       EXTENSION_HOST_PATH=/Applications/Ableton Live 12 Beta.app/Contents/.../ExtensionHost/ExtensionHostNodeModule.node

   (The SDK's project scaffolder finds this path for you; copy it from any scaffolded project.)
3. `npm install`
4. `npm start` to load it into Live, or `npm run package` for an installable `dist/clip-twins.ablx`.

Without Live: `npm test` runs the matching engine and the whole extension against
a simulated Set; `npm run preview` builds `build/interface.html`, which opens in
any browser with sample data.

## Not yet verified in Live

This was written from the public SDK notes and community examples, and tested
against a stand-in for the SDK (`test/fake-sdk.ts`), not the SDK itself. Check
on first run:

- `npm run build` type-checks against the real SDK; a type error there means a
  property name differs from what's assumed in `src/extension.ts`.
- Clip color is written as a `0xRRGGBB` number. Live may snap it to its own
  palette, which could make close shades look the same.
- Errors and the run summary go to Live's `ExtensionHost.txt` log.

## Layout

    src/core/        matching engine, no Live dependency
      fingerprint.ts   strict identity
      similarity.ts    how alike two patterns are
      plan.ts          grouping, names, colors
    src/extension.ts scan the Set, show the dialog, apply
    src/ui/dialog.ts dialog logic (live preview uses the same plan.ts)
    ui/interface.html
    test/
