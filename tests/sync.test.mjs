import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  githubClient,
  allPages,
  eligibleRepository,
  assetDownload,
  mapProject,
  buildCatalog,
  syncCatalog,
} from "../scripts/sync-projects.mjs";
import { publishCatalog } from "../scripts/publish-synced-catalog.mjs";
const config = { githubUser: "test-maintainer", topic: "opensource-planet" };
const repo = {
  name: "Test.App",
  full_name: "test-maintainer/Test.App",
  html_url: "https://github.com/test-maintainer/Test.App",
  owner: { login: "test-maintainer" },
  private: false,
  visibility: "public",
  topics: ["opensource-planet", "desktop", "planet-featured"],
  license: { spdx_id: "MIT" },
  description: "A test project",
  homepage: "https://test.invalid/demo",
  language: "Rust",
  pushed_at: "2026-11-01T00:00:00Z",
  archived: false,
};
const asset = {
  name: "test-windows-x64.exe",
  label: "Windows installer",
  state: "uploaded",
  browser_download_url:
    "https://github.com/test-maintainer/Test.App/releases/download/v1/test.exe",
};
const release = {
  id: 1,
  tag_name: "v1.0.0",
  html_url: "https://github.com/test-maintainer/Test.App/releases/tag/v1.0.0",
  zipball_url:
    "https://api.github.com/repos/test-maintainer/Test.App/zipball/v1.0.0",
  published_at: "2026-11-01T10:00:00Z",
  assets: [asset],
  draft: false,
  prerelease: false,
};
function api({
  repositories = [repo],
  detail = repo,
  latest = release,
  metadata = null,
  fail = "",
} = {}) {
  return async (path) => {
    if (fail && path.includes(fail)) throw new Error("network unavailable");
    if (path.startsWith("/users/")) return repositories;
    if (path.includes("/contents/")) return metadata;
    if (path.endsWith("/releases/latest")) return latest;
    if (path.includes("/releases/1/assets")) return latest.assets;
    return detail;
  };
}
test("eligibility requires public visibility, configured owner and exact topic", () => {
  assert.equal(eligibleRepository(repo, config), true);
  for (const changed of [
    { private: true },
    { private: undefined },
    { visibility: "private" },
    { owner: { login: "someone-else" } },
    { topics: ["not-opensource-planet"] },
  ])
    assert.equal(eligibleRepository({ ...repo, ...changed }, config), false);
});
test("repository and release asset pagination collects all pages", async () => {
  const paths = [];
  const result = await allPages(async (path) => {
    paths.push(path);
    return paths.length === 1 ? Array(100).fill({}) : [{}];
  }, "/repos/a/b/releases/1/assets");
  assert.equal(result.length, 101);
  assert.match(paths[1], /page=2$/);
});
test("API 404 is optional only when requested; rate limits and server failures abort", async () => {
  for (const status of [403, 429, 500])
    await assert.rejects(
      githubClient({ fetcher: async () => ({ status, ok: false }) })("/test", {
        optional: true,
      }),
      /Sync stopped/,
    );
  const request = githubClient({
    fetcher: async () => ({ status: 404, ok: false }),
  });
  assert.equal(await request("/test", { optional: true }), null);
  await assert.rejects(request("/test"));
});
test("maps real source and release links without inventing URLs", () => {
  const project = mapProject(repo, release);
  assert.equal(project.repository, repo.html_url);
  assert.equal(project.status, "released");
  assert.equal(project.version, "1.0.0");
  assert.equal(project.featured, true);
  assert.equal(project.downloads[0].url, asset.browser_download_url);
  assert.equal(project.downloads[1].url, release.zipball_url);
  assert.deepEqual(project.platforms, ["Windows", "Source"]);
});
test("projects without a release remain source-only; archived assets are disabled", () => {
  assert.equal(mapProject(repo, null).status, "development");
  assert.deepEqual(mapProject(repo, null).downloads, []);
  assert.equal(
    mapProject({ ...repo, archived: true }, release).status,
    "archived",
  );
  assert.deepEqual(
    mapProject({ ...repo, archived: true }, release).downloads,
    [],
  );
});
test("download OS detection uses format and unambiguous names; generic ZIP needs mapping", () => {
  assert.equal(assetDownload(asset).platform, "Windows");
  assert.equal(assetDownload({ ...asset, name: "test.zip" }), null);
  assert.equal(
    assetDownload(
      { ...asset, name: "test.zip" },
      {
        assetPlatforms: {
          "test.zip": { platform: "Linux", architecture: "arm64" },
        },
      },
    ).platform,
    "Linux",
  );
  assert.equal(
    assetDownload({ ...asset, browser_download_url: "javascript:alert(1)" }),
    null,
  );
  assert.equal(assetDownload({ ...asset, state: "new" }), null);
});
test("skips unlicensed projects and rechecks eligibility from repository details", async () => {
  assert.equal(
    (
      await buildCatalog(
        config,
        api({ detail: { ...repo, license: null } }),
        () => {},
      )
    ).projects.length,
    0,
  );
  assert.equal(
    (
      await buildCatalog(
        config,
        api({ detail: { ...repo, private: true } }),
        () => {},
      )
    ).projects.length,
    0,
  );
  assert.equal(
    (
      await buildCatalog(
        config,
        api({ detail: { ...repo, topics: [] } }),
        () => {},
      )
    ).projects.length,
    0,
  );
});
test("optional project metadata customizes appearance but cannot replace release URLs", async () => {
  const metadata = {
    name: "Friendly name",
    category: "Desktop",
    screenshots: ["https://test.invalid/screenshot.png"],
    documentation: "https://test.invalid/docs",
    downloads: [{ url: "javascript:bad" }],
  };
  const result = await buildCatalog(
    config,
    api({
      metadata: {
        type: "file",
        encoding: "base64",
        size: 200,
        content: Buffer.from(JSON.stringify(metadata)).toString("base64"),
      },
    }),
    () => {},
  );
  assert.equal(result.projects[0].name, "Friendly name");
  assert.equal(result.projects[0].downloads[0].url, asset.browser_download_url);
});
test("normalization collisions fail rather than publishing duplicate IDs", async () => {
  const second = {
    ...repo,
    name: "Test-App",
    full_name: "test-maintainer/Test-App",
    html_url: "https://github.com/test-maintainer/Test-App",
  };
  const request = async (path) =>
    path.startsWith("/users/")
      ? [repo, second]
      : path.includes("/contents/") || path.endsWith("/releases/latest")
        ? null
        : path.endsWith("/Test-App")
          ? second
          : repo;
  await assert.rejects(
    buildCatalog(config, request, () => {}),
    /duplicate id/,
  );
});
test("errors, dry runs and empty results leave the file untouched; successful sync replaces atomically", async () => {
  const dir = await mkdtemp(join(tmpdir(), "planet-sync-"));
  const output = join(dir, "projects.json");
  const options = { config, output, log: () => {} };
  try {
    await writeFile(output, "original");
    await assert.rejects(
      syncCatalog({ ...options, request: api({ fail: "/releases/latest" }) }),
    );
    assert.equal(await readFile(output, "utf8"), "original");
    await assert.rejects(
      syncCatalog({ ...options, request: api({ repositories: [] }) }),
      /No eligible projects/,
    );
    assert.equal(await readFile(output, "utf8"), "original");
    await syncCatalog({
      ...options,
      request: api({ repositories: [] }),
      dryRun: true,
    });
    await syncCatalog({ ...options, request: api(), dryRun: true });
    assert.equal(await readFile(output, "utf8"), "original");
    await syncCatalog({ ...options, request: api() });
    assert.equal(JSON.parse(await readFile(output, "utf8")).projects.length, 1);
    await syncCatalog({
      ...options,
      request: api({ repositories: [] }),
      allowEmpty: true,
    });
    assert.equal(JSON.parse(await readFile(output, "utf8")).projects.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("missing descriptions and invalid optional metadata have honest fallbacks or fail validation", async () => {
  assert.match(
    mapProject({ ...repo, description: "" }, null).description,
    /See the repository/,
  );
  const metadata = {
    type: "file",
    encoding: "base64",
    size: 2,
    content: Buffer.from("{bad").toString("base64"),
  };
  await assert.rejects(buildCatalog(config, api({ metadata }), () => {}));
});
const content = JSON.stringify({
  schemaVersion: 1,
  projects: [mapProject(repo, release)],
});
test("publisher writes only projects.json and explicitly requests a Pages build", async () => {
  const calls = [];
  await publishCatalog({
    repository: "test-maintainer/catalog",
    branch: "main",
    expectedSha: "abc",
    content,
    log: () => {},
    request: async (path, options = {}) => {
      calls.push({ path, ...options });
      if (options.method === "PUT")
        return {
          commit: {
            html_url: "https://github.com/test-maintainer/catalog/commit/test",
          },
        };
      if (path.endsWith("/pages"))
        return {
          build_type: "legacy",
          source: { branch: "main", path: "/" },
          html_url: "https://test.invalid",
        };
      return { sha: "abc", content: Buffer.from("old").toString("base64") };
    },
  });
  assert.equal(calls.filter((c) => c.method === "PUT").length, 1);
  assert.match(calls[1].path, /contents\/projects.json$/);
  assert.equal(calls.at(-1).method, "POST");
  assert.match(calls.at(-1).path, /pages\/builds$/);
});
test("publisher refuses concurrent changes before writing", async () => {
  let count = 0;
  await assert.rejects(
    publishCatalog({
      repository: "test-maintainer/catalog",
      branch: "main",
      expectedSha: "old",
      content,
      request: async () => {
        count++;
        return { sha: "new" };
      },
    }),
    /changed while syncing/,
  );
  assert.equal(count, 1);
});
test("unchanged catalog avoids duplicate commits and a retry can still request publication", async () => {
  const methods = [];
  await publishCatalog({
    repository: "test-maintainer/catalog",
    branch: "main",
    expectedSha: "abc",
    content,
    log: () => {},
    request: async (path, options = {}) => {
      methods.push(options.method || "GET");
      if (path.endsWith("/pages")) return null;
      return { sha: "abc", content: Buffer.from(content).toString("base64") };
    },
  });
  assert.deepEqual(methods, ["GET", "GET"]);
});
