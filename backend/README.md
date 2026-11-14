# ALIZAIN TIKTOK — Backend

Short-video social platform backend: **Node 20+ / Express 4 / Prisma 6 / PostgreSQL / Socket.io 4**, TypeScript strict. Built as one Express `app` that the Netlify Function imports directly (no `listen` in `app.ts`).

## Quick start (local dev)

```bash
npm install --no-audit --no-fund   # see the monorepo note below
cp .env.example .env               # fill in DATABASE_URL + JWT secrets
npx prisma migrate dev             # create/apply migrations
npm run seed                       # 6 built-in sounds + default settings only
npm run dev                        # tsx watch on :4000
```

Health check: `GET /health` → `{"ok":true,"service":"alizain-tiktok-backend"}`

> **Monorepo note:** the parent folder `alizain-tiktok/` is an npm workspace root
> (`workspaces: ["admin-website", "backend", "netlify/functions"]`). Running plain
> `npm install` inside `backend/` makes npm resolve the whole workspace tree and
> fail. Install backend deps with:
> `npm install --no-audit --no-fund --workspaces=false`
> (all commands in this README assume that when run from `backend/`).
> Memory is tight on the build machine: run node/npm with
> `NODE_OPTIONS=--max-old-space-size=512`.

## Environment (.env)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string, e.g. `postgresql://user:pass@localhost:5432/alizain_tiktok?schema=public` |
| `JWT_SECRET` | yes | Long random string (access tokens, 15 min) |
| `JWT_REFRESH_SECRET` | yes | Reserved for future signed refresh tokens; current refresh tokens are opaque + SHA-256 hashed in `Session` |
| `PORT` | no | Default `4000` |
| `UPLOAD_DIR` | no | Local disk storage, default `./uploads` |
| `PUBLIC_APP_URL` | no | Public base URL used for share links (`/video/:id`) and absolute media URLs. No localhost here in production. |
| `CORS_ORIGINS` | no | Comma-separated allowed origins |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | no | When **all three** are set, video/thumbnail/sound uploads go to Cloudinary; otherwise local disk. Admin → Storage honestly reports the active provider. |
| `LIVE_PROVIDER` | no | `none` (default) / `mux` / `livekit`. With `none`, live endpoints honestly report unavailable (see below). |
| `LIVE_API_KEY` / `LIVE_API_SECRET` | no | Provider credentials (secrets — never returned by the API). |

No secrets are hardcoded. `.env` is gitignored; `.env.example` documents every key.

## Structure

```
src/
  app.ts            # createApp() + exported `app` (NO listen — Netlify imports this)
  index.ts          # local-dev entrypoint only (listens on PORT, attaches Socket.io)
  lib/
    prisma.ts       # PrismaClient singleton
    auth.ts         # bcrypt, JWT access tokens, opaque refresh tokens (SHA-256 stored)
    upload.ts       # multer, ffprobe duration, ffmpeg thumbnails, Cloudinary
    socket.ts       # Socket.io server + notification helper
    validate.ts     # zod body/query parsing, cursor pagination helpers
    errors.ts       # ApiError + helpers
    audit.ts        # audit-log writer (never throws)
    serializers.ts  # publicUser / serializeVideo shapes
  middleware/
    auth.ts         # requireAuth / optionalAuth / requireRole
    error.ts        # JSON error envelope + 404
  routes/
    auth.ts users.ts videos.ts hashtags.ts sounds.ts
    conversations.ts notifications.ts creator.ts live.ts admin.ts
prisma/
  schema.prisma     # single source of truth (mirrored under /database/)
  migrations/       # Prisma migrations
  seed.ts           # idempotent: 6 sounds + 4 settings ONLY — no fake users/content
scripts/
  generate-loops.mjs  # synthesizes the 6 original WAV loops (pure Node, no deps)
assets/sounds/      # the 6 generated loops, served at /sounds/<file>
```

## API

JSON envelope everywhere: success `{ok:true, ...}`, error `{ok:false, error:"msg"}` with the correct HTTP status. Auth: `Authorization: Bearer <accessToken>` (15 min). Refresh tokens are opaque, rotated on use, stored SHA-256-hashed in `Session` (30 days).

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `POST /api/auth/register` (201) · `login` · `refresh` · `logout` · `forgot-password` · `reset-password` · `GET /me` |
| Users | `GET /api/users/:username` (counts from real rows) · `PATCH /api/users/me` · `GET /:username/videos` · `GET /me/videos` · `GET /me/saved` · `GET /:username/followers|following` · `POST|DELETE /:id/follow` · `POST|DELETE /:id/block` · `POST /:id/report` · `GET /search?q=` |
| Videos | `POST /api/videos/upload` (multipart, ≤100 MB, **duration ≤30 s enforced by ffprobe — longer is rejected 400**, thumbnail auto-generated with ffmpeg) · `GET /feed?tab=for_you\|following` · `GET /:id` · `POST /:id/view` (one view per user per video per day) · `POST|DELETE /:id/like` · `POST|DELETE /:id/save` · `POST /:id/share` · `GET|POST /:id/comments` (replies via `parentId`) · `POST|DELETE /comments/:id/like` · `DELETE /comments/:id` · `POST /:id/report` · `DELETE /:id` |
| Hashtags | `GET /api/hashtags/trending` · `GET /api/hashtags/:tag/videos` |
| Sounds | `GET /api/sounds?q=&limit=` · `GET /:id` · `GET /:id/videos` · `GET /:id/stream` · `POST /api/sounds` (**admin only** — same handler as `POST /api/admin/sounds`) |
| DMs | `GET /api/conversations` · `POST /api/conversations {userId}` · `GET|POST /:id/messages` · `POST /:id/read` |
| Notifications | `GET /api/notifications` · `POST /:id/read` · `POST /read-all` |
| Creator | `GET /api/creator/stats` (all from real rows) |
| Live | `GET /api/live/availability` · `POST /api/live/start` · `GET /api/live` · `POST /api/live/:id/report` |
| Admin | `POST /api/admin/setup` (first-use Super Admin, 403 once one exists) · `POST /api/admin/login` · `GET /stats` · `GET /users` · `POST /users/:id/suspend|restore` · `GET|DELETE /videos/:id` · `GET|DELETE /comments/:id` · `GET /reports` · `POST /reports/:id/review` · `GET|POST|DELETE /sounds` · `GET|DELETE /hashtags` · `GET /creators` · `GET|POST /announcements` · `GET|PATCH /settings` · `GET /storage` · `GET /audit-logs` · `GET /live` |

**Video deletion is a soft delete** (`status: "removed"`); removed videos disappear from feeds and return 404 on detail. **Admin settings secrets are write-only**: keys containing `SECRET`/`KEY`/`PASSWORD`/`TOKEN` are never returned (masked as `********`); sending the mask back does not overwrite them.

## Honest limits (by design, not bugs)

- **Live streaming is unavailable until a provider is configured.** `GET /api/live/availability` returns `{ok:true, available:false, reason:"No live streaming provider is configured. Configure Mux or LiveKit in Admin → Live Streaming."}` and `POST /api/live/start` returns **503**. `GET /api/live` returns `{ok, streams:[]}`. No fake live data is ever served.
- **Forgot password has no email provider.** `POST /api/auth/forgot-password` returns the 6-digit code in the response (`resetCode`, 15-min expiry, stored hashed) and documents this clearly. When an email provider is added, stop returning the code.
- **The platform starts empty.** The seed creates only the 6 built-in sounds and 4 default settings (`appName`, `maxVideoSeconds=30`, `registrationOpen=true`, `liveProvider=none`). No fake users, videos, likes, followers or comments are ever seeded.
- **Local storage is the default.** Without `CLOUDINARY_*`, uploads live under `UPLOAD_DIR` and are served at `/uploads/*`. Admin → Storage reports `provider: "local"` with real byte totals.

## Socket.io

Authenticate with the JWT access token: `io(url, { auth: { token } })`. Client emits `join {userId}`, `message:send {conversationId, text}`, `typing {conversationId}`. Server emits `message:new`, `message:read`, `notification:new`, `live:chat`, `live:viewer-count`.

## Music loops

`node scripts/generate-loops.mjs` regenerates the 6 original loops (16-bit PCM WAV, 44.1 kHz mono, 8–15 s): Upbeat Pop, Chill Lofi, Hip-Hop Beat, Electronic Dance, Acoustic Pluck, Cinematic — all synthesized from scratch, royalty-free, artist `Alizain TikTok Originals`, served at `/sounds/<file>` and registered by the seed.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | tsx watch server on `PORT` |
| `npm run build` / `npm start` | Compile to `dist/` / run compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Idempotent seed |
| `npm run loops` | Regenerate the 6 WAV loops |
| `npm run prisma:migrate` / `prisma:generate` / `prisma:deploy` | Prisma helpers |

## Security

bcrypt password hashing (bcryptjs, cost 12) · JWT access 15 min + rotating opaque refresh tokens · rate limits (300/min global, 40/15 min auth, 30/15 min comments, 60/15 min DMs) · zod validation on all inputs · multer type+size validation · audit log for every admin action, suspend/delete and report review · spam protection via per-user comment/message limits and max lengths (caption 300, comment 500, message 2000, bio 200).
