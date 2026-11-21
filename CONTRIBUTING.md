# Contributing to OpenSource Planet

Thank you for helping make free software easier to discover. Follow our [Code of Conduct](CODE_OF_CONDUCT.md). The catalog is curated manually, with changes reviewed before publication.

## Suggest a project

Use **Submit your project** on the website or GitHub's New Issue → Submit a project form. Provide the project's name, public GitHub repository, description, category, tech stack, platforms, and open-source license. Demo, release links and public maintainer contact are optional. Never post passwords, tokens, provider keys, or private contact details.

Projects need publicly accessible source, a recognized open-source license, clear ownership and attribution, and honest descriptions and installers. No malware, misleading installers, piracy, or illegally redistributed software. Maintained or useful projects are preferred. If you are not the maintainer, say so and credit the owner. Submission does not guarantee inclusion.

## Maintainer review

1. Confirm repository ownership, source availability, attribution and actual license text. Check whether the project is maintained or useful.
2. Compare claims and platforms with the repository. Confirm release status, screenshots and any actual downloadable assets. Never invent filenames or claim unperformed security verification.
3. Review the submission policy above. Request missing evidence in the issue; close unsuitable submissions with a clear reason.
4. For approved proposals, create or request a PR adding `projects.json` data and local images. Link the submission issue. No automation publishes issues.
5. Review CI errors and all inconclusive link warnings manually. Review the actual diff, not just the green check. Require an independent reviewer where practical; configure branch protections and required checks in repository settings.
6. Merge only after approval. The configured Pages service deploys the merged static files. No automatic merging is provided.

## Owner-managed manual sync

The maintainer may explicitly sync only public repositories owned by the account in `sync.config.json` and tagged `opensource-planet`. The command replaces the catalog with that selected set. There is no scheduled sync; the manual workflow may commit and request a Pages rebuild when deliberately run by someone with repository workflow access. Keep community suggestions under human review: issues never tag repositories, import projects, or trigger publication. Read the manual sync section in README before editing a generated catalog; the next sync replaces manual edits. An approved community project needs a separately chosen curation workflow or a future explicit owner allowlist change.

## Make changes

Fork, create a focused branch, and run a local HTTP server as described in [README.md](README.md). Keep the buildless HTML/CSS/vanilla JavaScript structure. Share rules between browser and CI in `schema.js`. Use DOM creation and `textContent`, not untrusted HTML. Use HTTPS links and no credentials, trackers or runtime CDNs.

For data changes, follow the README field table. For downloads, upload real assets to the project's GitHub release first, then copy their exact URLs. Keep `downloads: []` when no asset is available. A released record requires a repository, approved SPDX license, version, platforms, and release date. New license allowlist entries need evidence that the identifier is recognized and open source.

Run:

```sh
node --check app.js
node --check schema.js
node --check scripts/validate-projects.mjs
node --test tests/catalog.test.mjs tests/sync.test.mjs
node scripts/validate-projects.mjs --check-links
```

Check mobile and desktop layouts, keyboard navigation, search, combined filters, sorting, dialogs (close button, Escape, focus return), and the GitHub Pages subpath. For optional browser regression setup see README. Include actual results and relevant screenshots in your PR; disclose any checks you could not run. Avoid adding dependencies for work that the platform already supports.

## Report problems or propose improvements

Use the bug or feature issue form with reproduction steps or a concrete use case. Bugs in listed software belong in that software's repository. For a credential exposure, revoke it immediately and avoid repeating it in public issues. An optional public contact is configurable by the maintainer; if absent, discuss general concerns without publishing exploit details or private data.

## Licensing

Website contributions are under the existing MIT license. You must have permission to share submitted text, screenshots and icons. Each catalog project retains its own license; listing it does not relicense it or imply security certification.
