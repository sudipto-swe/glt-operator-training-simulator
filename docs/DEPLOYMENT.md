# Deployment

The build is a **fully static SPA** with a relative base (`base: './'` in `vite.config.ts`), so it works on any static host at any path — GitHub Pages project URLs, Netlify, Vercel, S3, an internal file share, even `file://`.

## Option A: GitHub Pages via the included workflow (recommended)

The repo contains `.github/workflows/deploy.yml` which builds and publishes on every push to `main` (and via manual *Run workflow*).

1. Create a new **empty** repository on GitHub (do not add README/license/.gitignore — this folder already has them).
2. Push this folder as `main`:
   ```bash
   git init -b main
   git add .
   git commit -m "GLT Operator Training Simulator v0.1.0"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Wait for the *Deploy to GitHub Pages* run. The site is at `https://<you>.github.io/<repo>/`.

CI (`.github/workflows/ci.yml`) runs the full verify gate (typecheck + lint + tests + build) on every push and pull request; the deploy workflow additionally requires it to pass before publishing.

### After the first deploy

- Update the `repository`/`homepage` fields in `package.json` if you want them tracked.
- Replace the `OWNER_TODO` holder in `LICENSE` with your name.

## Option B: any other static host

```bash
npm ci
npm run build     # outputs dist/
```

Upload `dist/` as the site root. No rewrites needed (single-page, state-based navigation), no environment variables, no runtime secrets.

## Local usage (offline training room)

```bash
npm run build && npm run preview   # http://localhost:4173
```

Or open `dist/index.html` directly from disk — the relative base makes even that work. For a training-room PC with no network, the app is fully self-contained once built.

## First-run experience

The app seeds a 12-trainee demo cohort so the Trainer dashboard is immediately meaningful. For real use: **Records → Clear all data**, then add your actual trainees (or import a JSON backup from a previous machine).
