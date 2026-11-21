# OpenSource Planet v3

**Building free software. For everyone. Everywhere.**

A responsive, dark-first open-source software catalog built on the existing static portfolio. HTML, CSS, and vanilla JavaScript; no backend, runtime dependencies, analytics, mandatory build, or accounts. Optional light theme preference stays in local storage. Catalog filtering reuses cards and images, with short layout transitions, loading placeholders, and an active navigation indicator. Dialog and theme transitions respect reduced-motion preferences; mobile controls have larger touch targets.

The original four concept entries are retained as **drafts**. Their illustrations are labeled concept previews, not released product screenshots. No repositories, licenses, release versions, or download assets have been invented. Planned platforms and features are unconfirmed. Replace drafts as real projects become available.

## Run locally

Use Node 24+ for validation, and any static HTTP server for preview:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Do not double-click `index.html`: fetching JSON requires HTTP. The website itself does not require Node or Python on the host.

## Files

- `index.html`, `styles.css`, `app.js`: layout, responsive themes, catalog, dialog, and public configuration.
- `projects.json`: all project content, using the versioned envelope below.
- `schema.js`: shared browser/CI rules and pure search/filter/sort logic.
- `assets/images/`, `assets/icons/`: original local concept illustrations and icons.
- `scripts/sync-projects.mjs`, `scripts/publish-synced-catalog.mjs`: manual import and workflow publication; `sync.config.json` holds the account/topic.
- `scripts/validate-projects.mjs`, `tests/`: dependency-free validation and tests; optional browser regression script.
- `.github/`: validation workflow, submission/bug/feature forms, PR template.
- `_headers`: additional Cloudflare security headers; HTML contains a CSP for GitHub Pages too.
- `.nojekyll`: serves files without Jekyll processing. No client-side router or rewrite rules needed.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`: contribution and community terms. The website remains MIT; listed projects retain their own licenses.

## Configure identity and optional links

Edit `CONFIG` at the top of `app.js`:

| Setting                      | Default / purpose                                                   |
| ---------------------------- | ------------------------------------------------------------------- |
| `brandName`, `tagline`       | OpenSource Planet and its mission                                   |
| `githubUser`                 | `diveinsky`, inferred from this repository's remote                 |
| `githubRepo`                 | `diveinsky/opensource-planet`; used for source and submission links |
| `sponsorsUrl`                | Empty; set your active `https://github.com/sponsors/USERNAME` page  |
| `publicEmail`                | Empty; optional publicly visible address                            |
| `enableCommunitySubmissions` | `true`; hide submission buttons with `false`                        |
| `enableSupportSection`       | `true`; hide the section with `false`                               |

Verify the inferred GitHub identity before publishing. No other configuration is required. Sponsorship remains unavailable until explicitly configured; no payment data or API keys are collected. Complete GitHub Sponsors onboarding separately, then optionally add `.github/FUNDING.yml` with your approved handle. Software remains free. BYOK means provider credentials belong inside the individual application and provider usage may incur charges.

## Manual GitHub sync (recommended for your own projects)

No scheduled or push-triggered sync is configured. Listings refresh only when you run the command or manually dispatch the workflow. You do not maintain a central entry for every project.

### Choose what appears

1. In each public project repository, open **About → settings gear → Topics** and add `opensource-planet`.
2. Add a recognized open-source license. Repositories without a license from the approved SPDX list in `schema.js` are skipped with a clear log message.
3. Set the About description and Website URL; publish an actual GitHub Release and upload installers when available.
4. Trigger a sync whenever you want to update the website.

`sync.config.json` sets the account (`diveinsky`) and topic (`opensource-planet`) once. Sync uses the public user-repository API, then rechecks ownership, public status, and the exact topic. It never imports repositories from another account or private repositories, even when an authenticated token can access them. Forks are eligible only when explicitly tagged and owned by the configured account.

The generated catalog **replaces** `projects.json`: it is a snapshot of the eligible tagged projects, not a merge with old samples or manual entries. Removing the topic removes a listing at the next sync. Making a repository private also takes effect at the next sync; there is no background polling. The four existing drafts remain until your first successful sync. If no eligible projects are found, sync stops without changing the catalog; deliberately clearing it requires `--allow-empty` or the workflow's matching checkbox.

### Run from your terminal

```sh
# Preview without changing any files
node scripts/sync-projects.mjs --dry-run

# Fetch metadata and replace projects.json
node scripts/sync-projects.mjs
node scripts/validate-projects.mjs --check-links

git add projects.json
git commit -m "Sync GitHub projects"
git push origin main
```

No token is required for public metadata, but GitHub's unauthenticated rate limits apply. If needed, supply `GH_TOKEN` through your existing shell/credential environment; never put credentials in configuration files, frontend code, command arguments, or commits. API failures, malformed metadata, schema errors, normalization collisions, and rate limits abort before the local file is replaced. `--dry-run` prints the selected projects and never modifies the catalog.

### Run from GitHub's website

After this implementation is pushed to the default branch:

1. Open **Actions → Sync projects (manual) → Run workflow**.
2. Select the default branch and leave **allow_empty** unchecked unless you intend to clear the catalog.
3. Click **Run workflow**. It fetches metadata, validates links/schema, and commits only `projects.json` if its content changed.
4. For GitHub Pages configured as **Deploy from a branch → default branch → /(root)**, it explicitly requests a rebuild. Check the Pages deployment status afterward; a requested build is not a completed deployment.

The manual workflow uses GitHub's automatic `GITHUB_TOKEN` with `contents: write` and `pages: write`; no personal token or frontend secret is needed. Checkout credentials are not persisted. The workflow is restricted to the default branch and serialized to avoid competing syncs. It refuses to overwrite a catalog modified during the run. Protected branches may require the local command followed by a normal PR instead of the workflow's direct commit.

If Pages is not configured, the workflow saves the catalog and explains that hosting setup is needed. If Pages uses a different branch, `/docs`, or a custom Actions deployment, the catalog is saved but the run reports that a separate deployment is needed; it never silently changes hosting settings. Connected Cloudflare Pages can deploy the catalog commit through its existing Git integration. GitHub's bot commits do not automatically trigger every other Actions workflow, so this workflow validates before committing and explicitly requests the supported Pages rebuild itself.

### What sync derives

| Website content                | GitHub source                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Name, description, source code | Repository metadata                                                                                            |
| Demo                           | HTTPS Website field in About                                                                                   |
| License                        | GitHub-detected SPDX identifier                                                                                |
| Tags                           | Primary language and repository topics                                                                         |
| Category                       | `desktop`, `ai-tools`/`ai`, `cli`, `developer-tools`, `web`, or `mobile` topic; Developer Tools is the default |
| Spotlight / BYOK               | `planet-featured` / `byok` topic                                                                               |
| Platforms                      | `windows`, `linux`, `macos`, `android`, `ios`, `web` topics and recognized release asset formats/names         |
| Version, date, notes           | Latest stable published release; drafts/prereleases are excluded                                               |
| Downloads                      | Actual uploaded assets and GitHub's provided source archive URL                                                |

Repositories without a stable release are marked development and get a source link, with no download choices. Source-only releases use the **Source** platform. The sync identifies EXE/MSI, AppImage/DEB/RPM, DMG/PKG, and APK packages by format. ZIP files need an unambiguous platform in their filename or optional mapping; it does not guess that a generic ZIP runs on Windows. Unrecognized packages remain accessible through **All Releases**. CPU architecture is inferred only from clear filename markers; otherwise it is shown as “Not specified.” Release files are never executed.

### Optional per-project customization

Most repositories need no extra file. If desired, add `.opensource-planet.json` to the project's default branch:

```json
{
  "name": "Friendly project name",
  "category": "Desktop",
  "platforms": ["Windows", "Linux"],
  "featured": true,
  "byok": false,
  "documentation": "https://your-actual-docs-host/path",
  "screenshots": ["https://your-actual-image-host/screenshot.png"],
  "assetPlatforms": {
    "exact-uploaded-asset.zip": { "platform": "Windows", "architecture": "x64" }
  }
}
```

Use real HTTPS URLs and actual uploaded asset names. Supported optional fields are name, description, category, platforms, featured, byok, documentation, screenshots and assetPlatforms. This file can customize display details but cannot replace GitHub-provided repository/download URLs, public/topic eligibility, or license requirements. No README parsing, remote scripts, or project binaries are executed. Screenshots require HTTPS URLs, not paths relative to the catalog repository.

## Add or update a project

Use exactly one top-level format:

```json
{
  "schemaVersion": 1,
  "projects": []
}
```

Copy an existing record in `projects.json`, assign unique lowercase hyphenated `id` and `slug`, and fill these fields:

| Fields                                  | Rules                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `name`, `description`                   | Nonempty plain text. Search includes both and `tags`.                                    |
| `longDescription`, `icon`               | Optional plain text; description and generic icon are fallbacks.                         |
| `category`                              | Desktop, AI Tools, CLI / Utilities, Web, Developer Tools, Mobile                         |
| `tags`                                  | Array of nonempty strings                                                                |
| `platforms`                             | Array: Windows, Linux, macOS, Android, iOS, Web, Source; drafts indicate plans           |
| `status`                                | `draft`, `development`, `released`, `archived`                                           |
| `featured`, `byok`                      | Required booleans; first two featured records appear in the spotlight                    |
| `license`                               | An approved SPDX identifier from `schema.js`; empty allowed for unreleased concepts only |
| `version`                               | String; required for released projects; no leading `v` needed                            |
| `repository`                            | Actual HTTPS GitHub owner/repository URL; required for released projects                 |
| `documentation`, `demo`, `releaseNotes` | Optional HTTPS URLs; empty or omitted disables the corresponding link                    |
| `updatedAt`, `releasedAt`               | Optional real `YYYY-MM-DD` dates; `releasedAt` required for released projects            |
| `screenshots`                           | Array of `assets/images/...` paths or HTTPS image URLs; use actual screenshots           |
| `preview`                               | Optional concept illustration; labeled explicitly as a concept                           |
| `downloads`                             | Required array; empty if no assets. Downloads only allowed for `released` records.       |

The validator rejects duplicate IDs, slugs, names (case-insensitive), and repositories (also normalizing trailing slash and `.git`). It deliberately uses an approved subset of SPDX identifiers instead of accepting arbitrary license-looking text; propose additions through review. Compound SPDX expressions are not supported yet.

The browser validates records, skips malformed/duplicate entries, and warns when part of the catalog is unusable. CI rejects any invalid catalog. Missing optional content has a fallback; data load failure shows a retry message. Text is rendered with DOM text nodes, never untrusted HTML. External links require HTTPS and reject credentials and placeholder owners.

### Publish real releases and downloads

1. Build and test the software in its own repository. Confirm its open-source license and ownership.
2. On that repository's GitHub Releases page, create a tag and release with version, release notes, supported platforms and checksums if provided.
3. Upload the actual platform packages. Never guess asset filenames or claim unperformed safety verification.
4. Copy the real asset links into `downloads`. Each record needs `platform`, `architecture`, `type`, `label`, `url`. The platform must also appear in `platforms`; use `Source` for source archives.
5. Supported package types: EXE, MSI, ZIP, AppImage, DEB, RPM, DMG, PKG, APK, Source. Architectures are plain strings such as `x64`, `arm64`, `universal` or `source`.
6. GitHub's stable pattern is `https://github.com/{actual-owner}/{actual-repo}/releases/latest/download/{exact-uploaded-filename}`. Substitute only observed values; ensure the asset exists on the latest stable release. Version-specific links are also supported.
7. Set `status: "released"`, real `version`, `releasedAt`, `license`, repository, and screenshots. Provide documentation and release notes where available. Remove a concept `preview` when replacing it with screenshots.
8. Run validation and open a reviewed PR. Entries without downloadable assets show **View Repository** in the detail dialog. All Releases is available when a repository exists. Nothing auto-executes.

Latest Releases reads the saved JSON, sorted by release date. The browser makes no GitHub API calls and receives no tokens. Update metadata with a manual sync after publishing a release, or maintain entries manually if you are not using sync.

## Submit and review

“Submit your project” opens the repository's GitHub Issue Form. A GitHub account is needed to post an issue; there is no separate website account. Issues are public. The form gathers name, repository, description, category, stack, platforms, license, optional demo/release URL, and optional public contact.

A maintainer checks public source, recognized license, attribution, release status, ownership, usefulness, and honest installers. Reject malware, misleading installers, piracy and illegal redistribution. Approved submissions become a manually reviewed PR editing `projects.json`; no issue auto-publishes and no workflow auto-merges. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Validate

```sh
node --check app.js
node --check schema.js
node --check scripts/validate-projects.mjs
node --test tests/catalog.test.mjs tests/sync.test.mjs
node scripts/validate-projects.mjs --check-links
```

If a sandbox prevents Node's isolated test subprocess, use `node --test --test-isolation=none tests/catalog.test.mjs tests/sync.test.mjs` (Node 24).

CI runs on relevant pull requests, main-branch pushes, and manual dispatch with `contents: read`, no persisted checkout credentials, and no dependencies to install. It checks JSON, the shared schema, duplicate identities, SPDX allowlist, local images and configured external URLs. HTTP 404/410 fails; 401/403/429, server errors, timeouts, and network failures warn for manual review. Other unusual statuses also warn. HEAD is used first with a minimal ranged GET fallback for servers that reject HEAD; binaries are never executed. A successful check is not an antivirus or ownership guarantee. Protect `main` and require review plus the validation check in GitHub settings; repository code cannot enforce those settings itself.

For optional browser checks, install Playwright outside the repository, ensure Chromium is available, serve the repository's parent folder on port 8000, then run:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/browser.mjs
```

Screenshots are written to ignored `artifacts/`. The script checks the real catalog, keyboard dialog behavior, responsive overflow, subpath refresh, malicious/invalid data handling, and release/download fixtures. Test fixtures do not advertise real software.

## Publish to GitHub Pages

1. Review `CONFIG` and replace drafts only with confirmed project data. Run the checks above.
2. Commit all site files, `.nojekyll`, assets, `projects.json`, and shared schema to this repository; push to `main`.
3. In GitHub, open **Settings → Pages → Build and deployment**.
4. Select **Deploy from a branch**, branch **main**, folder **/(root)**, then **Save**.
5. Wait for the Pages deployment to complete. Visit `https://diveinsky.github.io/opensource-planet/` (or your configured owner/repository URL).
6. Check search, images, a detail dialog, and refresh at `#projects`. Future pushes to `main` publish updates.

All asset and fetch paths are relative, so the same files work at a domain root and a repository subpath. The validation workflow checks data; GitHub's Pages service handles publication. No site has been deployed by this implementation task.

Official guide: [Configure a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Publish to Cloudflare Pages

Connect the Git repository under Workers & Pages → Create → Pages. Select framework **None**, leave the build command empty (or use `exit 0` if required) and output directory `.` (repository root). Deploy the default branch. No environment variables, API keys, Functions or SPA redirects are needed. `_headers` adds CSP, framing, MIME, referrer and permission protections; GitHub Pages uses the CSP meta tag but does not process `_headers`.

Official guides: [Static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) and [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Troubleshooting and limits

- Empty catalog/error: serve over HTTP, inspect the network response for `projects.json`, confirm the envelope and run the validator. Retry handles temporary failures.
- Download missing: non-released entries cannot have assets; empty/dangerous asset URLs fail validation. Do not publish placeholders.
- Optional links unavailable: configure actual HTTPS destinations. Sponsors requires an explicitly active page.
- Images missing: preserve case-sensitive paths; CSP allows local and HTTPS images only. Concept previews are not product screenshots.
- Subpath 404s: deploy files at the publishing root and retain relative paths. Navigation uses hashes, not server routes.
- Restricted browser storage: theme still toggles, but may not persist. External images, if added, make a request to their host; local assets are preferred.
- External checks inconclusive: inspect logs and check links manually later; a warning is not verification.
- No browser-side release API calls, download counts, user accounts, scheduled sync, tracking or backend. Manual workflow dispatch can publish your selected projects. Only real project maintainers can supply future release artifacts.
