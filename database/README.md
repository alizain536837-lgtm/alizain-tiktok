# ALIZAIN TIKTOK — Database

This folder is a **mirror** of the backend's Prisma source, kept here so the
database can be reviewed and applied without digging through the backend tree.

| File | Source of truth |
|---|---|
| `schema.prisma` | Copy of `backend/prisma/schema.prisma` |
| `migrations/` | Copy of `backend/prisma/migrations/` |
| `seed.ts` | Copy of `backend/prisma/seed.ts` |

**`backend/prisma/` is the source.** If the schema changes, edit it there, run
`npx prisma migrate dev`, then re-copy the three items into this folder and
verify with `diff -r`.

## Apply to a database

```bash
cd ../backend
cp .env.example .env        # set DATABASE_URL
npx prisma migrate deploy   # applies migrations/migration.sql
npm run seed                # 6 sounds + 4 settings only
```

Or apply the SQL directly with psql:

```bash
psql "$DATABASE_URL" -f migrations/20261114173355_init/migration.sql
```

## What the schema contains

23 tables (PostgreSQL via Prisma 6): `User`, `Video`, `Like`, `Comment`,
`CommentLike`, `Follow`, `SavedVideo`, `Conversation`,
`ConversationParticipant`, `Message`, `Notification`, `Report`, `Block`,
`Sound`, `Hashtag`, `VideoHashtag`, `LiveStream`, `Setting`, `AuditLog`,
`Announcement`, `Session`, `PasswordReset`, `VideoView` (one counted view
per user per video per day).

## Seed policy

The seed is idempotent (upserts) and creates **only**:

- The 6 built-in original sounds (Upbeat Pop, Chill Lofi, Hip-Hop Beat,
  Electronic Dance, Acoustic Pluck, Cinematic — artist `Alizain TikTok
  Originals`, audio at `/sounds/<file>`).
- 4 default settings: `appName=ALIZAIN TIKTOK`, `maxVideoSeconds=30`,
  `registrationOpen=true`, `liveProvider=none`.

It **never** creates fake users, videos, likes, followers, comments or any
activity. The platform starts empty.
