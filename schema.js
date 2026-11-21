/* Shared, dependency-free catalog rules for the browser and CI. */
"use strict";
(() => {
  const categories = [
    "Desktop",
    "AI Tools",
    "CLI / Utilities",
    "Web",
    "Developer Tools",
    "Mobile",
  ];
  const platforms = [
    "Windows",
    "Linux",
    "macOS",
    "Android",
    "iOS",
    "Web",
    "Source",
  ];
  const statuses = ["released", "development", "draft", "archived"];
  // Deliberate approved SPDX subset. Extend through a reviewed PR when needed.
  const licenses = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "GPL-2.0-only",
    "GPL-2.0-or-later",
    "GPL-3.0-only",
    "GPL-3.0-or-later",
    "LGPL-2.1-only",
    "LGPL-2.1-or-later",
    "LGPL-3.0-only",
    "LGPL-3.0-or-later",
    "AGPL-3.0-only",
    "AGPL-3.0-or-later",
    "MPL-2.0",
    "ISC",
    "Unlicense",
    "CC0-1.0",
    "Zlib",
    "BSL-1.0",
    "EPL-2.0",
  ];
  const types = [
    "EXE",
    "MSI",
    "ZIP",
    "AppImage",
    "DEB",
    "RPM",
    "DMG",
    "PKG",
    "APK",
    "Source",
  ];
  function safeURL(value) {
    if (typeof value !== "string" || !value || value.trim() !== value)
      return false;
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        u.hostname !== "example.com" &&
        !/^\/(YOUR_USERNAME|OWNER)(\/|$)/i.test(u.pathname)
      );
    } catch {
      return false;
    }
  }
  function repositoryURL(value) {
    if (!safeURL(value)) return false;
    const u = new URL(value);
    return (
      u.hostname === "github.com" &&
      !u.search &&
      !u.hash &&
      /^\/[a-z\d-]+\/[a-z\d_.-]+\/?$/i.test(u.pathname)
    );
  }
  function imageURL(value) {
    return (
      typeof value === "string" &&
      ((/^assets\/images\/[a-z\d_/-]+\.(svg|png|webp|jpe?g)$/i.test(value) &&
        !value.includes("..")) ||
        safeURL(value))
    );
  }
  function validateProject(p) {
    const errors = [];
    if (!p || typeof p !== "object" || Array.isArray(p))
      return ["must be an object"];
    for (const key of ["id", "slug"])
      if (
        typeof p[key] !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p[key])
      )
        errors.push(
          `${key}: use lowercase letters, numbers and single hyphens`,
        );
    for (const key of ["name", "description"])
      if (typeof p[key] !== "string" || !p[key].trim())
        errors.push(`${key}: a nonempty string is required`);
    if (!categories.includes(p.category))
      errors.push(`category: choose ${categories.join(", ")}`);
    if (!statuses.includes(p.status))
      errors.push(`status: choose ${statuses.join(", ")}`);
    if (typeof p.featured !== "boolean")
      errors.push("featured: must be a boolean");
    if (typeof p.byok !== "boolean") errors.push("byok: must be a boolean");
    for (const key of ["tags", "platforms", "screenshots", "downloads"])
      if (!Array.isArray(p[key])) errors.push(`${key}: must be an array`);
    if (
      Array.isArray(p.tags) &&
      p.tags.some((t) => typeof t !== "string" || !t.trim())
    )
      errors.push("tags: use nonempty strings");
    if (
      Array.isArray(p.platforms) &&
      (new Set(p.platforms).size !== p.platforms.length ||
        p.platforms.some((t) => !platforms.includes(t)))
    )
      errors.push(`platforms: use unique values from ${platforms.join(", ")}`);
    if (p.license !== "" && !licenses.includes(p.license))
      errors.push("license: use an approved SPDX identifier (see schema.js)");
    if (p.repository && !repositoryURL(p.repository))
      errors.push(
        "repository: must be an HTTPS github.com/owner/repository URL",
      );
    if (
      p.status === "released" &&
      (!repositoryURL(p.repository) ||
        !licenses.includes(p.license) ||
        !p.version ||
        !p.platforms?.length)
    )
      errors.push(
        "released projects require a repository, approved license, version and platforms",
      );
    for (const key of ["repository", "documentation", "demo", "releaseNotes"])
      if (p[key] !== undefined && typeof p[key] !== "string")
        errors.push(`${key}: must be a string`);
    for (const key of ["documentation", "demo", "releaseNotes"])
      if (p[key] && !safeURL(p[key]))
        errors.push(
          `${key}: must be a valid HTTPS URL without credentials or placeholders`,
        );
    for (const key of ["longDescription", "version", "icon"])
      if (p[key] !== undefined && typeof p[key] !== "string")
        errors.push(`${key}: must be a string`);
    for (const key of ["updatedAt", "releasedAt"])
      if (
        p[key] &&
        (typeof p[key] !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p[key]) ||
          !Number.isFinite(Date.parse(p[key])) ||
          new Date(p[key]).toISOString().slice(0, 10) !== p[key])
      )
        errors.push(`${key}: use a real YYYY-MM-DD date`);
    if (p.status === "released" && !p.releasedAt)
      errors.push("releasedAt: required for released projects");
    if (Array.isArray(p.screenshots) && p.screenshots.some((s) => !imageURL(s)))
      errors.push("screenshots: use assets/images paths or HTTPS URLs");
    if (p.preview !== undefined && !imageURL(p.preview))
      errors.push("preview: use an assets/images path or HTTPS URL");
    if (p.status !== "released" && p.downloads?.length)
      errors.push("downloads: only released projects may offer downloads");
    if (Array.isArray(p.downloads))
      p.downloads.forEach((d, i) => {
        if (!d || typeof d !== "object") {
          errors.push(`downloads[${i}]: must be an object`);
          return;
        }
        if (!safeURL(d.url))
          errors.push(
            `downloads[${i}].url: a real HTTPS asset URL is required`,
          );
        if (!platforms.includes(d.platform) && d.platform !== "Source")
          errors.push(`downloads[${i}].platform: unsupported platform`);
        if (
          d.platform !== "Source" &&
          (!Array.isArray(p.platforms) || !p.platforms.includes(d.platform))
        )
          errors.push(
            `downloads[${i}].platform: must be included in project platforms`,
          );
        if (!types.includes(d.type))
          errors.push(`downloads[${i}].type: unsupported package type`);
        for (const key of ["architecture", "label"])
          if (typeof d[key] !== "string" || !d[key].trim())
            errors.push(`downloads[${i}].${key}: required`);
      });
    return errors;
  }
  function validateCatalog(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.projects))
      return ['Use { "schemaVersion": 1, "projects": [...] }'];
    const errors = [],
      seen = {
        id: new Set(),
        slug: new Set(),
        repository: new Set(),
        name: new Set(),
      };
    data.projects.forEach((p, i) => {
      validateProject(p).forEach((e) =>
        errors.push(`projects[${i}] ${p?.id || ""}: ${e}`),
      );
      if (!p || typeof p !== "object") return;
      for (const key of Object.keys(seen)) {
        const v =
          typeof p[key] === "string"
            ? p[key]
                .trim()
                .toLowerCase()
                .replace(/\.git\/?$|\/$/g, "")
            : "";
        if (!v) continue;
        if (seen[key].has(v))
          errors.push(`projects[${i}]: duplicate ${key} "${v}"`);
        seen[key].add(v);
      }
    });
    return errors;
  }
  function selectProjects(
    projects,
    { search = "", category = "all", platform = "all", sort = "name" } = {},
  ) {
    const query = search.trim().toLowerCase();
    return projects
      .filter(
        (p) =>
          (category === "all" || p.category === category) &&
          (platform === "all" || p.platforms.includes(platform)) &&
          [p.name, p.description, ...p.tags]
            .join(" ")
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) => {
        const tie = a.name.localeCompare(b.name);
        if (sort === "updated")
          return (
            (Date.parse(b.updatedAt || "") || 0) -
              (Date.parse(a.updatedAt || "") || 0) || tie
          );
        if (sort === "status")
          return statuses.indexOf(a.status) - statuses.indexOf(b.status) || tie;
        return tie;
      });
  }
  const api = {
    categories,
    platforms,
    statuses,
    licenses,
    types,
    safeURL,
    repositoryURL,
    imageURL,
    validateProject,
    validateCatalog,
    selectProjects,
  };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.CatalogData = api;
})();
