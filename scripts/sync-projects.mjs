import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const {
  licenses,
  categories,
  platforms,
  safeURL,
  validateCatalog,
} = require("../schema.js");
const root = new URL("../", import.meta.url);

export function githubClient({ token = "", fetcher = fetch } = {}) {
  return async function request(path, { optional = false } = {}) {
    const response = await fetcher(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "OpenSource-Planet-Sync",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (response.status === 404 && optional) return null;
    if (!response.ok)
      throw new Error(
        `GitHub API ${response.status} for ${path}. Sync stopped; the existing catalog is unchanged. Check access, connectivity, or rate limits and retry.`,
      );
    return response.json();
  };
}
export async function allPages(request, path) {
  const items = [];
  for (let page = 1; ; page++) {
    const batch = await request(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch))
      throw new Error(`Expected an array from ${path}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}
export function eligibleRepository(repo, config) {
  return (
    repo?.private === false &&
    repo.visibility !== "private" &&
    repo.owner?.login?.toLowerCase() === config.githubUser.toLowerCase() &&
    Array.isArray(repo.topics) &&
    repo.topics.includes(config.topic)
  );
}
function architecture(name) {
  if (/arm64|aarch64/i.test(name)) return "arm64";
  if (/x86_64|amd64|(?:^|[-_.])x64(?:[-_.]|$)/i.test(name)) return "x64";
  if (/ia32|i386|i686|(?:^|[-_.])x86(?:[-_.]|$)/i.test(name)) return "x86";
  return "Not specified";
}
export function assetDownload(asset, metadata = {}) {
  if (asset.state !== "uploaded" || !safeURL(asset.browser_download_url))
    return null;
  const name = asset.name || "";
  const extension = name
    .match(/\.(exe|msi|zip|appimage|deb|rpm|dmg|pkg|apk)$/i)?.[1]
    ?.toLowerCase();
  if (!extension) return null;
  const types = {
    exe: "EXE",
    msi: "MSI",
    zip: "ZIP",
    appimage: "AppImage",
    deb: "DEB",
    rpm: "RPM",
    dmg: "DMG",
    pkg: "PKG",
    apk: "APK",
  };
  let platform = ["exe", "msi"].includes(extension)
    ? "Windows"
    : ["deb", "rpm", "appimage"].includes(extension)
      ? "Linux"
      : ["dmg", "pkg"].includes(extension)
        ? "macOS"
        : extension === "apk"
          ? "Android"
          : null;
  if (!platform && extension === "zip") {
    if (/windows|(?:^|[-_.])win(?:32|64)?(?:[-_.]|$)/i.test(name))
      platform = "Windows";
    else if (/macos|darwin|osx/i.test(name)) platform = "macOS";
    else if (/linux/i.test(name)) platform = "Linux";
  }
  const override = metadata.assetPlatforms?.[name];
  if (override !== undefined) {
    if (!override || !platforms.includes(override.platform))
      throw new Error(`Invalid assetPlatforms entry for ${name}`);
    platform = override.platform;
  }
  if (!platform) return null; // Do not guess the OS of a generic ZIP.
  return {
    platform,
    architecture: override?.architecture || architecture(name),
    type: types[extension],
    label: asset.label || name,
    url: asset.browser_download_url,
  };
}
export function mapProject(repo, release, metadata = {}) {
  const topics = repo.topics || [];
  const platformTopics = {
    windows: "Windows",
    linux: "Linux",
    macos: "macOS",
    android: "Android",
    ios: "iOS",
    web: "Web",
  };
  const categoryTopics = {
    "ai-tools": "AI Tools",
    ai: "AI Tools",
    desktop: "Desktop",
    cli: "CLI / Utilities",
    "developer-tools": "Developer Tools",
    web: "Web",
    mobile: "Mobile",
  };
  if (metadata.category && !categories.includes(metadata.category))
    throw new Error(`Unsupported category for ${repo.full_name}`);
  if (
    metadata.platforms !== undefined &&
    (!Array.isArray(metadata.platforms) ||
      metadata.platforms.some((p) => !platforms.includes(p)))
  )
    throw new Error(`Unsupported platforms for ${repo.full_name}`);
  const downloads = release
    ? (release.assets || [])
        .map((a) => assetDownload(a, metadata))
        .filter(Boolean)
    : [];
  if (release && safeURL(release.zipball_url))
    downloads.push({
      platform: "Source",
      architecture: "source",
      type: "Source",
      label: "Source archive (ZIP)",
      url: release.zipball_url,
    });
  const supported = [
    ...new Set([
      ...(metadata.platforms ||
        topics.map((t) => platformTopics[t]).filter(Boolean)),
      ...downloads.map((d) => d.platform),
    ]),
  ];
  const id = repo.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!id) throw new Error(`Cannot derive a project ID for ${repo.full_name}`);
  const p = {
    id,
    slug: id,
    name: metadata.name || repo.name,
    description:
      metadata.description ||
      repo.description ||
      "Open-source project. See the repository for details.",
    category:
      metadata.category ||
      topics.map((t) => categoryTopics[t]).find(Boolean) ||
      "Developer Tools",
    tags: [
      ...new Set(
        [
          repo.language,
          ...topics.filter((t) => t !== "opensource-planet"),
        ].filter(Boolean),
      ),
    ],
    platforms: supported.length ? supported : release ? ["Source"] : [],
    license: repo.license.spdx_id,
    status: repo.archived ? "archived" : release ? "released" : "development",
    featured: metadata.featured === true || topics.includes("planet-featured"),
    byok: metadata.byok === true || topics.includes("byok"),
    version: release?.tag_name?.replace(/^v(?=\d)/, "") || "",
    repository: repo.html_url,
    documentation: metadata.documentation || "",
    demo: safeURL(repo.homepage) ? repo.homepage : "",
    releaseNotes: release?.html_url || "",
    screenshots: metadata.screenshots || [],
    downloads: repo.archived ? [] : downloads,
    updatedAt: (repo.pushed_at || repo.updated_at).slice(0, 10),
  };
  if (release) p.releasedAt = release.published_at.slice(0, 10);
  return p;
}
export async function buildCatalog(config, request, log = console.log) {
  if (
    !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(config.githubUser || "") ||
    !/^[a-z0-9][a-z0-9-]{0,49}$/.test(config.topic || "")
  )
    throw new Error("Invalid githubUser or topic in sync.config.json");
  const repos = await allPages(
    request,
    `/users/${encodeURIComponent(config.githubUser)}/repos?type=owner&sort=full_name`,
  );
  const projects = [];
  for (const candidate of repos.filter((r) => eligibleRepository(r, config))) {
    // Re-read public status/topics to avoid acting on stale listing metadata.
    const path = `/repos/${encodeURIComponent(config.githubUser)}/${encodeURIComponent(candidate.name)}`;
    const repo = await request(path);
    if (!eligibleRepository(repo, config)) continue;
    if (!licenses.includes(repo.license?.spdx_id)) {
      log(
        `Skipped ${repo.full_name}: add a recognized open-source license first.`,
      );
      continue;
    }
    const file = await request(`${path}/contents/.opensource-planet.json`, {
      optional: true,
    });
    let metadata = {};
    if (file) {
      if (
        file.type !== "file" ||
        file.encoding !== "base64" ||
        file.size > 65536 ||
        typeof file.content !== "string"
      )
        throw new Error(`Invalid .opensource-planet.json in ${repo.full_name}`);
      metadata = JSON.parse(
        Buffer.from(file.content, "base64").toString("utf8"),
      );
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
        throw new Error(`Invalid metadata in ${repo.full_name}`);
      if (metadata.screenshots?.some((s) => !safeURL(s)))
        throw new Error(
          `Use HTTPS screenshot URLs in ${repo.full_name} metadata`,
        );
    }
    const latest = await request(`${path}/releases/latest`, { optional: true });
    if (latest && (latest.draft || latest.prerelease))
      throw new Error(`Unexpected draft/prerelease for ${repo.full_name}`);
    const release = latest
      ? {
          ...latest,
          assets: await allPages(
            request,
            `${path}/releases/${latest.id}/assets`,
          ),
        }
      : null;
    const project = mapProject(repo, release, metadata);
    projects.push(project);
    log(
      `Included ${repo.full_name}: ${project.status}, ${project.downloads.length} download choices.`,
    );
  }
  projects.sort((a, b) => a.name.localeCompare(b.name, "en"));
  const catalog = { schemaVersion: 1, projects };
  const errors = validateCatalog(catalog);
  if (errors.length)
    throw new Error(
      `Generated catalog failed validation:\n${errors.join("\n")}`,
    );
  return catalog;
}
export async function syncCatalog({
  config,
  request,
  output = new URL("projects.json", root),
  dryRun = false,
  allowEmpty = false,
  log = console.log,
}) {
  const catalog = await buildCatalog(config, request, log);
  if (!catalog.projects.length && !allowEmpty && !dryRun)
    throw new Error(
      "No eligible projects found. Existing catalog unchanged. Add the topic and a recognized license, or explicitly use --allow-empty to clear the catalog.",
    );
  if (!dryRun) {
    const temporary = `${output instanceof URL ? output.pathname : output}.sync-tmp`;
    try {
      await writeFile(temporary, JSON.stringify(catalog, null, 2) + "\n");
      await rename(temporary, output);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  log(
    `${dryRun ? "Previewed" : "Synced"} ${catalog.projects.length} public, topic-matching projects.`,
  );
  return catalog;
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--dry-run", "--allow-empty"].includes(arg)))
    throw new Error(
      "Usage: node scripts/sync-projects.mjs [--dry-run] [--allow-empty]",
    );
  const config = JSON.parse(
    await readFile(new URL("sync.config.json", root), "utf8"),
  );
  await syncCatalog({
    config,
    request: githubClient({
      token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
    }),
    dryRun: args.includes("--dry-run"),
    allowEmpty: args.includes("--allow-empty"),
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
