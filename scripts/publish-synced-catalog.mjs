/* Used only by the manually dispatched workflow, never by the browser. */
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { validateCatalog } = require("../schema.js");
export async function publishCatalog({
  repository,
  branch,
  expectedSha,
  content,
  request,
  log = console.log,
}) {
  if (
    !/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(repository || "") ||
    !branch ||
    !expectedSha
  )
    throw new Error("Missing or invalid publication context.");
  const errors = validateCatalog(JSON.parse(content));
  if (errors.length)
    throw new Error(`Refusing invalid catalog: ${errors.join("; ")}`);
  const path = `/repos/${repository}`;
  const current = await request(
    `${path}/contents/projects.json?ref=${encodeURIComponent(branch)}`,
  );
  if (current.sha !== expectedSha)
    throw new Error(
      "projects.json changed while syncing. Rerun the workflow; no changes were published.",
    );
  const same =
    Buffer.from(current.content, "base64").toString("utf8") === content;
  if (!same) {
    const result = await request(`${path}/contents/projects.json`, {
      method: "PUT",
      body: {
        message: "Sync public topic-tagged GitHub projects",
        branch,
        sha: current.sha,
        content: Buffer.from(content).toString("base64"),
      },
    });
    log(`Committed catalog: ${result.commit.html_url}`);
  } else log("Catalog already up to date; no commit needed.");
  const pages = await request(`${path}/pages`, { optional: true });
  if (!pages) {
    log(
      "GitHub Pages is not configured. Catalog is committed; configure hosting or let your connected host deploy it.",
    );
    return;
  }
  if (
    pages.build_type === "workflow" ||
    pages.source?.branch !== branch ||
    pages.source?.path !== "/"
  ) {
    throw new Error(
      "Catalog saved, but Pages needs a separate deployment: this sync rebuilds only branch-based Pages using the default branch and /(root). Update Pages settings or run your deployment workflow.",
    );
  }
  // GITHUB_TOKEN commits do not reliably trigger branch-based Pages builds themselves.
  await request(`${path}/pages/builds`, { method: "POST" });
  log(
    `Requested GitHub Pages rebuild: ${pages.html_url}. Publication is pending; check the Pages deployment status.`,
  );
}
async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token)
    throw new Error(
      "This publisher requires the manual GitHub Actions workflow token. Use the local sync command and git push for local work.",
    );
  const repository = process.env.GITHUB_REPOSITORY;
  const branch = process.env.SYNC_BRANCH;
  const expectedSha = execFileSync("git", ["rev-parse", "HEAD:projects.json"], {
    encoding: "utf8",
  }).trim();
  const content = await readFile(
    new URL("../projects.json", import.meta.url),
    "utf8",
  );
  const request = async (
    path,
    { method = "GET", body, optional = false } = {},
  ) => {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "OpenSource-Planet-Sync",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (optional && response.status === 404) return null;
    if (!response.ok)
      throw new Error(
        `GitHub ${method} ${path} returned HTTP ${response.status}. Branch protection or permissions may require a normal pull request. If the catalog commit succeeded, it remains saved; inspect the run before retrying.`,
      );
    return response.status === 204 ? null : response.json();
  };
  await publishCatalog({ repository, branch, expectedSha, content, request });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
