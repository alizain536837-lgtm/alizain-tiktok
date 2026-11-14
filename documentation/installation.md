# ALIZAIN TIKTOK — Installation Guide

> **Verification status (2026-11-14, updated after a re-read of the
> tree).** The Android app (18 screens, API client, navigation, theme,
> `eas.json`, `app.config.ts`), the Admin Panel (Vite SPA, 13 sections),
> `netlify.toml` and the Netlify Function are all real and were verified
> (see §9). The **backend is still unfinished**: `backend/src/routes/*`,
> `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`,
> `backend/src/index.ts`, `backend/src/lib/*` and
> `backend/src/middleware/*` did not exist at the final re-read, and
> `backend/src/app.ts` is only a temporary harness stub (see §9).
> Anything marked **⚠ TO BE VERIFIED AGAINST CODE** is a backend item.
> Do not run the backend steps below until those files exist.

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **20 or newer** | Verified: `backend/package.json` sets `"engines": { "node": ">=20" }`. Use the LTS release. Check with `node --version`. |
| npm | ships with Node | All three packages use npm scripts; no lockfile existed at writing time — see §3. |
| PostgreSQL | **14 or newer** | Local dev, or a free Neon project for hosted use (see `deployment.md`). |
| ffmpeg | any recent release | Needed for video handling. The backend uses `ffprobe-static` (verified dependency) for duration checks, so ffprobe itself is bundled — but ffmpeg is still required if any transcoding/thumbnail step shells out to it. ⚠ TO BE VERIFIED AGAINST CODE: confirm whether the backend calls the `ffmpeg` binary directly. |
| Expo CLI | via `npx expo` | No global install needed; the app uses Expo SDK 53 (verified in `android-app/package.json`). |
| Git | any recent release | To clone the repo. |
| Android Studio / Expo Go | — | For running the app: Expo Go on a real phone (easiest), or an Android emulator. |

Check your tools:

```bash
node --version   # expect v20.x or newer
npm --version
psql --version   # if Postgres is installed locally
ffmpeg -version  # if installed
```

## 2. Get the code

```bash
git clone <repo-url> alizain-tiktok
cd alizain-tiktok
```

> ⚠ TO BE VERIFIED: the repository URL. The code was **not** pushed to
> GitHub as part of this documentation task — do not assume a URL from
> this guide. Ask the coordinator for the repo address.

Expected layout (verified at the final re-read, except the backend
`src/` + `prisma/` files marked below):

```
alizain-tiktok/
├── README.md
├── .env.example            # monorepo example (this repo)
├── package.json            # npm workspaces: admin-website, backend, netlify/functions
├── netlify.toml            # single-site Netlify build + redirects
├── backend/                # Express + Prisma + Socket.io API
│   ├── src/index.ts        # entry point (npm run dev / npm start) — ⚠ NOT YET WRITTEN
│   ├── src/app.ts          # ⚠ TEMPORARY HARNESS STUB only (delete before real file lands)
│   ├── src/routes/         # API routes — ⚠ NOT YET WRITTEN
│   ├── src/middleware/     # auth, rate limiting, uploads — ⚠ NOT YET WRITTEN
│   ├── src/lib/            # helpers — ⚠ NOT YET WRITTEN
│   ├── prisma/schema.prisma   # ⚠ NOT YET WRITTEN
│   ├── prisma/seed.ts         # ⚠ NOT YET WRITTEN
│   ├── scripts/            # helper scripts (incl. generate-loops)
│   ├── assets/sounds/      # bundled sounds
│   └── uploads/            # local upload storage (gitignored)
├── android-app/            # Expo (React Native) Android app, SDK 53
├── admin-website/          # Admin Panel website (Vite + React 19 SPA)
├── database/               # database notes (empty at writing time)
├── documentation/          # these guides
└── netlify/functions/      # Netlify Function wrapping the backend
```

## 3. Install dependencies

The repo root is an **npm workspaces** monorepo (verified in root
`package.json`: workspaces `["admin-website", "backend",
"netlify/functions"]`, Node `>= 20`). Install once from the root:

```bash
npm install
```

That installs dependencies for all three workspaces. Installing inside a
single folder (`cd backend && npm install`) also works.

> Note: `package-lock.json` files exist at the root and in
> `android-app/` (verified) — commit them so every install is
> reproducible.

## 4. Environment setup

### 4.1 Backend — `backend/.env`

```bash
cd backend
cp .env.example .env
```

Then edit `.env`. Every variable is explained in `.env.example` (root)
and `documentation/env.example`. Minimum for local dev:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/alizain_tiktok?schema=public"
JWT_SECRET="a-long-random-string-for-access-tokens"
JWT_REFRESH_SECRET="a-different-long-random-string-for-refresh-tokens"
PORT=4000
UPLOAD_DIR=./uploads
PUBLIC_APP_URL="http://localhost:4000"
CORS_ORIGINS="http://localhost:4000,http://localhost:8081,http://localhost:5173"
```

Generate the secrets — never reuse the example values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# run twice: once for JWT_SECRET, once for JWT_REFRESH_SECRET
```

Optional (leave blank for local dev):

- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` /
  `CLOUDINARY_API_SECRET` — only used when **all three** are set; otherwise
  uploads stay on local disk (`UPLOAD_DIR`). See `api.md` §1.6.
- `LIVE_PROVIDER` — leave as `none` unless a streaming provider
  (Mux / LiveKit) is configured, with `LIVE_API_KEY` / `LIVE_API_SECRET`.

**Never commit a real `.env`.** `backend/.gitignore` already excludes
`.env`, `node_modules/`, `dist/` and `uploads/*` (verified).

### 4.2 Android app — `EXPO_PUBLIC_API_URL`

The app reads the API base URL from `EXPO_PUBLIC_API_URL` at build/start
time. **Verified (app client + `app.config.ts`):** the value is read as
`Constants.expoConfig.extra.apiUrl` (set from `EXPO_PUBLIC_API_URL` in
`app.config.ts`), falling back to `process.env.EXPO_PUBLIC_API_URL`,
falling back to the placeholder `https://YOUR-API-URL`. The client
exposes `isApiConfigured()` — false while the placeholder is in place —
so the app can warn instead of failing silently.

- **Emulator on the same computer:** `http://10.0.2.2:4000`
- **Real phone on the same Wi-Fi (Expo Go):** your computer's LAN IP, e.g.
  `http://192.168.1.10:4000` — `localhost` will **not** work from the phone.
- **Production:** the deployed backend URL.

```bash
cd android-app
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npx expo start
```

> ⚠ TO BE VERIFIED AGAINST CODE: confirm the app reads
> `EXPO_PUBLIC_API_URL` (and nothing else) as its API base URL — **now
> verified**: see above. No further check needed here.

### 4.3 Admin website — no API URL variable needed

**Verified (admin client):** the Admin Panel calls the API on the
relative path `/api` — it is served from the same Netlify site as the
backend function, so **no `VITE_API_URL` (or any API-base variable) is
needed** for the admin website. In local dev, Vite's dev server must
proxy `/api` (and `/health`) to `http://localhost:4000`.

> ⚠ TO BE VERIFIED AGAINST CODE: `admin-website/vite.config.ts` as
> read contains **no proxy section** — it only sets the dev port (5173).
> If the admin panel is run locally without a proxy, its `/api` calls
> will hit the Vite server instead of the backend. Add a `server.proxy`
> for `/api` and `/health` to `http://localhost:4000`, or serve the
> panel through the backend/Netlify function, and correct this section.

## 5. Database — migrate + seed

```bash
cd backend
npx prisma generate
npx prisma migrate dev        # creates/updates tables from prisma/schema.prisma
npm run seed                  # runs prisma/seed.ts
```

What the seed is expected to create — ⚠ TO BE VERIFIED AGAINST CODE,
because `prisma/seed.ts` did not exist at writing time (the
`netlify.toml` build command already runs `npm --prefix backend run
seed` on every deploy, so a missing/broken seed will break deploys):

- Any starter sounds (the backend has an `assets/sounds/` folder and a
  `loops` script — `npm run loops` — in `package.json`).
- Any starter hashtags / announcements.
- It must **not** create an admin user: the Super Admin is created only
  through first-use setup (`POST /api/admin/setup`, §7 below).

If `prisma migrate dev` fails, check that `DATABASE_URL` points at a
running Postgres and that the database named in the URL exists:

```bash
createdb alizain_tiktok
```

## 6. Run everything (local dev)

Three terminals:

```bash
# Terminal 1 — backend (verified script: tsx watch src/index.ts)
cd backend
npm run dev
# expect: listening on http://localhost:4000 — check GET /health

# Terminal 2 — admin website (verified: `vite`, dev server port 5173)
cd admin-website
npm run dev
# open http://localhost:5173 — see §4.3: /api calls need a proxy to the backend

# Terminal 3 — Android app
cd android-app
npx expo start
# scan the QR code with Expo Go, or press `a` for the emulator
```

Smoke check after the backend starts:

```bash
curl http://localhost:4000/health
# expect: {"ok":true}
```

Then follow the smoke test in `testing-report.md` §3 (register → login →
upload a 5-second clip → feed → like → comment + reply → follow → DM →
admin setup/login → suspend → suspended login fails).

## 7. First-use admin setup

There is **no default admin password**. The first time the platform runs:

1. Open the Admin Panel (admin website, or the backend's admin route —
   ⚠ TO BE VERIFIED: confirm the admin website URL/route).
2. The setup screen asks for the Super Admin's name, email and password
   (minimum length ⚠ TO BE VERIFIED against the route code).
3. Submit. `POST /api/admin/setup` creates the Super Admin.
4. After that, setup is closed — any further call returns an error — and
   admins log in at `POST /api/admin/login`.

If you lose the Super Admin password, there is no in-app reset: it must be
reset directly in the database by someone with database access. Keep the
password safe.

## 8. Troubleshooting

| Problem | Likely cause / fix |
| --- | --- |
| `npm run dev` (backend) fails to start | `DATABASE_URL` wrong or Postgres not running; check `npx prisma generate` ran; check `PORT` is free. |
| `GET /health` returns nothing | Backend not running, or wrong port — check the terminal output for the listen address. |
| App (Expo Go) cannot reach the API | Phone and computer on different networks, or `EXPO_PUBLIC_API_URL` is `localhost`. Use the computer's LAN IP. |
| Upload rejected (`400`) | Video over 30 s or over 100 MB, or unsupported format — see `api.md` §1.5. |
| `401` on every call after login | Access token expired after 15 min — the app must call `POST /api/auth/refresh` (see `api.md` §1.3). |
| Admin setup says setup already done | A Super Admin already exists — use the login screen instead. |
| Live shows "unavailable" | Correct behaviour while `LIVE_PROVIDER=none` — see `api.md` §12. A provider must be configured first. |
| Videos uploaded locally disappear after redeploy | Local-disk storage (`UPLOAD_DIR`) does not survive redeploys on ephemeral hosts — configure Cloudinary (see `deployment.md`). |

## 9. What was verified

- Root `package.json`: npm workspaces (`admin-website`, `backend`,
  `netlify/functions`), Node `>= 20`; root + `android-app/`
  `package-lock.json` exist.
- `backend/package.json` scripts: `dev` (`tsx watch src/index.ts`),
  `build` (`tsc`), `start` (`node dist/index.js`), `seed`
  (`tsx prisma/seed.ts`), `prisma:migrate`, `prisma:deploy`,
  `prisma:generate`, `typecheck`, `loops`
  (`node scripts/generate-loops.mjs`); engines Node `>= 20`.
- `backend/.env.example` variables (listed in §4.1).
- `backend/.gitignore` (excludes `.env`, `node_modules/`, `dist/`,
  `uploads/*`).
- `android-app/package.json` scripts: `start`, `android`
  (`expo run:android`), `ios`, `web`, `export:web`, `typecheck`; Expo SDK
  53, React 19, React Native 0.79.5.
- `android-app/src/api/client.ts`: API base URL resolution
  (`extra.apiUrl` → `EXPO_PUBLIC_API_URL` → placeholder) and
  `isApiConfigured()`.
- `admin-website/package.json` scripts: `dev` (`vite`, port 5173),
  `build` (`tsc --noEmit && vite build`), `preview` (port 4173),
  `typecheck`; Vite 6 + React 19. Admin client uses relative `/api` —
  no API-base env var. **Gap found:** `vite.config.ts` has no dev
  proxy for `/api`/`/health` — see §4.3.

Not verified / still missing: `backend/src/index.ts`,
`backend/src/routes/*`, `prisma/schema.prisma`,
`prisma/seed.ts`, `src/lib/*`, `src/middleware/*` — the entire backend
implementation. `backend/src/app.ts` exists only as a **temporary
harness stub** (its own header says to delete it before the real file
lands); it proves the envelope shape and `GET /health` → `{ok:true}`
with no database, nothing else. Whether the backend calls the `ffmpeg`
binary directly (`ffprobe-static` is bundled for duration checks).
