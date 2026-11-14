# ALIZAIN TIKTOK — Android App

Short-video social platform (TikTok-inspired, original branding). React Native + Expo SDK 53, TypeScript strict, React Navigation.

> **Brand note:** the logo is original styled text + a simple red/cyan play-mark drawn for this project. It does **not** use TikTok's note logo or any TikTok trademark asset.

## Screens (22, all wired to the API — no fake data)

| Screen | File | API |
|---|---|---|
| Splash | `src/screens/SplashScreen.tsx` | — |
| Onboarding | `src/screens/OnboardingScreen.tsx` | — |
| Sign Up | `src/screens/SignUpScreen.tsx` | `POST /api/auth/register` |
| Login | `src/screens/LoginScreen.tsx` | `POST /api/auth/login` |
| Forgot Password | `src/screens/ForgotPasswordScreen.tsx` | `POST /api/auth/forgot-password` (code **shown in-app** — no email provider configured), `POST /api/auth/reset-password` |
| For You Feed + Following Feed | `src/screens/HomeScreen.tsx` (toggle) | `GET /api/videos/feed?tab=for_you\|following`, `POST /api/videos/:id/view` (once per view) |
| Video Upload | `src/screens/UploadScreen.tsx` | picker + duration check via expo-av |
| Video Editor | `src/screens/VideoEditorScreen.tsx` | `POST /api/videos/upload` (multipart video + thumbnail + caption + hashtags + soundId), progress bar, processing status |
| Search | `src/screens/SearchScreen.tsx` | `GET /api/users/search?q=` |
| Discover | `src/screens/DiscoverScreen.tsx` | `GET /api/hashtags/trending`, `GET /api/users/search?q=` |
| User Profile | `src/screens/ProfileScreen.tsx` | `GET /api/users/:username`, `GET /api/users/:username/videos`, `GET /api/users/me/saved`, follow/unfollow, `POST /api/conversations` |
| Edit Profile | `src/screens/EditProfileScreen.tsx` | `PATCH /api/users/me` |
| Notifications | `src/screens/NotificationsScreen.tsx` | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` |
| Comments | `src/screens/CommentsScreen.tsx` (+ `src/components/CommentSheet.tsx` bottom sheet) | `GET/POST /api/videos/:id/comments`, like/unlike/delete comment, replies |
| Direct Messages | `src/screens/MessagesScreen.tsx` | `GET /api/conversations` |
| Chat Screen | `src/screens/ChatScreen.tsx` | `GET/POST /api/conversations/:id/messages`, `POST /api/conversations/:id/read`, Socket.io `join` / `message:send` / `typing` / `message:new` |
| Music Library | `src/screens/MusicScreen.tsx` | `GET /api/sounds?q=`, `GET /api/sounds/:id/stream` (preview), pick sound → Video Editor |
| Hashtag Pages | `src/screens/HashtagScreen.tsx` | `GET /api/hashtags/:tag/videos` |
| Creator Dashboard | `src/screens/CreatorDashboardScreen.tsx` | `GET /api/creator/stats` |
| Settings | `src/screens/SettingsScreen.tsx` | `GET /health`, logout |
| Privacy Settings | `src/screens/PrivacyScreen.tsx` | `PATCH /api/users/me` |
| Report Content | `src/screens/ReportScreen.tsx` | `POST /api/videos/:id/report`, `POST /api/users/:id/report` |
| Live (extra) | `src/screens/LiveScreen.tsx` | `GET /api/live/availability` → `{available:false}` — **live streaming is honestly unavailable until a provider is configured; nothing is faked** |

Bottom tabs (5): **HOME** (For You + Following toggle) · **DISCOVER** · **CREATE** · **INBOX** · **PROFILE**.

## Video rules

- **Max 30 seconds.** The picked asset's duration is checked with expo-av **before** upload and videos over 30s are rejected with a clear message. The server also rejects >30s.
- Vertical full-screen feed: `FlatList` paging + snap, auto-play visible video, pause on scroll-away/blur, tap = pause/resume, **double-tap = like**, like/unlike, comments + replies (bottom sheet), share via Share API (increments server count), save/favorites, follow button on videos, tappable hashtags → Hashtag page, thumbnails generated with `expo-video-thumbnails` and uploaded with the video, views counted once per video view, upload progress bar (`axios onUploadProgress`), processing status (`queued → ready`).
- Empty states say the platform is empty, e.g. *"No videos yet — be the first to upload!"* — no fake videos, users, likes or views anywhere.

## API configuration (owner must do this)

The app never ships a `localhost` URL. The base URL comes from Expo config `extra.apiUrl`:

```bash
# 1. Set your deployed backend URL (the backend built in parallel to this app)
EXPO_PUBLIC_API_URL=https://your-api-host.example.com

# 2. Run
npm install
npx expo start
```

- Default placeholder if unset: `https://YOUR-API-URL` (login/signup show a warning until it is set).
- Auth: `Authorization: Bearer <accessToken>`; access token 15 min + refresh token 30 days. Tokens live in `expo-secure-store`; the typed client (`src/api/client.ts`) auto-refreshes on 401. User profile is cached in AsyncStorage.
- All endpoints are typed methods on the `api` client in `src/api/client.ts` (`src/api/types.ts` for the types).

## Run with Expo Go

```bash
npm install
EXPO_PUBLIC_API_URL=https://your-api-host.example.com npx expo start
# scan the QR code with Expo Go (Android)
```

## Build an APK / AAB (owner, on their machine / EAS account)

EAS Build is **not** run here — no APK/AAB was produced in this workspace.

```bash
npm install -g eas-cli
eas login            # owner's Expo account
eas build --platform android --profile preview      # APK (internal)
eas build --platform android --profile production   # AAB (Play Store)
```

Profiles are in `eas.json` (`preview` → APK, `production` → AAB). `app.config.ts` uses slug `alizain-tiktok`, package `com.alizain.tiktok`. Set `EXPO_PUBLIC_API_URL` as an EAS environment variable / secret before building so the shipped app points at the real backend (or rebuild after changing it).

## Project structure

```
app.config.ts            # name ALIZAIN TIKTOK, slug, extra.apiUrl
eas.json                 # preview (APK) + production (AAB) profiles
src/api/client.ts        # typed API client, SecureStore tokens, 401 auto-refresh
src/api/types.ts         # User, VideoItem, CommentItem, SoundItem, ...
src/store/AuthContext.tsx# auth state (signIn/signOut/refreshUser)
src/store/socket.ts      # socket.io-client connect/disconnect
src/navigation/          # AppNavigator (auth vs main stacks), types
src/screens/             # one file per screen (22 + Inbox + Live)
src/components/          # VideoCard, CommentSheet, Logo (original), ui helpers
src/theme.ts             # black bg, red #FF2E4D, cyan #00E5D4, white text
assets/                  # original icon / adaptive icon / splash / favicon
```

## Verification status (2026-11-14, this workspace)

- `npx tsc --noEmit` — **clean, exit 0** (strict mode).
- `npx expo export --platform web` — **clean, exit 0** (635 modules, `dist/index.html` + 1.05 MB JS bundle). This proves the bundle compiles. Two fixes were needed on the way: `expo-video-thumbnails` was removed from the `plugins` list in `app.config.ts` (it has no config plugin; listing it made config evaluation `require()` its native entry in Node) and `expo-asset` was pinned to `~11.1.7` (SDK 53 match — plain `npm install` had pulled v58 for a newer SDK). Thumbnails use a platform split: `src/utils/thumbnails.native.ts` (real, iOS/Android) vs `src/utils/thumbnails.ts` (web stub, returns null — web has no thumbnail generation).
- **Not done here (explicitly out of scope):** EAS builds / APK / AAB, real-device testing, and live-backend end-to-end tests — the backend was built in parallel and was not available as a live URL at build time, so every screen that calls the API is wired to the contract but **not yet tested against a live server**. See `src/api/client.ts` for the exact contract.
- **Assets:** all four files referenced by `app.config.ts` exist and were visually checked — `assets/icon.png` (1024×1024), `assets/adaptive-icon.png` (1024×1024, transparent background), `assets/splash.png` (1284×2778), `assets/favicon.png` (48×48). Original artwork only: red rounded square + cyan edge + white play triangle with "ALIZAIN" (white) / "TIKTOK" (cyan) text mark. No TikTok assets.
