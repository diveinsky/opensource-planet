# OPEN / BUILD — ready-to-host portfolio

Simple static site with zero backend and no runtime CDNs. Source files: `index.html`, `styles.css`, `app.js`, `favicon.svg`.

## Before going live

1. Open `app.js`. Set `CONFIG.githubUser` to your exact GitHub username. Set `CONFIG.githubSponsorsUrl` only if you want to override `https://github.com/sponsors/<githubUser>`.
2. Change `CONFIG.builderName` and update the `projects` array. These are **sample/concept projects**, and all demo links are disabled until you mark a real release as `published: true` and set the real `repo` and `demo` URLs.
3. Complete your **own GitHub Sponsors** onboarding at https://github.com/sponsors (GitHub profile, eligibility, tax and bank information, tiers, approval). A valid-looking link does not guarantee your page can accept payments.
4. Your repository can use a `.github/FUNDING.yml` file with `github: [YOUR_USERNAME]` to show a Sponsor button; only do so once the profile is ready.
5. This site does **not** accept crypto, vouchers, API credentials or payment data. It does not handle payments directly.

## GitHub Pages (recommended)

1. Create a public GitHub repository, e.g. `opensource-hub`.
2. Upload the **files inside this folder to the root** of that repository. Ensure `index.html` is at the root (not under another folder).
3. Go to your repository **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
4. Your site will be available at `https://YOUR_USERNAME.github.io/opensource-hub/` after publication.
5. Updates to the main branch update the site. For a username root site instead, name the repository `YOUR_USERNAME.github.io` (the URL is then `https://YOUR_USERNAME.github.io/`).

Docs: https://docs.github.com/en/pages/quickstart

## Cloudflare Pages (alternative)

1. Dashboard → Workers & Pages → Create → Pages → connect Git repository.
2. Framework: None; build command: leave empty if allowed; output directory: `/` (repository root).
3. Deploy and use the provided `*.pages.dev` address. You may also use Pages direct upload with the site's files.

Docs: https://developers.cloudflare.com/pages/

## Local preview

Double-click `index.html` or run `python -m http.server 8000` and open http://localhost:8000.

## Safety / legal

All JavaScript is publicly inspectable. Do not add secrets. This static site does not track supporters or store payment information. Consider personal/business tax classification and applicable foreign contribution obligations before accepting sponsorships. No charity status or tax deductibility is claimed.
