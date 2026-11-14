# ALIZAIN TIKTOK — API Documentation

> **Verification status — read first (2026-11-14, updated after a re-read
> of the tree).**
> The backend route files (`backend/src/routes/*`),
> `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`,
> `backend/src/index.ts`, `backend/src/lib/*` and
> `backend/src/middleware/*` had **not yet been written** when this
> document was finished — the backend is the one unfinished part.
> `backend/src/app.ts` exists but is explicitly a **temporary harness
> stub** (says so in its own header, to be deleted before the real file
> lands): it proves the `{ok:true}` / `{ok:false,error}` envelope and
> that `GET /health` returns `{ok:true}` without a database, and
> returns 500/404 JSON for everything else. It verifies no real route. Everything else is now verified from real code: the
> Android app client (`android-app/src/api/client.ts`, `types.ts`,
> `theme.ts`, `app.config.ts`, `eas.json`, navigation), the Admin Panel
> client (`admin-website/src/api.ts`, `App.tsx`, `index.css`),
> `netlify.toml`, `netlify/functions/api.ts`, `backend/package.json` and
> `backend/.env.example`.
>
> Marks used below:
>
> - **Verified (app client)** / **Verified (admin client)** — the method,
>   path, field names or shape are confirmed by the client code that
>   calls the API. The server side still has to implement them exactly
>   this way; if the backend differs, the **backend is wrong**, not the
>   client.
> - **⚠ TO BE VERIFIED AGAINST CODE** — a detail the contract does not
>   pin down and no client code confirms; it must be checked against the
>   route code once the backend exists.
>
> Do not treat an unmarked detail as verified. When the routes land,
> re-read them and correct this file.

## 1. Basics

| Item | Value |
| --- | --- |
| Base URL (local dev) | `http://localhost:4000` |
| Base URL (production) | The deployed backend URL (Netlify Function site); no localhost in production |
| Health check | `GET /health` |
| Response envelope | JSON, always `{ "ok": true, ... }` on success or `{ "ok": false, "error": "..." }` on failure |
| Auth | `Authorization: Bearer <accessToken>` header, except public and admin-setup/login endpoints |
| Token lifetimes | Access token **15 minutes**; refresh token **30 days** (JWT) |
| Stack (verified from `backend/package.json`) | Express 4, Prisma 6, Socket.io 4, Zod validation, Multer uploads, `ffprobe-static` duration checks, Helmet, CORS, `express-rate-limit`, bcryptjs, jsonwebtoken, Cloudinary SDK |

### 1.1 Success envelope

```json
{
  "ok": true,
  "video": { "id": "…", "caption": "…", "videoUrl": "…", "likesCount": 0 }
}
```

The payload key after `ok` varies by endpoint (`user`, `videos`, `token`,
`notifications`, …). The app client unwraps responses as
`res.data?.data ?? res.data` (verified in `android-app/src/api/client.ts`),
so the backend may return the payload either nested under a `data` key
or at the top level — but it must be consistent; the documented shapes
below show the payload without the envelope. List endpoints return an
array plus pagination fields where the contract provides them — see §7.

### 1.2 Error envelope

```json
{ "ok": false, "error": "Video not found" }
```

| HTTP status | Meaning |
| --- | --- |
| 400 | Bad request — validation failed (Zod) or a business rule was broken (e.g. video longer than 30 s) |
| 401 | Missing, expired or invalid access token; or login credentials wrong |
| 403 | Authenticated but not allowed (e.g. suspended account, admin-only route as a normal user) |
| 404 | Resource not found |
| 429 | Rate limit exceeded — slow down and retry after the delay the response indicates |
| 503 | Feature unavailable — live streaming when no provider is configured (`POST /api/live/start`) |
| 500 | Server error |

> ⚠ TO BE VERIFIED AGAINST CODE: the exact error strings and the exact
> status code for each failure (e.g. suspended-account login, duplicate
> username, already-following) are not fixed by the contract and must be
> read from the route code.

### 1.3 Auth flow

```
register → { accessToken, refreshToken, user }
login    → { accessToken, refreshToken, user }
           access token expires after 15 minutes
refresh  → POST /api/auth/refresh { refreshToken }
           → { accessToken } (and a rotated refresh token, if the code rotates it)
logout   → POST /api/auth/logout { refreshToken }  → refresh token revoked
me       → GET /api/auth/me  (Bearer access token) → current user
```

- Send the access token as `Authorization: Bearer <accessToken>` on every
  authenticated call.
- When a call returns `401`, call `POST /api/auth/refresh` with the stored
  refresh token, replace both tokens with the response, and retry once.
  **Verified (app client):** the client retries once automatically, and
  if the refresh response contains a new `refreshToken` it stores it —
  so the backend **may rotate** refresh tokens; clients must accept a
  new one when present and keep working when it is absent.
- If refresh also returns `401`, the session is over — send the user to the
  login screen. **Verified (app client):** the client clears both stored
  tokens in that case.
- Tokens are stored in SecureStore under `alizain_access_token` /
  `alizain_refresh_token`, and the user profile is cached in AsyncStorage
  (verified in the app client).
- A **suspended** account cannot log in: login fails and the account stays
  locked until an admin restores it (see §10).

> ⚠ TO BE VERIFIED AGAINST CODE: how revoked/expired refresh tokens are
> stored server-side, and the exact response field names on refresh.

### 1.4 Rate limits

Rate limiting is enforced with `express-rate-limit` (verified dependency in
`backend/package.json`).

> ⚠ TO BE VERIFIED AGAINST CODE: the contract does not state any numeric
> limit (window, max requests, which routes are limited). No numbers are
> given here because none were verified. Read the rate-limit middleware in
> `backend/src/middleware/*` and record the real values here. Clients must
> handle `429` responses regardless of the numbers.

### 1.5 Upload limits

| Upload | Limit |
| --- | --- |
| Video file | **≤ 100 MB**, **≤ 30 seconds** duration (enforced server-side; duration checked with ffprobe — `ffprobe-static` is a verified dependency). Longer videos are rejected with `400`. |
| Video format | ⚠ TO BE VERIFIED AGAINST CODE — accepted MIME types / extensions (expected: mp4/mov/webm) are not fixed by the contract. |
| Thumbnail image | Sent with the upload or generated server-side. ⚠ TO BE VERIFIED AGAINST CODE — max size and accepted types not fixed by the contract. |
| Sound audio (admin upload) | ⚠ TO BE VERIFIED AGAINST CODE — max size, duration and accepted types not fixed by the contract. |

Uploads use `multipart/form-data` (Multer — verified dependency).
**Verified (app client)** field names for `POST /api/videos/upload`:
`video` (file, `video/mp4`), `thumbnail` (file, `image/jpeg`, optional),
`caption` (text), `hashtags` (a **JSON string of an array**, e.g.
`"[\"funny\",\"dance\"]"`), `soundId` (text, optional).

### 1.6 Honest-availability notes

These behaviours are part of the API by design — they are not bugs:

1. **Forgot password — no email is sent.** There is no email provider
   configured. `POST /api/auth/forgot-password` returns a `resetCode` **in
   the response**, and the app shows it to the user in-app. The user then
   submits that code to `POST /api/auth/reset-password`. Never claim a reset
   email was sent.
2. **Live streaming is unavailable until a provider is configured.**
   `GET /api/live/availability` returns `available: false` while
   `LIVE_PROVIDER=none` (the default), and `POST /api/live/start` returns
   `503`. The app UI must say live streaming is unavailable — it must never
   fake a live stream, a viewer count, or a "LIVE" badge.
3. **Storage: local vs Cloudinary.** When `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are **all** set, uploads
   go to Cloudinary (verified in `backend/.env.example`). Otherwise uploads
   are stored on the backend's local disk (`UPLOAD_DIR`, default
   `./uploads`) and served by the backend. Local-disk storage does not
   survive a redeploy of an ephemeral host — see
   `documentation/deployment.md`.

---

## 2. Health

### `GET /health` — public

```json
{ "ok": true }
```

> ⚠ TO BE VERIFIED AGAINST CODE: exact payload (e.g. whether it also
> reports database connectivity or uptime).

---

## 3. Auth — `/api/auth`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/auth/register` | public | Create an account |
| `POST /api/auth/login` | public | Log in |
| `POST /api/auth/refresh` | public (refresh token in body) | Get a new access token |
| `POST /api/auth/logout` | user | Revoke the refresh token |
| `POST /api/auth/forgot-password` | public | Get an in-app reset code (no email) |
| `POST /api/auth/reset-password` | public | Reset password with the code |
| `GET /api/auth/me` | user | Current user |

### `POST /api/auth/register`

Request (JSON) — **verified (app client)** field names:

```json
{ "username": "alizain", "email": "ali@example.com", "password": "********", "displayName": "Ali Zain" }
```

Success `201`:

```json
{
  "ok": true,
  "user": { "id": "…", "username": "alizain", "email": "ali@example.com" },
  "accessToken": "…",
  "refreshToken": "…"
}
```

Errors: `400` — username/email already taken, or validation failed (password
too short, bad email format).

> ⚠ TO BE VERIFIED AGAINST CODE: username rules (allowed characters,
> length, case handling), minimum password length, and whether
> `displayName` is required or optional server-side (the app client
> always sends it).

### `POST /api/auth/login`

Request (JSON) — **verified (app client)** field names:

```json
{ "identifier": "ali@example.com", "password": "********" }
```

`identifier` is the username **or** email — the client sends one field
for both.

Success `200`: same shape as register (`user`, `accessToken`,
`refreshToken`).

Errors: `401` — wrong credentials; `403` — account suspended by an admin
(the login must fail for suspended accounts).

### `POST /api/auth/refresh`

Request (JSON): `{ "refreshToken": "…" }`

Success `200`: `{ "ok": true, "accessToken": "…" }` (plus a new
`refreshToken` if rotation is implemented — the app client stores one
when present).

Errors: `401` — refresh token expired, revoked, or invalid.

### `POST /api/auth/logout`

Auth: user. **Verified (app client):** the client sends **no body** —
just the `Authorization` header. The backend revokes the refresh token
associated with the session.

Success `200`: `{ "ok": true }`.

### `POST /api/auth/forgot-password`

Request (JSON): `{ "email": "ali@example.com" }`

Success `200`:

```json
{ "ok": true, "resetCode": "123456" }
```

The `resetCode` is returned **in the response** and shown in-app — no email
is sent (see §1.6). The code expires; the expiry is not fixed by the
contract.

> ⚠ TO BE VERIFIED AGAINST CODE: code length/format, expiry time, and the
> response when the email has no account (expected: same generic success,
> so accounts cannot be enumerated — verify).

### `POST /api/auth/reset-password`

Request (JSON) — **verified (app client)** field names (note: the field
is `code`, not `resetCode`):

```json
{ "email": "ali@example.com", "code": "123456", "newPassword": "********" }
```

Success `200`: `{ "ok": true }`. Errors: `400` — wrong/expired code or
invalid new password.

### `GET /api/auth/me`

Auth: user. Success `200`: `{ "ok": true, "user": { … } }` — the current
user's profile. Error: `401` — no/invalid token.

---

## 4. Users — `/api/users`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/users/search?q=…` | user | Search users by username / name |
| `GET /api/users/:username` | user | Public profile |
| `PATCH /api/users/me` | user | Edit own profile |
| `GET /api/users/:username/videos` | user | That user's videos |
| `GET /api/users/me/saved` | user | Videos the current user saved |
| `GET /api/users/:username/followers` | user | Follower list |
| `GET /api/users/:username/following` | user | Following list |
| `POST /api/users/:id/follow` | user | Follow a user |
| `DELETE /api/users/:id/follow` | user | Unfollow a user |
| `POST /api/users/:id/block` | user | Block a user |
| `DELETE /api/users/:id/block` | user | Unblock a user |
| `POST /api/users/:id/report` | user | Report a user |
| `GET /api/users/search` | user | (listed twice in the contract; same endpoint) |

### `GET /api/users/search?q=ali`

Query param `q` (required). Success `200`:

```json
{ "ok": true, "users": [ { "id": "…", "username": "alizain", "displayName": "…", "avatarUrl": "…" } ] }
```

> ⚠ TO BE VERIFIED AGAINST CODE: pagination params, whether the search
> matches display names as well as usernames, and the exact user fields
> returned.

### `GET /api/users/:username`

Success `200` — **verified (app client)** `User` shape:

```json
{
  "ok": true,
  "user": {
    "id": "…", "username": "alizain", "displayName": "…",
    "email": "…", "bio": "…", "avatarUrl": "…",
    "followersCount": 0, "followingCount": 0, "videosCount": 0,
    "likesCount": 0, "isFollowing": false, "verified": false
  }
}
```

Errors: `404` — no such user.

### `PATCH /api/users/me`

Auth: user. Request (JSON) — only the fields being changed:

```json
{ "displayName": "Ali Zain", "bio": "…", "avatarUrl": "…" }
```

Success `200`: `{ "ok": true, "user": { … } }` — the updated profile.

> ⚠ TO BE VERIFIED AGAINST CODE: which fields are editable, whether the
> avatar is uploaded as a file (multipart) or as a URL, and whether
> `username` can be changed here.

### `GET /api/users/:username/videos` / `GET /api/users/me/saved`

Success `200`: `{ "ok": true, "videos": [ … ] }` — video objects as in §5.
Supports pagination — see §7.

### `GET /api/users/:username/followers` / `GET /api/users/:username/following`

Success `200`: `{ "ok": true, "users": [ … ] }` (paginated).

### `POST /api/users/:id/follow` / `DELETE /api/users/:id/follow`

Success `200`: `{ "ok": true, "isFollowing": true }` (POST) /
`{ "ok": true, "isFollowing": false }` (DELETE).

Errors: `400` — following yourself, or already following / not following;
`404` — no such user.

### `POST /api/users/:id/block` / `DELETE /api/users/:id/block`

Success `200`: `{ "ok": true, "isBlocked": true | false }`. Blocking hides
the blocked user's content from the blocker and prevents interaction both
ways (exact enforcement to be verified).

### `POST /api/users/:id/report`

Request (JSON) — **verified (app client)**: `{ "reason": "spam" }`
(reason only; no `details` field is sent by the client).

Success `200` or `201`: `{ "ok": true }`. The report goes to the admin
reports queue (`GET /api/admin/reports`).

> ⚠ TO BE VERIFIED AGAINST CODE: allowed `reason` values and the success
> status code.

---

## 5. Videos — `/api/videos`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/videos/upload` | user | Upload a video (multipart, ≤ 30 s) |
| `GET /api/videos/feed` | user | Personalised / following feed |
| `GET /api/videos/:id` | user | One video |
| `POST /api/videos/:id/view` | user | Record a view |
| `POST /api/videos/:id/like` | user | Like |
| `DELETE /api/videos/:id/like` | user | Unlike |
| `POST /api/videos/:id/save` | user | Save |
| `DELETE /api/videos/:id/save` | user | Unsave |
| `POST /api/videos/:id/share` | user | Record a share |
| `GET /api/videos/:id/comments` | user | List comments |
| `POST /api/videos/:id/comments` | user | Add a comment (or a reply) |
| `POST /api/videos/:id/report` | user | Report a video |
| `DELETE /api/videos/:id` | user (owner) | Delete own video |

### `POST /api/videos/upload`

Auth: user. Content type: `multipart/form-data`.

| Part | Required | Notes |
| --- | --- | --- |
| `video` (file) | yes | ≤ 100 MB, ≤ 30 s. Rejected with `400` otherwise. Sent as `video.mp4` / `video/mp4` by the app client. |
| `caption` | no | Text caption. |
| `thumbnail` (file) | no | Cover image, sent as `thumb.jpg` / `image/jpeg` by the app client. **Verified:** the app generates it on-device with `expo-video-thumbnails` (`android-app/src/utils/thumbnails.native.ts`; the web stub returns null). ⚠ TO BE VERIFIED — whether the server generates one when omitted. |
| `soundId` | no | ID of a sound to attach (verified field name). |
| `hashtags` | no | **Verified (app client):** a JSON string of an array, e.g. `"[\"funny\",\"dance\"]"`. |

Success `201` — **verified (app client)** `VideoItem` shape:

```json
{
  "ok": true,
  "video": {
    "id": "…", "userId": "…", "username": "alizain", "displayName": "…",
    "avatarUrl": "…", "caption": "…", "hashtags": ["…"],
    "videoUrl": "…", "thumbnailUrl": "…",
    "soundId": "…", "soundTitle": "…",
    "durationSeconds": 12,
    "viewsCount": 0, "likesCount": 0, "commentsCount": 0,
    "sharesCount": 0, "savesCount": 0,
    "liked": false, "saved": false, "status": "…",
    "createdAt": "…"
  }
}
```

Errors: `400` — no file, file too large, duration over 30 s, unsupported
format; `401` — not logged in.

### `GET /api/videos/feed`

Auth: user. **Verified (app client):** cursor pagination with query
params `tab=for_you | following`, `limit` (default `10`), `cursor`
(opaque; pass the `nextCursor` from the previous page).

Success `200`:

```json
{ "ok": true, "videos": [ { "id": "…", "caption": "…", "videoUrl": "…", "thumbnailUrl": "…", "username": "…", "likesCount": 0, "commentsCount": 0, "viewsCount": 0, "liked": false, "saved": false, "createdAt": "…" } ], "nextCursor": "…" }
```

`nextCursor` is absent/null on the last page.

> ⚠ TO BE VERIFIED AGAINST CODE: feed ordering within a tab, and whether
> `tab` defaults to `for_you` when omitted.

### `GET /api/videos/:id`

Auth: user. Success `200`: `{ "ok": true, "video": { … } }`.
Error: `404` — no such video (or deleted / removed by admin).

### `POST /api/videos/:id/view`

Auth: user. Records one view. Success `200`:
`{ "ok": true, "viewsCount": 123 }`.

> ⚠ TO BE VERIFIED AGAINST CODE: whether repeated views by the same user
> count once or every time, and the exact response shape.

### `POST /api/videos/:id/like` / `DELETE /api/videos/:id/like`

Success `200`: `{ "ok": true, "liked": true, "likesCount": 5 }` /
`{ "ok": true, "liked": false, "likesCount": 4 }`.
Errors: `404` — no such video.

> ⚠ TO BE VERIFIED AGAINST CODE: the exact response fields — the app
> client only checks `ok`, so counts/flags in this example are per the
> contract, not client-verified. Field names follow the `VideoItem`
> shape (`liked`, not `isLiked`).

### `POST /api/videos/:id/save` / `DELETE /api/videos/:id/save`

Success `200`: `{ "ok": true, "saved": true | false }`. Saved videos are
listed at `GET /api/users/me/saved`.

> ⚠ TO BE VERIFIED AGAINST CODE: the exact response fields (the app
> client only checks `ok`).

### `POST /api/videos/:id/share`

Auth: user. Records a share (increments the share count). Success `200`:
`{ "ok": true, "sharesCount": 3 }`.

> ⚠ TO BE VERIFIED AGAINST CODE: whether the response includes a share URL,
> and the exact response shape.

### `GET /api/videos/:id/comments`

Auth: user. Success `200` — **verified (app client)** `CommentItem`
shape, with replies **nested** in a `replies` array:

```json
{ "ok": true, "comments": [ { "id": "…", "videoId": "…", "userId": "…", "username": "…", "avatarUrl": "…", "text": "…", "likesCount": 0, "liked": false, "replies": [ … ], "createdAt": "…" } ] }
```

> ⚠ TO BE VERIFIED AGAINST CODE: pagination params and sort order.

### `POST /api/videos/:id/comments`

Auth: user. Request (JSON) — **verified (app client)** field names:

```json
{ "text": "…", "parentId": "…" }
```

`parentId` is optional — when present, the comment is a **reply** to that
comment; when absent, it is a top-level comment.

Success `201`: `{ "ok": true, "comment": { … } }`.
Errors: `400` — empty text; `404` — no such video (or parent comment).

> ⚠ TO BE VERIFIED AGAINST CODE: max comment length and the success
> status code.

### `POST /api/videos/:id/report`

Auth: user. Request (JSON) — **verified (app client)**: `{ "reason": "…" }`.
Success `200`/`201`: `{ "ok": true }`. Reports go to the admin queue.

> ⚠ TO BE VERIFIED AGAINST CODE: allowed `reason` values and status code.

### `DELETE /api/videos/:id`

Auth: user, **owner only**. Success `200`: `{ "ok": true }`.
Errors: `403` — not the owner; `404` — no such video.

> ⚠ TO BE VERIFIED AGAINST CODE: whether the video file itself is deleted
> from storage (local disk / Cloudinary) or only the database row.

---

## 6. Comments — `/api/comments/:id`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/comments/:id/like` | user | Like a comment |
| `DELETE /api/comments/:id/like` | user | Unlike a comment |
| `DELETE /api/comments/:id` | user (author) | Delete a comment |

Success `200`:

- like: `{ "ok": true, "liked": true, "likesCount": 2 }`
- unlike: `{ "ok": true, "liked": false, "likesCount": 1 }`
- delete: `{ "ok": true }`

Errors: `403` — deleting someone else's comment; `404` — no such comment.

> ⚠ TO BE VERIFIED AGAINST CODE: the exact response fields (the app
> client only checks `ok`), and whether deleting a comment also deletes
> its replies.

---

## 7. Pagination

**Verified (app client) for the feed:** cursor pagination —
`GET /api/videos/feed?tab=for_you|following&limit=10&cursor=…` returns
`{ "videos": […], "nextCursor": "…" }`; pass `nextCursor` as `cursor` for
the next page; absent/null `nextCursor` means the last page.

For other list endpoints (user videos, saved videos, followers/following,
comments, notifications, admin lists) the contract does not fix a scheme.

> ⚠ TO BE VERIFIED AGAINST CODE: whether the other lists use the same
> cursor scheme (`limit` + `cursor` + `nextCursor`) or page-based
> pagination. Do not build a client against an assumed scheme — read the
> route code first.

---

## 8. Hashtags & sounds

### Hashtags

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/hashtags/trending` | user | Trending hashtags |
| `GET /api/hashtags/:tag/videos` | user | Videos for one hashtag |

`GET /api/hashtags/trending` — success `200` — **verified (app
client)** shape:

```json
{ "ok": true, "hashtags": [ { "tag": "funny", "count": 42 } ] }
```

`GET /api/hashtags/:tag/videos` — success `200`:
`{ "ok": true, "videos": [ … ] }` (paginated, video objects as in §5).

> ⚠ TO BE VERIFIED AGAINST CODE: trending window and ranking (e.g. last
> 24 h by video count), the `tag` format (with or without `#`), and exact
> response fields.

### Sounds

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/sounds` | user | List sounds |
| `GET /api/sounds/:id` | user | One sound |
| `GET /api/sounds/:id/videos` | user | Videos using this sound |
| `GET /api/sounds/:id/stream` | user | Stream the audio file |
| `POST /api/sounds` | **admin** | Upload a new sound |

`GET /api/sounds` — success `200` — **verified (app client)** shape;
the client passes an optional search query `?q=…`:

```json
{ "ok": true, "sounds": [ { "id": "…", "title": "…", "artist": "…", "audioUrl": "…", "streamUrl": "…", "usesCount": 0, "durationSeconds": 0 } ] }
```

`GET /api/sounds/:id/stream` — returns the audio bytes (audio content
type), not JSON. The app client builds the URL as
`` `${API_URL}/api/sounds/${id}/stream` ``. Errors: `404` — no such sound.

`POST /api/sounds` — admin only, `multipart/form-data` with an audio file.
⚠ **DISCREPANCY — TO BE VERIFIED AGAINST CODE:** the contract lists this
endpoint as `POST /api/sounds` (admin), but the **Admin Panel client
posts new sounds to `POST /api/admin/sounds`** (FormData — verified in
`admin-website/src/api.ts`). One of the two is what the backend
implements; do not build against either until the route code settles it.

> ⚠ TO BE VERIFIED AGAINST CODE: upload field names, size/duration
> limits, and whether sounds are stored locally or on Cloudinary.

> ⚠ TO BE VERIFIED AGAINST CODE: whether sounds are seeded (the backend
> has a `backend/assets/sounds/` folder and a `loops` script —
> `npm run loops` — in `package.json`, but no seed or route code existed
> at writing time, so the sound catalogue's source is unverified).

---

## 9. Messages & real-time — `/api/conversations` + Socket.io

### REST

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/conversations` | user | List my conversations |
| `POST /api/conversations` | user | Start (or open) a conversation |
| `GET /api/conversations/:id/messages` | user | Message history (paginated) |
| `POST /api/conversations/:id/messages` | user | Send a message |
| `POST /api/conversations/:id/read` | user | Mark conversation as read |

`POST /api/conversations` — request (JSON):
`{ "userId": "…" }` (the other participant). Success `201`:
`{ "ok": true, "conversation": { "id": "…", "participants": [ … ] } }`.
If a conversation with that user already exists, the existing one is
returned — verify the status code for that case.

`POST /api/conversations/:id/messages` — request (JSON):
`{ "text": "…" }`. Success `201`:
`{ "ok": true, "message": { "id": "…", "text": "…", "senderId": "…", "createdAt": "…" } }`.

Errors: `403` — not a participant, or the other user blocked you;
`404` — no such conversation.

> ⚠ TO BE VERIFIED AGAINST CODE: exact request/response field names,
> whether group conversations exist (contract describes 1-to-1 DMs only),
> message length limits, and pagination params for history.

### Socket.io (real-time)

Connect to the same backend origin. **Verified (app client)** handshake:
`io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] })`
— the access token is sent in the Socket.io `auth` payload, not as a
query param.

Client → server events:

| Event | Payload | Purpose |
| --- | --- | --- |
| `join` | `{ "conversationId": "…" }` | Join a conversation room |
| `message:send` | `{ "conversationId": "…", "text": "…" }` | Send a message live |
| `typing` | `{ "conversationId": "…", "isTyping": true }` | Typing indicator |

Server → client events:

| Event | Payload | Purpose |
| --- | --- | --- |
| `message:new` | `{ "message": { … } }` | A new message arrived |
| `message:read` | `{ "conversationId": "…", "userId": "…" }` | The other side read the messages |
| `notification:new` | `{ "notification": { … } }` | A new notification (like, follow, comment, …) |

> ⚠ TO BE VERIFIED AGAINST CODE: the exact event payload shapes (the
> event names above are from the contract and the client connects as
> shown; the server-side emit payloads are not pinned down).

---

## 10. Notifications — `/api/notifications`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/notifications` | user | List my notifications (paginated) |
| `POST /api/notifications/:id/read` | user | Mark one as read |
| `POST /api/notifications/read-all` | user | Mark all as read |

Success `200`: list returns — **verified (app client)**
`NotificationItem` shape:

```json
{ "ok": true, "notifications": [ { "id": "…", "type": "like", "title": "…", "body": "…", "actorUsername": "…", "videoId": "…", "userId": "…", "read": false, "createdAt": "…" } ] }
```

Read endpoints return `{ "ok": true }`. The read-all path
`POST /api/notifications/read-all` is **verified (app client)** literal.

> ⚠ TO BE VERIFIED AGAINST CODE: the `type` values (`like`, `follow`,
> `comment`, …), and whether notifications are also pushed over
> Socket.io only or also stored.

---

## 11. Creator stats — `/api/creator`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/creator/stats` | user | Own creator dashboard numbers |

Success `200` — **verified (app client)** `CreatorStats` shape:

```json
{
  "ok": true,
  "stats": {
    "totalVideos": 0, "totalViews": 0, "totalLikes": 0,
    "totalFollowers": 0, "totalComments": 0,
    "viewsLast7Days": [ { "date": "2026-11-14", "views": 0 } ],
    "topVideos": [ { "id": "…", "caption": "…", "viewsCount": 0 } ]
  }
}
```

---

## 12. Live — `/api/live`

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/live/availability` | user | Is live streaming available? |
| `POST /api/live/start` | user | Start a live stream |
| `GET /api/live` | user | List live streams |

**Default behaviour (no provider configured, `LIVE_PROVIDER=none`):**

```json
// GET /api/live/availability
{ "ok": true, "available": false, "reason": "…" }
```

The `reason` field is **verified (app client)** — the client reads
`{ available, reason }`. The `provider` field shown in earlier drafts is
not sent by the client shape; the contract's `available: false` is the
key fact.

```json
// POST /api/live/start
{ "ok": false, "error": "Live streaming is not available" }   // HTTP 503
```

`GET /api/live` returns an empty list while unavailable:
`{ "ok": true, "live": [] }`.

**This is honest by design.** Live streaming needs a provider
(`LIVE_PROVIDER=mux` or `livekit` plus `LIVE_API_KEY` /
`LIVE_API_SECRET`). Until one is configured, the app must show "Live
streaming is unavailable" and must never show a fake live stream, fake
viewers, or a fake LIVE badge.

> ⚠ TO BE VERIFIED AGAINST CODE: the exact `availability` response fields,
> the `503` error string, the start-stream request/response shape when a
> provider IS configured, and whether starting a stream requires any
> special role.

---

## 13. Admin — `/api/admin`

Admin calls use a **separate admin token**: log in at
`POST /api/admin/login` and send the returned token as
`Authorization: Bearer <adminToken>`. A normal user token does **not**
grant admin access. **Verified (admin client):** the admin token is kept
in `localStorage` (`alizain-tiktok-admin-token`, refresh token under
`alizain-tiktok-admin-refresh`), and the Admin Panel calls the API on
the **relative path `/api`** — because the panel is served from the same
Netlify site as the backend function, **no `VITE_API_URL` is needed**.
Admin roles are `super_admin` | `admin`; the Settings and Audit Logs
pages are Super Admin only (verified in `admin-website/src/App.tsx`).

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/admin/setup` | public, first-use only | Create the Super Admin (no default password) |
| `POST /api/admin/login` | public | Admin login |
| `GET /api/admin/stats` | admin | Dashboard totals |
| `GET /api/admin/users?search=&status=` | admin | User list (paginated) |
| `GET /api/admin/videos` | admin | Video list (paginated) |
| `GET /api/admin/comments` | admin | Comment list (paginated) |
| `GET /api/admin/reports?status=` | admin | Reports queue (users + videos) |
| `GET /api/admin/sounds` | admin | Sound list |
| `GET /api/admin/hashtags` | admin | Hashtag list |
| `GET /api/admin/creators` | admin | Creator list / leaderboard |
| `GET /api/admin/announcements` | admin | Announcement list |
| `GET /api/admin/settings` | admin | Platform settings |
| `GET /api/admin/storage` | admin | Storage usage (local / Cloudinary) |
| `GET /api/admin/audit-logs` | admin | Admin action log |
| `GET /api/admin/live` | admin | Live-stream status / streams |
| `POST /api/admin/users/:id/suspend` | admin | Suspend a user |
| `POST /api/admin/users/:id/restore` | admin | Restore (unsuspend) a user |
| `POST /api/admin/reports/:id/review` | admin | Review / resolve a report |
| `POST /api/admin/announcements` | admin | Create an announcement |
| `POST /api/admin/sounds` | admin | Upload a new sound (FormData) |
| `PATCH /api/admin/settings` | admin | Update platform settings |
| `DELETE /api/admin/videos/:id` | admin | Delete a video |
| `DELETE /api/admin/comments/:id` | admin | Delete a comment |
| `DELETE /api/admin/sounds/:id` | admin | Delete a sound |
| `DELETE /api/admin/hashtags/:tag` | admin | Delete a hashtag |

All admin paths in this table are **verified (admin client)** literal
paths from `admin-website/src/api.ts`. The contract's
`POST /api/sounds` (admin) disagrees with the client, which posts to
`POST /api/admin/sounds` — see §8. The server route still has to be
written; if it differs from the client, the backend is wrong.

### `POST /api/admin/setup` — first-use Super Admin

Public, and only works while **no Super Admin exists yet**. There is **no
default password** — the owner chooses it on first use.

Request (JSON) — **verified (admin client)**:

```json
{ "name": "…", "email": "owner@example.com", "password": "********" }
```

Success `201`: `{ "ok": true, "admin": { "id": "…", "name": "…", "email": "…", "role": "super_admin" }, "accessToken": "…", "refreshToken": "…" }`.
Errors: **`403`** — a Super Admin already exists (verified in the admin
client comment: "Backend returns 403 when one already exists"); `400` —
validation failed.

> ⚠ TO BE VERIFIED AGAINST CODE: minimum password length.

### `POST /api/admin/login`

Request (JSON): `{ "email": "…", "password": "…" }`.
Success `200`: `{ "ok": true, "admin": { … }, "accessToken": "…", "refreshToken": "…" }`.
Errors: `401` — wrong credentials.

### Suspend / restore

Suspending a user blocks their login and hides their content until an admin
restores them. **Verified (admin client)** literal paths:

- `POST /api/admin/users/:id/suspend` with body `{ "reason": "…" }`
  (reason optional) → `{ "ok": true }`
- `POST /api/admin/users/:id/restore` (no body) → `{ "ok": true }`

### Review a report

**Verified (admin client)** literal path:

- `POST /api/admin/reports/:id/review` with body
  `{ "action": "dismiss" | "remove_content" | "suspend_user", "note": "…" }`
  (`note` optional) → `{ "ok": true }`

### Announcements, settings, storage, audit logs, live

**Verified (admin client)** shapes:

- `POST /api/admin/announcements` — body `{ "title": "…", "body": "…" }`
  → `{ "ok": true, "announcement": { "id": "…", "title": "…", "body": "…", "createdAt": "…" } }`.
- `PATCH /api/admin/settings` — body is any subset of
  `{ "appName": "…", "maxVideoSeconds": 30, "registrationOpen": true, "maintenanceNote": "…" }`.
- `GET /api/admin/stats` — `{ "ok": true, "stats": { "totalUsers": 0, "totalVideos": 0, "totalViews": 0, "totalLikes": 0, "reportsOpen": 0, "storageUsedBytes": 0, "totalComments": 0, "totalSounds": 0, "liveNow": 0 } }`.
- `GET /api/admin/storage` — `{ "ok": true, "storage": { "provider": "local" | "cloudinary", "videosBytes": 0, "totalBytes": 0, "videosCount": 0, "usersCount": 0, "note": "…" } }`.
- `GET /api/admin/audit-logs` — `{ "ok": true, "logs": [ { "id": "…", "action": "…", "adminEmail": "…", "adminId": "…", "targetType": "…", "targetId": "…", "detail": "…", "createdAt": "…" } ] }`.
- `GET /api/admin/live` — `{ "ok": true, "streams": [ { "id": "…", "title": "…", "username": "…", "status": "…", "viewers": 0, "startedAt": "…" } ], "provider": { "configured": false, "provider": null } }`.

### Admin deletes

`DELETE /api/admin/videos/:id`, `/comments/:id`, `/sounds/:id`,
`/hashtags/:tag` — success `200`: `{ "ok": true }`; `404` if not found.

> ⚠ TO BE VERIFIED AGAINST CODE: whether deleting a video also removes its
> file from storage and its comments/likes, and the exact hashtag-delete
> path parameter format (with or without `#`).

---

## 14. What was verified (2026-11-14, after re-read)

Verified by reading the files that existed at the final re-read:

- `backend/package.json` — Express 4.21.2, Prisma 6.7.0, Socket.io 4.8.1,
  Zod 3.24.2, Multer 2.0.1, `ffprobe-static` 3.1.0, Helmet 8.1.0, CORS,
  `express-rate-limit` 8.0.1, bcryptjs 3.0.2, jsonwebtoken 9.0.2,
  Cloudinary 2.6.1, dotenv 17.2.1. Scripts: `dev` (`tsx watch
  src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`),
  `seed` (`tsx prisma/seed.ts`), `prisma:migrate` / `prisma:deploy` /
  `prisma:generate`, `typecheck`. Engines: Node `>= 20`.
- `backend/.env.example` — `DATABASE_URL`, `JWT_SECRET`,
  `JWT_REFRESH_SECRET`, `PORT=4000`, `UPLOAD_DIR=./uploads`,
  `PUBLIC_APP_URL`, `CORS_ORIGINS`, `CLOUDINARY_*` (optional, all three
  required), `LIVE_PROVIDER` (`none | mux | livekit`, default `none`),
  `LIVE_API_KEY`, `LIVE_API_SECRET`.
- `android-app/src/api/client.ts` — every endpoint path, request field
  name, response unwrap (`data` key), token storage (SecureStore),
  401 → refresh → retry-once behaviour, Socket.io auth handshake.
- `android-app/src/api/types.ts` — `User`, `VideoItem`, `CommentItem`
  (nested `replies`), `SoundItem`, `Conversation`, `ChatMessage`,
  `NotificationItem`, `CreatorStats`, `FeedPage` (`videos` +
  `nextCursor`), `AuthResult`.
- `android-app/src/theme.ts`, `app.config.ts`, `eas.json` — design
  tokens, package `com.alizain.tiktok`, EAS profiles (see `eas-build.md`).
- `admin-website/src/api.ts` — every admin path, request/response
  shapes, relative `/api` base (no `VITE_API_URL`), token in
  localStorage, Super Admin-only Settings/Audit Logs.
- `netlify.toml` + `netlify/functions/api.ts` — real build command
  (incl. `prisma migrate deploy` + `seed` at build time), redirects,
  serverless-http wrapper importing `app` from `backend/src/app`.
- Root `package.json` — npm workspaces
  (`admin-website`, `backend`, `netlify/functions`), Node `>= 20`.

Not verified at writing time (no files existed yet):

- `backend/src/routes/*` — no route files. **This is the one remaining
  gap: every ⚠ TO BE VERIFIED item in this document is a backend item.**
- `backend/prisma/schema.prisma` and `backend/prisma/seed.ts` — no files.
- `backend/src/index.ts` — no file.
- `backend/src/lib/*`, `backend/src/middleware/*` — no files (rate-limit
  numbers, upload validation and auth middleware live here).
- `backend/src/app.ts` — exists **only as a temporary harness stub**
  (header: "TEMPORARY HARNESS STUB — NOT the real backend … DELETE THIS
  FILE before the real backend/src/app.ts lands"). Verified from it:
  the envelope shape and `GET /health` → `{ok:true}` with no database.
  Everything else in it is a stub (500 for `/api/admin`, 404 for
  `/api`).

**Known discrepancy found by verification:** the contract lists admin
sound upload as `POST /api/sounds`, but the Admin Panel client posts to
`POST /api/admin/sounds`. The backend must implement one of them and
this document + the client must be corrected to match — see §8.
