# Clip Twins

An Ableton Live Extension that finds MIDI clips with the same content, marks them
as the same (name and/or color), and marks near-copies as numbered versions.

Right-click a MIDI clip, MIDI track or clip slot → **Match MIDI Clips…**

## Install

1. Download [clip-twins.ablx](https://github.com/eshy/clip-twins/releases/latest/download/clip-twins.ablx)
   (or pick a version from the [releases page](https://github.com/eshy/clip-twins/releases)).
2. In Live, open Settings → Extensions → Install Extension and choose the file.

Requires Live 12 Suite beta 12.4.5 or later. Extensions are not available in
Live Standard, Intro or Lite.

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

## Development

You need Node.js 24.16 or later, the Extensions SDK download from Ableton's
beta program, and Developer Mode turned on in Live (Settings → Extensions).

1. Copy the SDK and CLI `.tgz` files into `vendor/` (see `vendor/README.md`).
2. Create `.env` with the path to Live's extension host, e.g.

       EXTENSION_HOST_PATH=/Applications/Ableton Live 12 Beta.app/Contents/.../ExtensionHost/ExtensionHostNodeModule.node

   (The SDK's project scaffolder finds this path for you; copy it from any scaffolded project.)
3. `npm install`
4. `npm start` to load it into Live, or `npm run package` for an installable `dist/clip-twins.ablx`.

Errors and a one-line summary of each run go to Live's `ExtensionHost.txt` log.

Without Live: `npm test` runs the matching engine and the whole extension against
a simulated Set; `npm run preview` builds `build/interface.html`, which opens in
any browser with sample data.

## Releasing

Pushing a version tag builds `clip-twins.ablx` and publishes it as a GitHub
release (`.github/workflows/release.yml`).

The workflow runs on a self-hosted runner, because Ableton's license doesn't
allow publishing the SDK: the SDK packages stay on your own machine.

One-time setup:

1. Add a self-hosted runner to this repository (Settings → Actions → Runners →
   New self-hosted runner) on a machine that has the SDK download.
2. In Settings → Secrets and variables → Actions, add the variable `SDK_DIR`
   with the folder on that machine that holds the SDK and CLI `.tgz` files
   (e.g. `D:\Dev\AbletonExtensions\clip-twins\vendor`).

The runner needs nothing else installed; the workflow sets up Node itself.

To release:

1. Set the same new version in `manifest.json` and `package.json`, and commit.
2. Tag and push:

       git tag v0.2.0
       git push origin main v0.2.0

When you move to a newer SDK, put the new `.tgz` files in the `SDK_DIR` folder too.

## Layout

    src/core/        matching engine, no Live dependency
      fingerprint.ts   strict identity
      similarity.ts    how alike two patterns are
      plan.ts          grouping, names, colors
    src/extension.ts scan the Set, show the dialog, apply
    src/ui/dialog.ts dialog logic (live preview uses the same plan.ts)
    ui/interface.html
    test/
