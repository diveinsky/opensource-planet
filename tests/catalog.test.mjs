import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { checkURL, classifyResponse } from "../scripts/validate-projects.mjs";
const require = createRequire(import.meta.url);
const {
  validateCatalog,
  validateProject,
  selectProjects,
  safeURL,
  imageURL,
} = require("../schema.js");
const catalog = JSON.parse(
  await readFile(new URL("../projects.json", import.meta.url)),
);
const draft = catalog.projects[0];
// Test-only synthetic record, never shipped or advertised in the website catalog.
const released = {
  ...draft,
  id: "test-fixture",
  slug: "test-fixture",
  name: "Test fixture",
  status: "released",
  license: "MIT",
  version: "1.0.0",
  releasedAt: "2026-01-01",
  repository: "https://github.com/test-owner/test-fixture",
};
test("the actual catalog passes all rules", () =>
  assert.deepEqual(validateCatalog(catalog), []));
test("rejects invalid roots, duplicate identities and duplicate repositories", () => {
  assert.ok(validateCatalog([]).length);
  assert.ok(
    validateCatalog({ schemaVersion: 1, projects: [draft, draft] }).some((e) =>
      e.includes("duplicate id"),
    ),
  );
  assert.ok(
    validateCatalog({
      schemaVersion: 1,
      projects: [
        released,
        {
          ...released,
          id: "other",
          slug: "other",
          name: "Other",
          repository:
            released.repository.toUpperCase().replace("HTTPS", "https") + "/",
        },
      ],
    }).some((e) => e.includes("duplicate repository")),
  );
});
test("rejects unsafe protocols, credentials, placeholder links and traversal", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "http://github.com/a/b",
    "https://user:pass@github.com/a/b",
    "https://github.com/OWNER/test",
    "https://example.com/file",
    "",
  ])
    assert.equal(safeURL(url), false, url);
  assert.equal(imageURL("assets/images/../../secret.svg"), false);
  assert.equal(imageURL("assets/images/event-concept.svg"), true);
});
test("released records need repository, license, version and release date", () => {
  assert.deepEqual(validateProject(released), []);
  for (const [field, value] of Object.entries({
    repository: "",
    license: "",
    version: "",
    releasedAt: "",
  }))
    assert.ok(validateProject({ ...released, [field]: value }).length, field);
  assert.ok(validateProject({ ...released, releasedAt: "2026-02-30" }).length);
});
test("download records must be actual HTTPS URLs with supported metadata", () => {
  const download = {
    platform: "Windows",
    architecture: "x64",
    type: "EXE",
    label: "Installer",
    url: "https://github.com/test-owner/test-fixture/releases/latest/download/test.exe",
  };
  assert.deepEqual(validateProject({ ...released, downloads: [download] }), []);
  for (const url of ["", "javascript:alert(1)", "http://unsafe.test/file"])
    assert.ok(
      validateProject({ ...released, downloads: [{ ...download, url }] })
        .length,
    );
  assert.ok(validateProject({ ...draft, downloads: [download] }).length);
  assert.ok(
    validateProject({
      ...released,
      downloads: [{ ...download, platform: "Plan9" }],
    }).length,
  );
});
test("category, platform, status and license rules reject unsupported values", () => {
  for (const [field, value] of Object.entries({
    category: "Unknown",
    platforms: ["Plan9"],
    status: "shipped",
    license: "Proprietary",
  }))
    assert.ok(validateProject({ ...draft, [field]: value }).length, field);
  assert.ok(validateProject(null).length);
  assert.ok(validateProject({ ...draft, tags: [null] }).length);
});
test("search matches names, descriptions and tags, with combined filters", () => {
  assert.equal(
    selectProjects(catalog.projects, { search: "  TAURI  " })[0].id,
    draft.id,
  );
  assert.equal(
    selectProjects(catalog.projects, { search: "retrieval" })[0].id,
    "rag-model-bench",
  );
  assert.equal(
    selectProjects(catalog.projects, { category: "AI Tools" }).length,
    2,
  );
  assert.equal(
    selectProjects(catalog.projects, {
      platform: "Windows",
      category: "AI Tools",
    }).length,
    1,
  );
  assert.equal(
    selectProjects(catalog.projects, { search: "no-such-project" }).length,
    0,
  );
});
test("sorting uses names, dates and release status with stable name ties", () => {
  const items = [
    { ...draft, name: "Zed", updatedAt: "2026-01-01" },
    { ...released, name: "Alpha", updatedAt: "2025-01-01" },
  ];
  assert.equal(selectProjects(items)[0].name, "Alpha");
  assert.equal(selectProjects(items, { sort: "updated" })[0].name, "Zed");
  assert.equal(selectProjects(items, { sort: "status" })[0].name, "Alpha");
});
test("link checks distinguish broken from restricted and transient responses", async () => {
  assert.equal(classifyResponse(404), "broken");
  assert.equal(classifyResponse(410), "broken");
  for (const status of [401, 403, 429, 503])
    assert.equal(classifyResponse(status), "inconclusive");
  assert.equal(classifyResponse(200), "ok");
  assert.equal(classifyResponse(400), "review");
  assert.equal(
    (
      await checkURL("https://test.invalid", async () => {
        throw new Error("network");
      })
    ).kind,
    "inconclusive",
  );
  const methods = [];
  const result = await checkURL("https://test.invalid", async (_, options) => {
    methods.push(options.method);
    return {
      status: options.method === "HEAD" ? 405 : 200,
      body: { cancel: async () => {} },
    };
  });
  assert.deepEqual(methods, ["HEAD", "GET"]);
  assert.equal(result.kind, "ok");
});

test("malformed field types report errors without crashing validation", () => {
  for (const platforms of [null, {}, 42, "Windows"]) {
    assert.ok(
      validateProject({
        ...released,
        platforms,
        downloads: [
          {
            platform: "Windows",
            architecture: "x64",
            type: "EXE",
            label: "test",
            url: "https://github.com/test-maintainer/test-fixture/releases/download/v1/test.exe",
          },
        ],
      }).length,
    );
  }
});
