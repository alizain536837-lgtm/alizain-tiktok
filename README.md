# ALIZAIN TIKTOK

A short-video social platform: vertical videos up to 30 seconds, likes,
comments and replies, follows, hashtags, sounds, direct messages
(real-time via Socket.io), creator stats, and a separate Admin Panel.
Live streaming is supported by the API but **unavailable until a
streaming provider is configured** — the app must say so, never fake a
stream.

> **Status (2026-11-14, updated after a re-read of the tree).** The
> Android app (18 screens, API client, navigation, theme, `eas.json`),
> the Admin Panel (Vite SPA, 13 sections), `netlify.toml` and the
> Netlify Function are real and verified. The **backend is the unfinished
> part**: `backend/src/index.ts`, `src/routes/*`,
> `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/*` and
> `src/middleware/*` did not exist at the final re-read, and
> `backend/src/app.ts` is only a temporary harness stub (its own header
> says to delete it before the real file lands). The documentation in
> `documentation/` is written from the API contract + the verified
> client code and marks everything not yet verified against the backend
> as **⚠ TO BE VERIFIED AGAINST CODE**. Do not treat this as a finished,
> verified release until `documentation/testing-report.md` is filled in
> by the coordinator.

## Monorepo map

```
alizain-tiktok/
├── README.md                  # this file
├── .env.example               # all env vars (placeholders only)
├── package.json               # npm workspaces: admin-website, backend, netlify/functions
├── netlify.toml               # single-site Netlify build + redirects (verified)
├── backend/                   # Express + Prisma + Socket.io API
│   ├── src/index.ts           # entry point (npm run dev / npm start) — ⚠ NOT YET WRITTEN
│   ├── src/app.ts             # ⚠ TEMPORARY HARNESS STUB only (delete before real file lands)
│   ├── src/routes/            # API routes (see documentation/api.md) — ⚠ NOT YET WRITTEN
│   ├── src/middleware/        # auth, rate limiting, uploads — ⚠ NOT YET WRITTEN
│   ├── src/lib/               # helpers — ⚠ NOT YET WRITTEN
│   ├── prisma/schema.prisma   # database schema — ⚠ NOT YET WRITTEN
│   ├── prisma/seed.ts         # seed data — ⚠ NOT YET WRITTEN
│   ├── scripts/               # helper scripts (incl. generate-loops)
│   ├── assets/sounds/         # bundled sounds
│   └── uploads/               # local upload storage (gitignored)
├── android-app/               # Expo (React Native) Android app, SDK 53
│   ├── app.config.ts          # name, slug, package com.alizain.tiktok
│   ├── eas.json               # preview APK / production AAB profiles
│   ├── src/api/               # API client (client.ts, types.ts)
│   ├── src/screens/           # 18 screens (see below)
│   ├── src/navigation/        # 5 tabs + stack navigator
│   ├── src/components/        # shared components
│   ├── src/store/             # auth context + socket
│   └── src/theme.ts           # design tokens (verified)
├── admin-website/             # Admin Panel (Vite + React 19 SPA, hash routing)
│   ├── src/api.ts             # admin API client (relative /api)
│   ├── src/pages/             # 13 admin sections (see below)
│   └── vite.config.ts         # dev server port 5173
├── database/                  # database notes (empty at writing time)
├── documentation/             # guides (see below)
└── netlify/functions/         # api.ts — serverless-http wrapper around backend/src/app
```

## Brand

- **Product name:** ALIZAIN TIKTOK (refer to the product only by this
  name; no third-party trademarks).
- **App design tokens (verified in `android-app/src/theme.ts`):** dark
  UI — bg `#000000`, card `#121212`, surface `#1A1A1A`, border `#2A2A2A`,
  red `#FF2E4D`, cyan `#00E5D4`, white `#FFFFFF`, gray `#AAAAAA`, muted
  `#777777`, green `#22C55E`; radius `12`, padding `16`; system fonts.
  App is portrait-only, dark mode (`userInterfaceStyle: 'dark'`).
- **Admin design tokens (verified in `admin-website/src/index.css`):**
  bg `#0a0a0a`, panel `#141414`, panel-2 `#1d1d1d`, border `#2a2a2a`,
  text `#f5f5f5`, muted `#a3a3a3`, red `#fe2c55`, cyan `#25f4ee`,
  green `#22c55e`, amber `#f59e0b`; system-ui font stack.

## Screens

- **Android app (verified in `AppNavigator.tsx` + `src/screens/`):**
  5 tabs — Home, Discover, Create (Upload), Inbox, Profile — plus stack
  screens: Splash, Onboarding, Login, SignUp, ForgotPassword, Profile,
  EditProfile, Notifications, Comments, Messages, Chat, Music, Hashtag,
  CreatorDashboard, Settings, Privacy, Report, Upload, VideoEditor,
  Live, Search (18 screen files exist).
- **Admin Panel (verified in `admin-website/src/App.tsx`, hash routing):**
  Dashboard, Users, Videos, Comments, Reports, Live, Music (sounds),
  Hashtags, Creators, Notifications, Storage, Settings (Super Admin
  only), Audit Logs (Super Admin only), plus Setup / login screens.

## Quick start (local dev)

```bash
# 1. Install (root npm workspaces cover backend + admin + functions)
npm install

# 2. Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL + JWT secrets (see .env.example)
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev                 # http://localhost:4000 — check GET /health

# 3. Admin website (second terminal)
cd ../admin-website
npm run dev                 # http://localhost:5173 (/api + /health proxied to :4000)

# 4. Android app (third terminal)
cd ../android-app
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npx expo start
# scan the QR code with Expo Go (use your computer's LAN IP, not localhost)
```

Full steps, prerequisites and troubleshooting:
[`documentation/installation.md`](documentation/installation.md).

First run: create the Super Admin through the Admin Panel's first-use
setup — there is **no default password** (`POST /api/admin/setup`).

## Documentation

| Guide | What it covers |
| --- | --- |
| [`documentation/api.md`](documentation/api.md) | Every endpoint (auth, users, videos, comments, hashtags, sounds, messages + Socket.io, notifications, creator stats, live, admin), auth flow, rate limits, upload limits, honest-availability notes |
| [`documentation/installation.md`](documentation/installation.md) | Prerequisites, install, env setup, migrate + seed, running all three parts, first-use admin setup |
| [`documentation/deployment.md`](documentation/deployment.md) | Netlify single-site deploy (Git import, **not** ZIP drag-and-drop), free Neon Postgres, env vars, first deploy, redeploys |
| [`documentation/eas-build.md`](documentation/eas-build.md) | APK/AAB via Expo EAS Build under the owner's Expo account; the build itself was **not** run here |
| [`documentation/testing-report.md`](documentation/testing-report.md) | Verification checklist for the coordinator (all results `PENDING`) + what is not verified |
| [`documentation/env.example`](documentation/env.example) | All environment variables with comments (same as root `.env.example`) |

## API at a glance

- Base URL (local): `http://localhost:4000`; health: `GET /health`.
- Envelope: `{ "ok": true, ... }` / `{ "ok": false, "error": "..." }`.
- Auth: `Authorization: Bearer <accessToken>`; access token 15 min,
  refresh token 30 days (`POST /api/auth/refresh`).
- Videos: `POST /api/videos/upload` (multipart, ≤ 100 MB, ≤ 30 s),
  `GET /api/videos/feed`, like / save / share / comment / reply / report.
- Messages: REST conversations + Socket.io (`join`, `message:send`,
  `typing` → `message:new`, `message:read`, `notification:new`).
- Admin: first-use `POST /api/admin/setup`, then `POST /api/admin/login`;
  stats, users, videos, comments, reports, sounds, hashtags, creators,
  announcements, settings, storage, audit logs, live.

## Honest limits — what needs configuration

| Need | State | What to do |
| --- | --- | --- |
| Hosted database | Not deployed | Free Neon project; set `DATABASE_URL` (see `deployment.md`) |
| Cloud video storage | Not configured | Free Cloudinary account; set all three `CLOUDINARY_*` vars. Without it, uploads live on local disk and **do not survive redeploys** |
| Live streaming | Unavailable by design | API returns `available: false` / `503` until a provider is configured (`LIVE_PROVIDER=mux` or `livekit` + keys) |
| Android APK / AAB | Not built | Owner runs Expo EAS Build under their Expo account (see `eas-build.md`); Play Store also needs a Play developer account. **Blockers:** EAS project ID is still a placeholder and `android-app/assets/` (icon/splash) is empty |
| Email | Not configured | Password reset codes are shown **in-app**, never emailed (by design) |
| Admin local-dev proxy | Missing | `vite.config.ts` has no `/api` proxy yet — admin panel cannot reach the local backend until one is added |
| Backend | Not written | Routes, Prisma schema, seed, `src/app.ts`, `src/index.ts` do not exist yet — nothing runs end-to-end until they land |
| Payments | None | The platform has no payments by design |

## Tech (verified from the package files)

- **Backend:** Node ≥ 20, Express 4, Prisma 6, Socket.io 4, Zod, Multer,
  `ffprobe-static`, Helmet, CORS, `express-rate-limit`, bcryptjs,
  jsonwebtoken, Cloudinary SDK.
- **Android app:** Expo SDK 53, React 19, React Native 0.79.5,
  `expo-av`, `expo-image-picker`, `expo-video-thumbnails`, Axios,
  `socket.io-client`, React Navigation 7.
- **Admin website:** Vite 6 + React 19 + TypeScript SPA, hash routing,
  relative `/api` calls (no API-base env var), token in localStorage;
  scripts `dev` (port 5173), `build` (`tsc --noEmit && vite build`),
  `typecheck`.
