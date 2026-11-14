# ALIZAIN TIKTOK — EAS Build Guide (APK / AAB)

> **Verification status (2026-11-14, updated after a re-read of the
> tree).** `android-app/eas.json` and `android-app/app.config.ts` are
> real and verified (see §3). No EAS build has been run for this project,
> no APK/AAB exists, and no Expo account or Play Store step was done
> here. Two blockers were found by verification (see §3): the EAS
> project ID is still a placeholder, and the app icon/splash images
> referenced by the config do not exist yet. Everything below that
> depends on a file that does not exist yet is marked **⚠ TO BE VERIFIED
> / TO BE CREATED**.

## 1. What EAS Build is — and what was NOT done here

- **Expo EAS Build** builds the Android app (APK for testing, AAB for the
  Play Store) on Expo's servers from the `android-app/` source.
- The build runs under the **owner's Expo account** (free tier available).
- **The EAS build was NOT run here.** No APK and no AAB was produced by
  this documentation task, no Expo account was created or used, and no
  app was submitted to Google Play. The owner (or someone with the
  owner's Expo account) must run the steps below.

## 2. Prerequisites (owner side)

1. An **Expo account** (free) — create at expo.dev, owned by the project
   owner. Do not share the password with anyone building the app; the
   person running the build signs in with it.
2. **Node 20+** and the `android-app/` source (see `installation.md`).
3. The **production backend URL** — the deployed backend from
   `deployment.md`. The app bakes `EXPO_PUBLIC_API_URL` in at build time,
   so deploy the backend **first**.
4. For Play Store submission only: a **Google Play developer account**
   (one-time paid registration, owned by the project owner).

## 3. `eas.json` profiles — verified, with two blockers

The real `android-app/eas.json` (verified verbatim):

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  },
  "submit": { "production": {} }
}
```

| Profile | Output | Use |
| --- | --- | --- |
| `preview` | **APK** | Share with testers — installs directly on a phone, no Play Store needed |
| `production` | **AAB** | Play Store release |

There is **no `development` profile** — do not run
`eas build --profile development`; use `npx expo start` locally instead.
`appVersionSource: remote` means EAS reads the version from the Expo
project (remote) rather than the local config — the local
`version: '1.0.0'` in `app.config.ts` is the starting point.

**Verified in `android-app/app.config.ts`:** name `ALIZAIN TIKTOK`,
slug `alizain-tiktok`, version `1.0.0`, portrait orientation, dark UI,
scheme `alizain-tiktok`, Android package **`com.alizain.tiktok`**,
iOS bundle ID `com.alizain.tiktok`, plugins `expo-av`,
`expo-image-picker`, `expo-video-thumbnails`.

**⚠ BLOCKER 1 — EAS project not linked.** `app.config.ts` sets
`extra.eas.projectId` to `00000000-0000-0000-0000-000000000000`
(a placeholder). Before the first build, the owner must link the app
to their Expo project: run `eas init` in `android-app/` while signed in
to the owner's Expo account, and let it write the real project ID.
Without this, EAS builds will fail.

**⚠ BLOCKER 2 — app images missing.** `app.config.ts` references
`./assets/icon.png`, `./assets/splash.png`,
`./assets/adaptive-icon.png` and `./assets/favicon.png`, but
`android-app/assets/` is **empty**. Create these images first —
Expo/EAS builds fail without an icon and splash image. Keep the
package name (`com.alizain.tiktok`) identical forever once the first
build is made: changing it makes Play treat the app as a different app.

## 4. Build the APK (preview — for testers)

```bash
cd android-app
npm install -g eas-cli        # once, on the build machine
eas login                     # owner's Expo account
EXPO_PUBLIC_API_URL=https://<your-deployed-backend> eas build -p android --profile preview
```

- EAS builds on its servers and prints a download link when done.
- Install the APK on a phone by opening that link (allow "install unknown
  apps" for the browser if asked).
- The APK talks to the **production** backend URL baked in via
  `EXPO_PUBLIC_API_URL`. Rebuild if the backend URL changes.

## 5. Build the AAB (production — for the Play Store)

```bash
cd android-app
EXPO_PUBLIC_API_URL=https://<your-deployed-backend> eas build -p android --profile production
```

This produces an **AAB** (Android App Bundle), the format Play requires.
An AAB cannot be installed directly on a phone — it is for store
submission only. For on-phone testing use the preview APK (§4).

## 6. Submit to the Play Store

Prerequisites: Google Play developer account (owner's), app listing
(title, description, screenshots, privacy policy URL, content rating),
and the production AAB from §5.

```bash
cd android-app
eas submit -p android --profile production
```

EAS will ask for the Play service-account key the first time — follow the
prompts; the key belongs to the owner's Play account. After submission,
review and rollout happen in the Google Play Console, not in EAS.

## 7. Versioning — do this before every release build

- Bump `version` (and `android.versionCode`) in `app.json` for every new
  build you want Play/testers to treat as newer. Re-using a version code
  makes Play reject the upload.
- Keep the **package name** identical forever.
- Keep a note of which backend URL (`EXPO_PUBLIC_API_URL`) each build was
  made with — a build pointed at a local/dev URL will not work for
  testers.

## 8. What the build does NOT do

- It does **not** deploy the backend or the admin website (see
  `deployment.md`).
- It does **not** create the Neon database or set server env vars.
- It does **not** configure Cloudinary or a live-streaming provider.
- It does **not** publish the app by itself — Play submission (§6) and
  Google's review are separate steps.
- Admin/content changes never need a rebuild (see `deployment.md` §9).

## 9. Troubleshooting

| Problem | Likely cause / fix |
| --- | --- |
| `eas login` fails | Wrong Expo account / password, or no network. The owner's account must be used. |
| Build fails: missing `eas.json` / app config | Create them first (§3). |
| APK installs but shows "cannot reach server" | Built with the wrong `EXPO_PUBLIC_API_URL` (e.g. `localhost`). Rebuild with the deployed backend URL. |
| Play rejects the AAB | Version code not bumped, or package name changed, or signing key mismatch. Check §7. |
| Build fails on a native module | Check the failing step in the EAS build log; the app uses `expo-av`, `expo-image-picker`, `expo-video-thumbnails` (verified in `android-app/package.json`). |

## 10. What was verified

- `android-app/package.json`: Expo SDK 53, React 19, React Native 0.79.5;
  scripts `android` (`expo run:android`), `export:web`, `typecheck`.
- `android-app/eas.json` (verbatim in §3) and `android-app/app.config.ts`
  (name, slug, version 1.0.0, package `com.alizain.tiktok`, plugins).
- Blockers found: EAS project ID is a placeholder
  (`00000000-0000-0000-0000-000000000000`); `android-app/assets/` is
  empty although the config references icon/splash/adaptive-icon/favicon.
- No EAS build, no APK/AAB, no Expo account use, and no Play submission
  existed or was done at writing time.
