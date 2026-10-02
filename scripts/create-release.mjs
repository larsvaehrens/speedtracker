import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8").catch(
  (error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  },
);
const version = packageJson.version;
const tag = `v${version}`;

if (!new RegExp(`^## ${version.replaceAll(".", "\\.")}(?:\\s|$)`, "m").test(changelog)) {
  console.log(`No Changesets changelog entry for ${version}; skipping GitHub Release.`);
  process.exit(0);
}

const listed = spawnSync("gh", ["release", "list", "--json", "tagName", "--limit", "100"], {
  encoding: "utf8",
});
if (listed.error) throw listed.error;
if (listed.status !== 0) {
  throw new Error(`Could not list GitHub Releases to check whether ${tag} already exists.`);
}
const releases = JSON.parse(listed.stdout);
if (releases.some((release) => release.tagName === tag)) {
  console.log(`GitHub Release ${tag} already exists.`);
  process.exit(0);
}

const created = spawnSync(
  "gh",
  ["release", "create", tag, "--title", `SpeedTracker ${version}`, "--generate-notes"],
  { stdio: "inherit" },
);
if (created.error) throw created.error;
if (created.status !== 0) {
  throw new Error(`Could not create GitHub Release ${tag}.`);
}
