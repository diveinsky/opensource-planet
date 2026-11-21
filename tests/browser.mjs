/* Optional browser regression: install Playwright outside the buildless site. */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const base =
  process.env.TEST_BASE_URL || "http://127.0.0.1:8000/opensource-planet/";
const errors = [],
  failedRequests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.url().startsWith(base) && r.status() >= 400)
    failedRequests.push(r.url());
});
const count = () => page.locator("#project-grid .project-card").count();
let checks = 0;
function verify(value, message) {
  assert.ok(value, message);
  checks++;
}
try {
  await mkdir("artifacts", { recursive: true });
  // Stable UI fixtures keep regression checks independent of your live project selection.
  const fixtureCatalog = JSON.parse(
    await readFile(new URL("./fixtures/catalog.json", import.meta.url)),
  );
  await page.route("**/projects.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fixtureCatalog),
    }),
  );
  await page.goto(base);
  await page.waitForFunction(
    () =>
      document.querySelector("#project-grid").getAttribute("aria-busy") ===
      "false",
  );
  verify((await count()) === 4, "four actual drafts rendered");
  verify(
    (await page.locator("#featured-grid .project-card").count()) === 2,
    "featured selection",
  );
  verify(
    (await page
      .locator('a[href*="template=project-submission.yml"]')
      .count()) === 2,
    "submission links",
  );
  verify(
    (await page.locator("#sponsor").getAttribute("href")) === null,
    "unconfigured sponsorship is inactive",
  );
  await page
    .locator("#project-grid .project-card")
    .first()
    .evaluate((node) => {
      window.originalCard = node;
    });
  await page.locator("#search").fill("tauri");
  verify((await count()) === 1, "tag search");
  await page.locator("#search").fill("retrieval");
  verify((await count()) === 1, "description search");
  await page.locator("#search").fill("zz-not-found");
  verify(await page.locator("#catalog-message").isVisible(), "empty state");
  await page.locator("#reset").click();
  verify((await count()) === 4, "reset");
  verify(
    await page
      .locator("#project-grid .project-card")
      .first()
      .evaluate((node) => node === window.originalCard),
    "filtering reuses existing card DOM",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#search").fill("tauri");
  verify(
    await page
      .locator("#project-grid .project-card")
      .evaluateAll((nodes) =>
        nodes.every((node) => node.getAnimations().length === 0),
      ),
    "reduced motion skips catalog animations",
  );
  await page.locator("#search").fill("");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "AI Tools", exact: true }).click();
  verify((await count()) === 2, "category filter");
  await page.locator("#platform").selectOption("Windows");
  verify((await count()) === 1, "combined platform filter");
  await page.getByRole("button", { name: "All projects", exact: true }).click();
  await page.locator("#platform").selectOption("all");
  await page.locator("#sort").selectOption("name");
  verify(
    (await page.locator("#project-grid h3").first().textContent()) ===
      "Agent Workflow Lab",
    "name sorting",
  );
  await page.locator("#sort").selectOption("updated");
  verify((await count()) === 4, "missing update date fallback");
  await page.locator("#sort").selectOption("status");
  verify((await count()) === 4, "release-status sort");
  const opener = page.locator("#project-grid button").first();
  await opener.focus();
  await page.keyboard.press("Enter");
  verify(
    await page.locator("#project-dialog").isVisible(),
    "keyboard opens dialog",
  );
  verify(
    await page
      .locator("#close-dialog")
      .evaluate((n) => n === document.activeElement),
    "initial dialog focus",
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  verify(
    await page.evaluate(() =>
      document
        .querySelector("#project-dialog")
        .contains(document.activeElement),
    ),
    "native modal focus containment",
  );
  verify(
    (await page.locator("#dialog-content a").count()) === 0,
    "draft has no invented active destinations",
  );
  await page.keyboard.press("Escape");
  verify(
    !(await page.locator("#project-dialog").isVisible()),
    "Escape closes dialog",
  );
  verify(
    await opener.evaluate((n) => n === document.activeElement),
    "focus returns to opener",
  );
  await opener.click();
  await page.locator("#close-dialog").click();
  verify(!(await page.locator("#project-dialog").isVisible()), "close button");
  await opener.click();
  await page.mouse.click(3, 3);
  verify(
    !(await page.locator("#project-dialog").isVisible()),
    "backdrop close",
  );
  await page.locator("#theme-toggle").click();
  verify(
    await page.locator("body").evaluate((n) => n.classList.contains("light")),
    "light mode",
  );
  await page.reload();
  await page.waitForSelector("#project-grid .project-card");
  verify(
    await page.locator("body").evaluate((n) => n.classList.contains("light")),
    "theme persistence",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "artifacts/desktop-light.png",
    fullPage: true,
  });
  await page.locator("#theme-toggle").click();
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    verify(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `no horizontal overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  await page.goto(`${base}#projects`);
  await page.reload();
  await page.waitForSelector("#project-grid .project-card");
  verify((await count()) === 4, "subpath and hash refresh");
  const assetResults = await page.evaluate(async () => {
    const urls = [
      ...document.querySelectorAll("img[src],script[src],link[href]"),
    ]
      .map((n) => n.src || n.href)
      .filter((u) => new URL(u).origin === location.origin);
    return Promise.all(
      urls.map(async (u) => ({ url: u, ok: (await fetch(u)).ok })),
    );
  });
  verify(
    assetResults.every((r) => r.ok),
    "all local runtime references resolve",
  );
  verify(errors.length === 0, `no browser JS errors: ${errors}`);
  verify(failedRequests.length === 0, "no local 404s");
  // Intercept only test responses: synthetic fixtures never enter projects.json.
  const catalog = JSON.parse(
    await readFile(new URL("./fixtures/catalog.json", import.meta.url)),
  );
  const fixture = {
    ...catalog.projects[0],
    id: "fixture",
    slug: "fixture",
    name: "<img src=x onerror=alert(1)>",
    status: "released",
    license: "MIT",
    version: "1.0.0",
    releasedAt: "2026-01-01",
    repository: "https://github.com/test-maintainer/test-fixture",
    preview: undefined,
    downloads: [
      {
        platform: "Windows",
        architecture: "x64",
        type: "EXE",
        label: "Windows installer",
        url: "https://github.com/test-maintainer/test-fixture/releases/latest/download/test.exe",
      },
    ],
  };
  let responseBody = JSON.stringify({ schemaVersion: 1, projects: [fixture] }),
    status = 200;
  await page.route("**/projects.json", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: responseBody,
    }),
  );
  await page.reload();
  await page.waitForSelector("#project-grid .project-card");
  verify(
    (await page.locator("#project-grid h3").textContent()) === fixture.name,
    "untrusted text is literal",
  );
  verify(
    (await page.locator("#project-grid h3 img").count()) === 0,
    "no HTML injection",
  );
  await page.locator("#project-grid button").click();
  verify(
    (await page.locator(".download-list a").count()) === 1,
    "valid released download",
  );
  verify(
    await page
      .getByRole("link", { name: "Source code", exact: true })
      .isVisible(),
    "source link",
  );
  verify(
    await page
      .getByRole("link", { name: "All Releases", exact: true })
      .isVisible(),
    "all releases link",
  );
  await page.keyboard.press("Escape");
  verify(
    (await page.locator(".release-row").count()) === 1,
    "release metadata displayed",
  );
  for (const url of ["", "javascript:alert(1)"]) {
    responseBody = JSON.stringify({
      schemaVersion: 1,
      projects: [{ ...fixture, downloads: [{ ...fixture.downloads[0], url }] }],
    });
    await page.reload();
    await page.waitForSelector("#catalog-message:not([hidden])");
    verify(
      (await page.locator(".download-list a").count()) === 0 &&
        (await count()) === 0,
      "invalid assets never create active buttons",
    );
  }
  responseBody = JSON.stringify({
    schemaVersion: 1,
    projects: [{ ...fixture, name: "No assets", downloads: [] }],
  });
  await page.reload();
  await page.waitForSelector("#project-grid .project-card");
  await page.locator("#project-grid button").click();
  verify(
    await page
      .getByRole("link", { name: "View Repository", exact: true })
      .isVisible(),
    "repository fallback without assets",
  );
  await page.keyboard.press("Escape");
  responseBody = "{broken-json";
  await page.reload();
  await page.waitForSelector("#retry:not([hidden])");
  verify(
    (await page.locator("#message-title").textContent()) ===
      "We couldn’t load the catalog.",
    "malformed JSON message",
  );
  responseBody = JSON.stringify(catalog);
  await page.locator("#retry").click();
  await page.waitForSelector("#project-grid .project-card");
  verify((await count()) === 4, "retry recovers");
  status = 503;
  await page.reload();
  await page.waitForSelector("#retry:not([hidden])");
  verify(
    await page.locator("#retry").isVisible(),
    "HTTP load failure recovery control",
  );
  console.log(
    `Passed ${checks} browser assertions; desktop, light-mode, and mobile screenshots saved in artifacts/.`,
  );
} finally {
  await browser.close();
}
