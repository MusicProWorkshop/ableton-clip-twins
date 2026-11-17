// npm run release
//
// Builds clip-twins.ablx on this machine and publishes it as a GitHub release:
//   1. checks that manifest.json and package.json agree on the version
//   2. checks the working tree is clean and the tag doesn't exist yet
//   3. runs the tests and builds the .ablx
//   4. tags the commit, pushes the tag, and creates the release with the file
//
// Needs the GitHub CLI (gh), signed in with access to the repository.
import { execSync } from "node:child_process";
import * as fs from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const read = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
function fail(message) {
  console.error(`\nRelease stopped: ${message}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (manifest.version !== pkg.version) {
  fail(`manifest.json (${manifest.version}) and package.json (${pkg.version}) have different versions.`);
}
const version = manifest.version;
const tag = `v${version}`;

try {
  read("gh auth status");
} catch {
  fail("the GitHub CLI isn't installed or isn't signed in. Install it from https://cli.github.com and run `gh auth login`.");
}
if (read("git status --porcelain")) fail("there are uncommitted changes. Commit or stash them first.");
if (read(`git tag --list ${tag}`)) fail(`tag ${tag} already exists. Bump the version in manifest.json and package.json.`);

console.log(`Releasing Clip Twins ${tag}\n`);
run("npm test");
run("npm run package");
if (!fs.existsSync("dist/clip-twins.ablx")) fail("dist/clip-twins.ablx wasn't built.");

run(`git tag ${tag}`);
run(`git push origin ${tag}`);
run(`gh release create ${tag} dist/clip-twins.ablx --title "Clip Twins ${tag}" --generate-notes --verify-tag`);
console.log(`\nPublished ${tag}.`);
