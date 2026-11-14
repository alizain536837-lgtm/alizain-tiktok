# ALIZAIN TIKTOK — Deployment Guide (Netlify)

> **Verification status (2026-11-14, updated after a re-read of the
> tree).** `netlify.toml` and `netlify/functions/api.ts` are real and
> verified (see §4 and §12) — this guide now documents the actual build
> command and redirects. The deploy itself has **not** been run, and the
> backend it wraps (`backend/src/app.ts`, routes, Prisma schema, seed)
> **did not exist** at the final re-read, so a deploy attempted now
> would fail at the `prisma generate` / `prisma migrate deploy` step.
> Items still marked **⚠ TO BE VERIFIED AGAINST CODE / DEPLOY** are
> deploy-time checks, not guesses.

## 1. What gets deployed

One Netlify site hosting **both** parts of the platform:

- the **Admin Panel website** (static site), and
- the **backend API** as a Netlify Function (Express app wrapped for
  serverless), backed by a hosted Postgres database.

The Android app is **not** deployed here — it is built separately with
Expo EAS Build (see `eas-build.md`) and talks to the deployed backend URL
over the internet.

## 2. Before you deploy — hosted database first

Deploy the database **before** the site, because the site needs
`DATABASE_URL` at build/deploy time.

1. Create a **free Neon project** (Postgres) — new project, do not reuse
   another project's database.
2. Copy the **pooled** connection string. It looks like:
   `postgresql://user:password@<host>/<db>?sslmode=require`
3. Run the migrations against it once, from your computer:

```bash
cd backend
DATABASE_URL="<neon-pooled-connection-string>" npx prisma migrate deploy
DATABASE_URL="<neon-pooled-connection-string>" npm run seed
```

> ⚠ TO BE VERIFIED: that `prisma migrate deploy` + seed work against Neon
> (migrations had not been generated at writing time — see
> `testing-report.md`).

## 3. Deploy method — Git import only

- **Use Netlify Git import** (connect the GitHub repo and let Netlify build
  from it).
- **Do NOT drag-and-drop a ZIP** onto Netlify. Drag-and-drop deploys a
  static bundle only: it cannot run the build, cannot wire the backend
  Function, and cannot apply environment variables reliably. (Same rule as
  the owner's other Netlify projects.)

Steps:

1. Push the monorepo to GitHub (repo URL ⚠ TO BE VERIFIED — not pushed at
   writing time).
2. In Netlify: **Add new site → Import an existing project → GitHub**,
   pick the repo.
3. Set the build settings from `netlify.toml` (see §4) — Netlify reads
   `netlify.toml` automatically when it is at the repo root.
4. Add the environment variables from §5.
5. Deploy. Netlify builds the admin website and bundles the backend
   Function.

## 4. Build settings (`netlify.toml`) — verified

The real `netlify.toml` at the repo root (verified verbatim):

```toml
[build]
  command = "npm --prefix backend install --no-audit --no-fund && npx --prefix backend prisma generate && npx --prefix backend prisma migrate deploy && npm --prefix backend run seed && npm --prefix admin-website install --no-audit --no-fund && npm --prefix admin-website run build"
  publish = "admin-website/dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "20"
  NODE_OPTIONS = "--max-old-space-size=512"
  NPM_CONFIG_AUDIT = "false"
  NPM_CONFIG_FUND = "false"

# Backend API (served by the serverless function below).
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/health"
  to = "/.netlify/functions/api/health"
  status = 200

# SPA fallback — must stay LAST so /api/* and /health above keep working.
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

What this means — read it before deploying:

- **Migrations and seed run at build time.** The build command runs
  `prisma generate`, then `prisma migrate deploy`, then `npm run seed`
  against `DATABASE_URL` on **every** deploy. The seed must therefore be
  **idempotent** (safe to run twice) — otherwise redeploys will fail or
  duplicate data. ⚠ TO BE VERIFIED: the seed file does not exist yet,
  so idempotency is unverified.
- **Admin website** is built with `npm --prefix admin-website run build`
  (`tsc --noEmit && vite build`) and published from
  `admin-website/dist`.
- **Backend Function** is `netlify/functions/api.ts`, a `serverless-http`
  wrapper that imports `app` from `backend/src/app` (verified). It
  strips the `/.netlify/functions/api` prefix and re-adds `/api`, so the
  Express app sees the same `/api/...` and `/health` paths as in local
  dev.
- **`/health` is routed** to the function, so the first-deploy check in
  §6 uses the plain `/health` path.
- **Build environment:** Node 20, 512 MB old-space heap limit. If the
  build runs out of memory, raise `NODE_OPTIONS` — but the 512 MB cap is
  there deliberately for the free tier.
- The file header states the rule in its own words: drag-and-drop of a
  ZIP does not deploy this site — Git import or Netlify CLI only.

## 5. Environment variables (Netlify → Site settings → Environment variables)

Set these on the **production** site before the first deploy. Never put
real secrets in the repo.

| Variable | Value / source | Required |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string (§2) | Yes |
| `JWT_SECRET` | Long random string (generate fresh; do not reuse the local one) | Yes |
| `JWT_REFRESH_SECRET` | A different long random string | Yes |
| `CORS_ORIGINS` | The public site URL(s), e.g. `https://<your-site>.netlify.app` | Yes |
| `STORE_URL` / `ADMIN_URL` | Public site URL(s) | Yes |
| `PUBLIC_APP_URL` | Public site URL | Yes |
| `UPLOAD_DIR` | `./uploads` (local fallback only — see §7) | No |
| `CLOUDINARY_CLOUD_NAME` | From a free Cloudinary account | Optional — see §7 |
| `CLOUDINARY_API_KEY` | From Cloudinary | Optional |
| `CLOUDINARY_API_SECRET` | From Cloudinary | Optional |
| `LIVE_PROVIDER` | `none` (default) until a provider is configured | Optional |
| `LIVE_API_KEY` | Provider key, only if a provider is configured | Optional |
| `LIVE_API_SECRET` | Provider secret, only if a provider is configured | Optional |

Generate the JWT secrets fresh for production:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

After adding or changing variables, trigger a **redeploy** — a running
deploy does not pick up new variables.

## 6. First deploy checklist

1. Neon database created; migrations + seed run against it (§2).
2. Repo pushed to GitHub; Netlify site connected by Git import (§3).
3. `netlify.toml` present at the repo root with the correct build command
   (§4 — ⚠ verify).
4. All required env vars set (§5).
5. Deploy → wait for the build to succeed.
6. Check `GET https://<your-site>.netlify.app/health` returns
   `{"ok":true}` (verified: `/health` is redirected to the backend
   function in `netlify.toml`).
7. Open the site: admin website loads; register/login works against the
   live backend; a test video upload works.

## 7. Storage on Netlify — read this before launch

Netlify Functions run on an **ephemeral filesystem**: files written to
`UPLOAD_DIR` (local disk) during a deploy or a function run **do not
persist** — the next deploy or a new function instance starts with an
empty uploads folder. Consequences:

- Videos uploaded while Cloudinary is **not** configured will be lost on
  redeploy. This is expected behaviour, not a bug.
- **For production, configure Cloudinary** (free account): set all three
  `CLOUDINARY_*` variables and redeploy. The backend then stores videos,
  thumbnails and sounds on Cloudinary (verified behaviour in
  `backend/.env.example`: Cloudinary is used only when all three are set).
- Until Cloudinary is configured, treat the deployment as a demo/test
  environment and tell testers uploads may disappear.

## 8. First-use admin setup (production)

The deployed site starts with a **fresh, empty database**:

1. Open the Admin Panel on the live site.
2. Complete the first-use Super Admin setup (name, email, password —
   there is no default password).
3. Log in at `POST /api/admin/login` / the admin login screen.

Admin accounts and admin-added content on the live site are separate from
any local-dev database — setting them up locally does not set them up live.

## 9. How admin changes reach the app without a new APK

The Android app does **not** contain the catalogue, users, settings or
announcements — it fetches them from the backend API at runtime. So:

- Suspending/restoring a user, deleting a video/comment, changing a
  setting, or posting an announcement in the Admin Panel takes effect in
  the app as soon as the app next calls the API (or immediately for
  server-enforced rules such as suspended-login).
- **No new APK/AAB is needed** for content, moderation or settings changes.
- A new app build is needed only when the **app code itself** changes
  (screens, API client, `EXPO_PUBLIC_API_URL`, design).

Note: `EXPO_PUBLIC_API_URL` is baked into the app at build time. If the
backend URL ever changes, the app must be rebuilt with the new URL (see
`eas-build.md`).

## 10. Redeploys

- **Content/moderation changes:** no deploy — done in the Admin Panel (§9).
- **Code changes:** push to GitHub → Netlify rebuilds and redeploys
  automatically (Git import). Verify `/health` after each deploy.
- **Environment variable changes:** set in Netlify → trigger a manual
  redeploy (Deploys → Trigger deploy).
- **Database changes:** create a migration (`npx prisma migrate dev`
  locally) and push. The Netlify build command already runs
  `prisma migrate deploy` + `seed` on every deploy (verified in
  `netlify.toml`), so no manual migration step is needed — but the seed
  must stay idempotent, and a failed migration fails the whole deploy.

## 11. Free-tier limits (honest)

- **Netlify free (Starter):** limited build minutes, bandwidth and
  Function invocations/execution time per month. A short-video platform is
  bandwidth-heavy — video files served through the backend/Function will
  consume bandwidth fast. Cloudinary's free tier also has storage and
  bandwidth caps. Watch usage in both dashboards; heavy use will need a
  paid plan.
- **Neon free tier:** limited storage, compute hours and concurrent
  connections. Use the **pooled** connection string (it is designed for
  serverless) and keep idle connections low.
- **Serverless functions:** requests have a maximum run time (10 s on the
  free tier for synchronous functions). Large video uploads through a
  Function can time out — uploads should go **directly to Cloudinary**
  (or another direct-upload path) in production, not proxied through the
  Function. ⚠ TO BE VERIFIED: whether the backend supports direct-to-
  Cloudinary upload; if it does not, large uploads on the hosted deploy
  are a known limitation — record it in `testing-report.md`.
- **No card** is needed for the free tiers above, but exceeding a free
  quota can suspend or throttle the service until the next cycle or an
  upgrade.

## 12. What was verified

- `netlify.toml` (verbatim in §4): build command runs backend install +
  `prisma generate` + `prisma migrate deploy` + `seed` + admin install +
  build; publish `admin-website/dist`; functions `netlify/functions`;
  redirects `/api/*`, `/health`, SPA fallback; Node 20.
- `netlify/functions/api.ts`: `serverless-http` wrapper importing `app`
  from `backend/src/app`; prefix stripping so the Express app sees
  `/api/...` and `/health` unchanged. Its dependency
  `serverless-http` is in `netlify/functions/package.json`.
- `backend/.env.example`: Cloudinary used only when all three vars are
  set; `LIVE_PROVIDER` values `none | mux | livekit`; `PORT=4000`.
- Deployment pattern follows the owner's earlier Netlify projects (Git
  import, Neon Postgres, first-use admin setup on a fresh database).

Not verified / still missing: no site was deployed; `backend/src/app.ts`
exists only as a temporary harness stub (to be deleted before the real
file lands), and routes, Prisma schema and seed do not exist yet, so the
build command would fail today. The seed's idempotency is unverified.
Direct-to-Cloudinary upload support is unverified (see §11).
