import { readFile, access } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { validateCatalog } = require("../schema.js");
export function classifyResponse(status) {
  if (status >= 200 && status < 400) return "ok";
  if ([404, 410].includes(status)) return "broken";
  // 403 can mean permissions, rate limiting, or anti-bot defenses.
  if ([401, 403, 408, 425, 429].includes(status) || status >= 500)
    return "inconclusive";
  return "review";
}
export async function checkURL(url, fetcher = fetch) {
  try {
    let response = await fetcher(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "OpenSource-Planet-Catalog-Validator" },
    });
    if ([405, 501].includes(response.status)) {
      response = await fetcher(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
        headers: {
          Range: "bytes=0-0",
          "User-Agent": "OpenSource-Planet-Catalog-Validator",
        },
      });
      await response.body?.cancel();
    }
    return {
      kind: classifyResponse(response.status),
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      kind: "inconclusive",
      detail:
        error.name === "TimeoutError"
          ? "request timed out"
          : "network or TLS failure",
    };
  }
}
async function main() {
  let data;
  try {
    data = JSON.parse(
      await readFile(new URL("../projects.json", import.meta.url), "utf8"),
    );
  } catch (error) {
    console.error(`::error::projects.json: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = validateCatalog(data);
  if (errors.length) {
    errors.forEach((e) => console.error(`::error::${e.replaceAll("\n", " ")}`));
    process.exitCode = 1;
    return;
  }
  for (const p of data.projects)
    for (const path of [p.preview, ...p.screenshots].filter((v) =>
      v?.startsWith("assets/"),
    )) {
      try {
        await access(new URL(`../${path}`, import.meta.url));
      } catch {
        errors.push(`${p.id}: missing local image ${path}`);
      }
    }
  if (errors.length) {
    errors.forEach((e) => console.error(`::error::${e}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Validated ${data.projects.length} projects: syntax, schema, identities, repositories, licenses and local images.`,
  );
  if (!process.argv.includes("--check-links")) return;
  const urls = new Set(
    data.projects.flatMap((p) =>
      [
        p.repository,
        p.documentation,
        p.demo,
        p.releaseNotes,
        ...p.downloads.map((d) => d.url),
      ].filter(Boolean),
    ),
  );
  for (const url of urls) {
    const result = await checkURL(url);
    const message = `${url}: ${result.detail}`;
    if (result.kind === "broken") {
      console.error(`::error::Broken link: ${message}`);
      process.exitCode = 1;
    } else if (result.kind !== "ok")
      console.warn(
        `::warning::${result.kind === "inconclusive" ? "Check inconclusive (network, rate limit, or access restriction)" : "Manual review required"}: ${message}`,
      );
    else console.log(`OK ${message}`);
  }
  console.log(
    `Checked ${urls.size} unique external URLs. Inconclusive responses require maintainer review; no assets were executed.`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
)
  await main();
