"use strict";
/* All configuration is public. Never add secrets here. */
const CONFIG = {
  brandName: "OpenSource Planet",
  tagline: "Building free software. For everyone. Everywhere.",
  githubUser: "diveinsky",
  githubRepo: "diveinsky/opensource-planet",
  sponsorsUrl: "", // Enable only after your GitHub Sponsors page is active.
  publicEmail: "",
  enableCommunitySubmissions: true,
  enableSupportSection: true,
};
const {
  safeURL,
  repositoryURL,
  imageURL,
  validateCatalog,
  validateProject,
  selectProjects,
} = CatalogData;
const $ = (id) => document.getElementById(id);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function link(text, url, className = "button") {
  const node = make("a", className, text);
  if (safeURL(url)) {
    node.href = url;
    node.target = "_blank";
    node.rel = "noopener noreferrer";
  }
  return node;
}
const cardCache = new Map();
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const reducedMotion = () => motionPreference.matches;
motionPreference.addEventListener("change", () => {
  if (reducedMotion())
    cardCache.forEach((card) =>
      card.getAnimations?.().forEach((animation) => animation.cancel()),
    );
});
let catalogReady = false;

// Reuse cards and their images while filtering; animate only the visible changes.
function updateProjectGrid(shown) {
  const grid = $("project-grid");
  const previous = new Map(
    [...grid.children].map((node) => [node, node.getBoundingClientRect()]),
  );
  const focused = grid.contains(document.activeElement)
    ? document.activeElement
    : null;
  const cards = shown.map((project) => {
    if (!cardCache.has(project.id))
      cardCache.set(project.id, projectCard(project));
    return cardCache.get(project.id);
  });
  grid.replaceChildren(...cards);
  if (focused?.isConnected) focused.focus({ preventScroll: true });
  cards.forEach((card) =>
    card.getAnimations?.().forEach((animation) => animation.cancel()),
  );
  if (reducedMotion()) return;
  cards.forEach((card, index) => {
    if (typeof card.animate !== "function") return;
    const before = previous.get(card);
    const after = card.getBoundingClientRect();
    const x = before ? before.left - after.left : 0;
    const y = before ? before.top - after.top : 10;
    if (before && Math.abs(x) < 1 && Math.abs(y) < 1) return;
    card.animate(
      [
        { opacity: before ? 1 : 0, transform: `translate(${x}px, ${y}px)` },
        { opacity: 1, transform: "translate(0, 0)" },
      ],
      {
        duration: 220,
        delay: before ? 0 : Math.min(index, 5) * 20,
        easing: "cubic-bezier(.2,.8,.2,1)",
      },
    );
  });
}

function showLoadingCards() {
  const grid = $("project-grid");
  const status = make("p", "sr-only", "Loading the catalog…");
  status.setAttribute("role", "status");
  const placeholders = Array.from({ length: 3 }, () => {
    const card = make("div", "skeleton-card");
    card.setAttribute("aria-hidden", "true");
    card.append(
      make("div", "skeleton-preview"),
      make("div", "skeleton-line"),
      make("div", "skeleton-line short"),
      make("div", "skeleton-line"),
    );
    return card;
  });
  grid.replaceChildren(status, ...placeholders);
}

function setupNavigation() {
  if (!("IntersectionObserver" in window)) return;
  const links = [...document.querySelectorAll(".header nav a")];
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (!visible.length) return;
      const id = visible[0].target.id;
      links.forEach((link) => {
        if (link.hash === `#${id}`)
          link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-15% 0px -55% 0px", threshold: 0 },
  );
  observer.observe($("top"));
  links.forEach((link) => {
    const section = document.getElementById(link.hash.slice(1));
    if (section) observer.observe(section);
  });
}
let projects = [],
  selectedCategory = "all",
  lastFocus = null;
function setupIdentity() {
  document.querySelectorAll("[data-brand]").forEach((n) => {
    n.textContent = CONFIG.brandName;
  });
  $("tagline").textContent = CONFIG.tagline;
  $("year").textContent = new Date().getFullYear();
  const repo = repositoryURL(`https://github.com/${CONFIG.githubRepo}`)
    ? `https://github.com/${CONFIG.githubRepo}`
    : "";
  document.querySelectorAll("[data-repo]").forEach((n) => {
    if (repo) n.replaceWith(link(n.textContent, repo, n.className));
    else n.hidden = true;
  });
  document.querySelectorAll("[data-submit]").forEach((n) => {
    if (CONFIG.enableCommunitySubmissions && repo)
      n.replaceWith(
        link(
          n.textContent,
          `${repo}/issues/new?template=project-submission.yml`,
          n.className,
        ),
      );
    else n.hidden = true;
  });
  $("submission-status").textContent =
    repo && CONFIG.enableCommunitySubmissions
      ? "Public source. Open-source license. Clear ownership. No malware, misleading installers, piracy, or illegal redistribution. Maintained or useful projects preferred."
      : "Project submissions are currently unavailable.";
  $("support").hidden = !CONFIG.enableSupportSection;
  const sponsor =
    safeURL(CONFIG.sponsorsUrl) &&
    new URL(CONFIG.sponsorsUrl).hostname === "github.com" &&
    /^\/sponsors\/[a-z\d-]+\/?$/i.test(new URL(CONFIG.sponsorsUrl).pathname);
  if (sponsor)
    $("sponsor").replaceWith(link("Sponsor on GitHub", CONFIG.sponsorsUrl));
  else {
    $("sponsor").setAttribute("aria-disabled", "true");
    $("sponsor-status").textContent =
      "Sponsorship isn’t enabled yet. Contributions are always welcome.";
  }
  if (/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(CONFIG.githubUser))
    $("creator").replaceWith(
      Object.assign(
        link(
          `@${CONFIG.githubUser}`,
          `https://github.com/${CONFIG.githubUser}`,
          "",
        ),
        { id: "creator" },
      ),
    );
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(CONFIG.publicEmail)) {
    $("contact").href = `mailto:${CONFIG.publicEmail}`;
    $("contact").hidden = false;
  }
  try {
    if (localStorage.getItem("osp-theme") === "light")
      document.body.classList.add("light");
  } catch {
    /* Storage can be unavailable. */
  }
  updateThemeLabel();
  $("theme-toggle").addEventListener("click", () => {
    document.body.classList.toggle("light");
    updateThemeLabel();
    try {
      localStorage.setItem(
        "osp-theme",
        document.body.classList.contains("light") ? "light" : "dark",
      );
    } catch {
      /* Theme still works for this visit. */
    }
  });
}
function updateThemeLabel() {
  $("theme-toggle").setAttribute(
    "aria-label",
    `Switch to ${document.body.classList.contains("light") ? "dark" : "light"} theme`,
  );
}
function downloadChoices(p) {
  return p.status === "released"
    ? (p.downloads || []).filter((d) => safeURL(d.url))
    : [];
}
function preview(p) {
  if (!imageURL(p.preview || p.screenshots?.[0])) return null;
  const wrap = make("div", "preview"),
    img = make("img");
  img.src = p.preview || p.screenshots[0];
  img.alt = p.preview
    ? `${p.name} concept illustration`
    : `${p.name} screenshot`;
  img.loading = "lazy";
  img.width = 720;
  img.height = 300;
  img.addEventListener("error", () => {
    wrap.hidden = true;
  });
  wrap.append(img);
  if (p.preview) wrap.append(make("span", "preview-label", "CONCEPT PREVIEW"));
  return wrap;
}
function projectCard(p) {
  const card = make("article", "project-card"),
    visual = preview(p);
  if (visual) card.append(visual);
  const body = make("div", "card-body"),
    head = make("div", "card-heading"),
    titles = make("div");
  titles.append(
    make("h3", "", p.name),
    make(
      "span",
      "project-status",
      p.status === "released"
        ? `Released · v${p.version}`
        : `${p.status} · ${p.status === "draft" ? "Concept project" : "No current release"}`,
    ),
  );
  head.append(make("span", "project-icon", p.icon || "</>"), titles);
  const tags = make("div", "tags");
  p.tags.slice(0, 4).forEach((t) => tags.append(make("span", "tag", t)));
  if (p.byok) tags.append(make("span", "tag byok", "BYOK"));
  const footer = make("div", "card-footer");
  footer.append(
    make(
      "span",
      "card-meta",
      p.platforms.join(" · ") || "Platforms to be confirmed",
    ),
  );
  const button = make(
    "button",
    "button",
    downloadChoices(p).length ? "Download" : "View details",
  );
  button.type = "button";
  button.setAttribute("aria-label", `${button.textContent}: ${p.name}`);
  button.addEventListener("click", () => openProject(p));
  footer.append(button);
  body.append(
    head,
    make("p", "project-description", p.description),
    tags,
    footer,
  );
  card.append(body);
  return card;
}
function renderCatalog() {
  if (!catalogReady) return;
  const shown = selectProjects(projects, {
    search: $("search").value,
    category: selectedCategory,
    platform: $("platform").value,
    sort: $("sort").value,
  });
  updateProjectGrid(shown);
  $("project-count").textContent =
    `${shown.length} ${shown.length === 1 ? "project" : "projects"}`;
  $("catalog-message").hidden = shown.length > 0;
  $("message-title").textContent = projects.length
    ? "Nothing in this orbit. Yet."
    : "The collection is just getting started.";
  $("message-text").textContent = projects.length
    ? "Try a different keyword, category, or platform."
    : "There are no projects to show right now. Check back soon.";
  $("reset").hidden = !projects.length;
  $("retry").hidden = true;
  document
    .querySelectorAll(".filter-button")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.category === selectedCategory),
      ),
    );
}
function renderReleases() {
  const released = projects
    .filter((p) => p.status === "released")
    .sort(
      (a, b) =>
        (Date.parse(b.releasedAt) || 0) - (Date.parse(a.releasedAt) || 0),
    )
    .slice(0, 5);
  const list = $("release-list");
  list.replaceChildren();
  if (!released.length) {
    const empty = make("div", "release-empty"),
      copy = make("div");
    copy.append(
      make("h3", "", "Good things are still being built."),
      make(
        "p",
        "",
        "No published releases yet. When a project ships, its version, release notes, and downloads will appear here.",
      ),
    );
    empty.append(make("span", "", "◷"), copy);
    list.append(empty);
    return;
  }
  released.forEach((p) => {
    const row = make("article", "release-row"),
      info = make("div");
    info.append(
      make("strong", "", `${p.name} · v${p.version}`),
      make(
        "p",
        "",
        `${p.releasedAt} · ${p.platforms.join(", ")} · Maintainer-curated`,
      ),
    );
    row.append(
      info,
      link(
        "Release notes",
        p.releaseNotes || `${p.repository.replace(/\/$/, "")}/releases`,
        "text-link",
      ),
    );
    list.append(row);
  });
}
async function loadProjects() {
  $("project-grid").setAttribute("aria-busy", "true");
  $("catalog-message").hidden = true;
  $("retry").disabled = true;
  catalogReady = false;
  cardCache.clear();
  showLoadingCards();
  ["search", "platform", "sort"].forEach((id) => {
    $(id).disabled = true;
  });
  try {
    const response = await fetch("projects.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.projects))
      throw new Error("Unsupported catalog format");
    const errors = validateCatalog(data);
    if (errors.length) console.warn("Catalog validation:", errors);
    // Reject individual invalid entries and all duplicate identities, without losing valid entries.
    const counts = new Map();
    data.projects.forEach((p) =>
      ["id", "slug", "repository", "name"].forEach((k) => {
        if (typeof p?.[k] !== "string" || !p[k]) return;
        const key = `${k}:${p[k]
          .trim()
          .toLowerCase()
          .replace(/\.git\/?$|\/$/g, "")}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }),
    );
    projects = data.projects.filter(
      (p) =>
        !validateProject(p).length &&
        !["id", "slug", "repository", "name"].some(
          (k) =>
            typeof p[k] === "string" &&
            p[k] &&
            counts.get(
              `${k}:${p[k]
                .trim()
                .toLowerCase()
                .replace(/\.git\/?$|\/$/g, "")}`,
            ) > 1,
        ),
    );
    if (data.projects.length && !projects.length)
      throw new Error("No valid project records");
    $("categories").replaceChildren();
    ["all", ...new Set(projects.map((p) => p.category))].forEach((category) => {
      const b = make(
        "button",
        "filter-button",
        category === "all" ? "All projects" : category,
      );
      b.type = "button";
      b.dataset.category = category;
      b.addEventListener("click", () => {
        selectedCategory = category;
        renderCatalog();
      });
      $("categories").append(b);
    });
    $("platform").replaceChildren(
      new Option("All platforms", "all"),
      ...[...new Set(projects.flatMap((p) => p.platforms))]
        .sort()
        .map((p) => new Option(p, p)),
    );
    selectedCategory = "all";
    catalogReady = true;
    ["search", "platform", "sort"].forEach((id) => {
      $(id).disabled = false;
    });
    $("catalog-note").textContent =
      projects.length && projects.every((p) => p.status === "draft")
        ? "The catalog starts here. Current entries are draft concepts, with no published releases or downloads."
        : "Explore independent projects. Check each project's status, license, and supported platforms before getting started.";
    renderCatalog();
    const featured = projects.filter((p) => p.featured).slice(0, 2);
    $("featured-grid").replaceChildren(...featured.map(projectCard));
    $("featured").hidden = !featured.length;
    renderReleases();
    if (projects.length < data.projects.length) {
      $("catalog-message").hidden = false;
      $("message-title").textContent = "Some entries couldn’t be displayed.";
      $("message-text").textContent =
        "Their project data needs attention. The remaining catalog is available above.";
      $("reset").hidden = true;
    }
  } catch (error) {
    projects = [];
    $("categories").replaceChildren();
    $("project-grid").replaceChildren();
    $("featured").hidden = true;
    $("release-list").replaceChildren(
      make("p", "muted", "Release information is temporarily unavailable."),
    );
    $("project-count").textContent = "Catalog unavailable";
    $("catalog-message").hidden = false;
    $("message-title").textContent = "We couldn’t load the catalog.";
    $("message-text").textContent =
      "Please try again. If you opened this file directly, serve the folder over HTTP.";
    $("retry").hidden = false;
    $("reset").hidden = true;
    console.error("Catalog load failed:", error);
  } finally {
    $("project-grid").setAttribute("aria-busy", "false");
    $("retry").disabled = false;
  }
}
function openProject(p) {
  lastFocus = document.activeElement;
  const content = $("dialog-content");
  content.replaceChildren();
  const title = make("h2", "", p.name);
  title.id = "dialog-title";
  content.append(
    title,
    make(
      "span",
      "project-status",
      p.status === "released"
        ? `Released · v${p.version}`
        : `${p.status} · No published download`,
    ),
    make("p", "", p.longDescription || p.description),
  );
  if (p.preview)
    content.append(
      make(
        "p",
        "muted",
        "Concept illustration only. This is not a screenshot of released software.",
      ),
    );
  const images = p.screenshots.length
    ? p.screenshots
    : p.preview
      ? [p.preview]
      : [];
  images.filter(imageURL).forEach((src, i) => {
    const img = make("img", "detail-image");
    img.src = src;
    img.alt = `${p.name} ${p.screenshots.length ? "screenshot" : "concept illustration"} ${i + 1}`;
    img.loading = "lazy";
    content.append(img);
  });
  const metadata = make("div", "detail-metadata");
  [
    p.category,
    ...p.platforms,
    p.license || "License not declared",
    p.version ? `Version ${p.version}` : "Not versioned",
  ].forEach((t) => metadata.append(make("span", "tag", t)));
  content.append(metadata);
  if (p.byok)
    content.append(
      make(
        "p",
        "muted",
        "BYOK: bring your own provider key inside the individual application. Provider charges may apply. Never submit credentials to this website.",
      ),
    );
  const downloads = downloadChoices(p);
  if (downloads.length) {
    content.append(make("h3", "", "Choose your download"));
    const list = make("div", "download-list");
    downloads.forEach((d) => {
      const a = link(d.label, d.url);
      a.append(
        make(
          "span",
          "card-meta",
          `${d.platform} · ${d.architecture} · ${d.type}`,
        ),
      );
      list.append(a);
    });
    content.append(
      list,
      make(
        "p",
        "muted",
        "Assets are provided by the project maintainer. Review release notes and any published checksums before installing.",
      ),
    );
  } else
    content.append(
      make(
        "p",
        "muted",
        p.repository
          ? "No downloadable assets are listed. Explore the repository for source and setup instructions."
          : "This is a draft concept. Source code, licensing, and downloads have not been published.",
      ),
    );
  const links = make("div", "detail-links");
  if (repositoryURL(p.repository)) {
    links.append(
      link(downloads.length ? "Source code" : "View Repository", p.repository),
    );
    links.append(
      link("All Releases", `${p.repository.replace(/\/$/, "")}/releases`),
    );
  }
  if (safeURL(p.releaseNotes))
    links.append(link("Release notes", p.releaseNotes));
  if (safeURL(p.documentation))
    links.append(link("Documentation", p.documentation));
  if (safeURL(p.demo)) links.append(link("Open demo", p.demo));
  content.append(links);
  $("project-dialog").showModal();
  document.body.classList.add("modal-open");
  $("close-dialog").focus();
}
setupIdentity();
setupNavigation();
$("search").addEventListener("input", renderCatalog);
$("platform").addEventListener("change", renderCatalog);
$("sort").addEventListener("change", renderCatalog);
$("retry").addEventListener("click", loadProjects);
$("reset").addEventListener("click", () => {
  $("search").value = "";
  $("platform").value = "all";
  $("sort").value = "name";
  selectedCategory = "all";
  renderCatalog();
  $("search").focus();
});
$("close-dialog").addEventListener("click", () => $("project-dialog").close());
$("project-dialog").addEventListener("click", (e) => {
  if (e.target === $("project-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
$("project-dialog").addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  if (lastFocus?.isConnected) lastFocus.focus();
});
loadProjects();
