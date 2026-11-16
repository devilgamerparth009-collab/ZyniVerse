# ZyniVerse 1.6.0 — Release Status

## What shipped

- **In-app APK updater (no browser / no Play Store)**
  - `GET /api/mobile/version` returns the latest build, notes, APK URL and size.
  - App checks on launch, downloads in the background and offers a one-tap install.
  - Native `Settings → App update` screen with progress, skip and retry.
  - Downloads are verified against the published byte size, so a truncated APK can never reach the installer.
  - `REQUEST_INSTALL_PACKAGES` permission + Android installer intent.
- **Server-driven content (no APK update needed)**
  - `GET /api/mobile/feed` + `src/content/mobile-feed.json`.
  - Home shows a dismissible announcement card and spotlight rail pushed by the server.
- **TV & Streaming**
  - All 20 channel logos bundled in `public/channel-logos/*.png` (trimmed, white-flattened).
  - `logoProxyUrl` serves the local PNG; the API route falls back to remote, then a branded wordmark.
  - Rebuilt guide: stats hero, live strip, 2-column channel wall, richer channel sheet.
- **Profile / auth**
  - Stale session (`Unauthorized` / 401) now shows a Sign In CTA instead of an error screen.
  - Website-set avatar renders through the cached image proxy; initials fallback if it fails.
  - Edit Profile previews the selected avatar immediately and has an always-visible Save bar.
  - Settings entry restored in the profile banner; version read from the installed APK.
- **Native screens (no WebView)**
  - Messages, Chat, Friends, Public Profile, Social Feed and generic Hub screens.
  - FunZone website tiles remapped to native routes; browser only for external pages/playback.
- **New endpoints**
  - `GET /api/users/[username]` public profile + follow/friend status.
  - `GET /api/mobile/download` stable APK redirect.
  - `/download` landing page.

## Build

- **APK:** `app-release.apk` / `dist/ZyniVerse-1.6.0.apk`
- **Size:** 42,052,121 bytes (~40.1 MB)
- **SHA-256:** `8b0199df768fa396104133cd789d536ad851296ac33cd223707d4dbc03d6a498`
- **versionCode:** 160000
- **versionName:** 1.6.0
- **Package:** `app.zyverse.mobile`
- **Signing cert SHA-256:** `a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e`
- Build command: `mobile\android\gradlew.bat assembleRelease --no-daemon` (BUILD SUCCESSFUL, 3m 35s)

## Verification

| Check | Result |
|---|---|
| Root `npx tsc --noEmit` | clean |
| Mobile `npx tsc --noEmit` | clean |
| `GET /api/mobile/version?versionCode=150000` | 200, `updateAvailable: true` |
| `GET /api/mobile/version?versionCode=160000` | 200, `updateAvailable: false` |
| `GET /api/mobile/feed` | 200, announcement + spotlight |
| `GET /channel-logos/netflix_anime.png` | 200, `image/png` |
| `GET /channel-logos/pogo.png` | 200, `image/png` |
| `GET /api/users/ZyniBot` | 200, public profile payload |
| `GET /download` | 200 |
| `GET /api/mobile/download` | 302 → GitHub release asset |
| GitHub release `v1.6.0` | created, asset uploaded |
| Release asset URL | 200, 42,052,121 bytes, `application/vnd.android.package-archive` |
| Release asset digest | `sha256:8b0199df…` (matches local APK) |
| Production `https://zyverse.in` deploy | live (`c3bbc56`) |

## Pending (manual)

- Device install / smoke test once a phone is reachable over ADB.
- Play Console upload + store listing assets.
- Remove the dead `ws.zyverse.in` DNS record (points at `153.52.255.71`).
