// Run by the release workflow before `npm ci`:
//   1. checks that the pushed tag matches the version in manifest.json and package.json
//   2. copies the SDK packages from the build machine into vendor/
// Written in Node so it behaves the same on Windows, macOS and Linux runners.
import * as fs from "node:fs";
import * as path from "node:path";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const tag = process.env.GITHUB_REF_NAME ?? "";
if (`v${manifest.version}` !== tag || manifest.version !== pkg.version) {
  fail(`Tag ${tag}, manifest.json (${manifest.version}) and package.json (${pkg.version}) must all agree.`);
}

const sdkDir = process.env.SDK_DIR;
if (!sdkDir) fail("Set the SDK_DIR repository variable to the SDK folder on the runner. See 'Releasing' in README.md.");
if (!fs.existsSync(sdkDir)) fail(`SDK_DIR "${sdkDir}" doesn't exist on this runner.`);

// Take exactly the files package.json asks for, so a mismatch fails here with a clear message.
const wanted = Object.values({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter((spec) => spec.startsWith("file:./vendor/"))
  .map((spec) => path.basename(spec));
for (const name of wanted) {
  const source = path.join(sdkDir, name);
  if (!fs.existsSync(source)) fail(`${name} not found in SDK_DIR "${sdkDir}".`);
  fs.copyFileSync(source, path.join("vendor", name));
  console.log(`Copied ${name}`);
}
