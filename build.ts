import * as esbuild from "esbuild";
import * as fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const production = process.argv.includes("--production");
const uiOnly = process.argv.includes("--ui-only");

/** Bundle the dialog script and inline it into the HTML, so the dialog is one self-contained page. */
export async function buildUi(): Promise<string> {
  const result = await esbuild.build({
    entryPoints: ["src/ui/dialog.ts"],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    write: false,
  });
  const js = result.outputFiles[0]!.text.replace(/<\/script/gi, "<\\/script");
  const html = fs.readFileSync("ui/interface.html", "utf8").replace("/*__DIALOG_JS__*/", () => js);
  fs.mkdirSync("build", { recursive: true });
  fs.writeFileSync("build/interface.html", html);
  return html;
}

/** Bundle the extension itself. `alias` lets the tests swap in a fake SDK. */
export async function buildExtension(outfile: string, alias: Record<string, string> = {}) {
  await esbuild.build({
    entryPoints: ["src/extension.ts"],
    outfile,
    bundle: true,
    format: "cjs", // the Extension Host loads CommonJS
    platform: "node",
    sourcesContent: false,
    logLevel: "warning",
    minify: production,
    sourcemap: !production,
    loader: { ".html": "text" },
    alias,
  });
}

if (process.argv[1]?.endsWith("build.ts")) {
  await buildUi();
  if (uiOnly) console.log("Open build/interface.html in a browser to preview the dialog with sample data.");
  else {
    await buildExtension(manifest.entry);
    console.log(`Built ${manifest.entry}`);
  }
}
