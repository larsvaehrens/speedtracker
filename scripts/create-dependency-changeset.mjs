const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const headRef = process.env.PR_HEAD_REF;
const pullRequestNumber = process.env.PR_NUMBER;

if (!token || !repository || !headRef || !pullRequestNumber) {
  throw new Error("Missing required GitHub environment values for dependency changeset creation.");
}

const [owner, repo] = repository.split("/");
if (!owner || !repo || repository.split("/").length !== 2 || !/^\d+$/.test(pullRequestNumber)) {
  throw new Error("Invalid GitHub repository or pull request number.");
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

async function githubRequest(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

const changedFiles = [];
for (let page = 1; ; page += 1) {
  const files = await githubRequest(
    `/repos/${owner}/${repo}/pulls/${pullRequestNumber}/files?per_page=100&page=${page}`,
  );
  if (!Array.isArray(files)) {
    throw new Error("GitHub returned an invalid pull request file list.");
  }
  changedFiles.push(...files);
  if (files.length < 100) break;
}

if (
  changedFiles.some(
    ({ filename, status }) =>
      status !== "removed" && filename.startsWith(".changeset/") && filename.endsWith(".md"),
  )
) {
  console.log("The pull request already contains a changeset.");
  process.exit(0);
}

if (
  !changedFiles.some(
    ({ filename, status }) =>
      status !== "removed" &&
      (filename === "package.json" ||
        filename.endsWith("/package.json") ||
        filename === "pnpm-workspace.yaml" ||
        filename === "pnpm-lock.yaml"),
  )
) {
  console.log("The pull request does not update dependency manifests, catalogs, or lockfiles.");
  process.exit(0);
}

const content = `---\n"speedtracker": patch\n---\n\nUpdate dependencies in the pnpm workspace.\n`;
const path = `.changeset/dependencies-GH-${pullRequestNumber}.md`;
await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "chore(deps): add changeset",
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: headRef,
  }),
});
console.log(`Created ${path} on the dependency update pull request.`);
