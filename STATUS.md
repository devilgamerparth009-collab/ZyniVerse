# ZyniVerse 1.8.0 — Release Status

## What changed in 1.8.0

- **Unified Dub Hub** (`mobile/src/screens/HindiDubScreen.tsx`)
  - One place instead of scattered entries: `All / Series / Movies / Schedule / Languages / Genres / Sources`.
  - Schedule tab has **Full week** and **Tonight** views, IST timings, and `TBA`/`Unscheduled` labels for blank source rows.
  - Search, language/genre filters, sorting and pagination work inside the same screen.
  - Profile shortcut in the header; source deep-links open the original site.
- **Duplicate navigation removed**
  - Home, Dubbed and FunZone now point to the single Dub Hub instead of separate `DailyDubSchedule`, `LiveDubs`, `TVGuide` dub banners and `Schedule` quick actions.
  - Labels normalised to `Dub Hub`, `Dub Schedule`, `Live TV`.
- **Direct source ingestion**
  - `src/lib/dub-import/wp-api.ts` uses the public WordPress REST API of `animedubhindi.link` (`/wp-json/wp/v2/posts`, `/categories`) with HTML listing fallback.
  - Category map yields 9 languages, 21 canonical genres, 2 kinds; genre aliases such as `Sci FI` / `Action Amp Adventure` are normalised.
  - Live sync result: `fetched 691`, `upserted 691`, `errors []`; catalogue now `663 ADH + 556 DDS = 1,219`; schedule `28 airings` from `schedule.php`.
- **New website endpoints**
  - `GET /api/dub/overview`, `GET /api/dub/genres`, `GET /api/dub/catalog?genre=...&kind=...`, `GET /api/dub/schedule`, `GET /api/dub/languages`, `GET /api/dub/sources`.
  - `/hindi-dub` now has a **Browse by genre** section linking to `/hindi-dub/series?genre=...`.
- **Profile parity**
  - Added real tabs: `Lists`, `Reviews`, `Stats`, `Badges`, `Activity`, `More`.
  - `More`: edit profile, profile colour, settings, All Features, custom lists, moments, reviews, watch history, AniList/MAL import, API keys, data export, account deletion, daily reward, leaderboard.
- **New All Features screen**
  - `mobile/src/screens/AllFeaturesScreen.tsx` groups every website feature family into one searchable list. Native screens open natively; complex/UGC/admin flows open a safe `zyverse.in` link.
- **Retained from earlier releases**
  - In-app APK updater, server-driven feed, TV guide with bundled logos, native Messages/Chat/Friends/UserProfile/Feed/Hub screens, profile/avatar/settings fixes.

## Verified build

- **APK:** `dist/ZyniVerse-1.8.0.apk` (also copied to `public/ZyniVerse-1.8.0.apk` for direct hosting)
- **Size:** 42,072,829 bytes (~40.1 MB)
- **SHA-256:** `4c238f61e449ab161273d10c8a56b72bfba0a94f13373bc58c81f6497369ca11`
- **versionCode:** 180000
- **versionName:** 1.8.0
- **Package:** `app.zyverse.mobile`
- **Build:** `assembleRelease --no-daemon` — `BUILD SUCCESSFUL in 2m 28s`
- **Local checks:** root `npx tsc --noEmit` clean; mobile `npx tsc --noEmit` clean.
- **Local API checks:** `/api/dub/overview` 200, `/api/dub/genres` 200, `/api/dub/catalog?genre=Action&kind=series` 200, `/hindi-dub` 200.
- **Schedule proof:** source `schedule.php` has 28 `.card` rows and 21 `data-release` values; DB/API has 28 airings. Blank day/time rows are shown as `TBA`/`Unscheduled`, not invented.
- **Device:** installed on `192.168.1.46:45419`; `dumpsys package` reports `1.8.0 / 180000`; launch produced no FATAL/ReactNativeJS crash; Home UI dump shows the consolidated `Dub Hub` and `Dub Schedule` entries.

## Production deployment

- **Deploy:** `dpl_7SddCzLUdCm31iEd8Z3W7wtKU25K` — `READY`, aliased to `https://zyverse.in`.
- **Verified 200:** `/api/dub/overview`, `/api/dub/genres`, `/api/dub/schedule?limit=200`, `/api/dub/catalog?genre=Action&kind=series`, `/hindi-dub`, `/api/mobile/version`.
- **Production data:** `1,219` titles (`1,055` series / `164` movies), `10` languages, `28` airings across `8` groups plus `2` unscheduled rows, `60` genres in the overview (the `/api/dub/genres` endpoint returns the top `40` by default).
- **Updater:** `/api/mobile/version` now reports `1.8.0 / 180000`, size `42,072,829`, SHA-256 `4c238f61…69ca11`, APK URL `https://zyverse.in/ZyniVerse-1.8.0.apk`.
- **APK hosting:** direct URL returns HTTP 200 for browser and Android-like UAs; downloaded bytes match the published size and hash exactly. Plain `curl/` is denied by the existing WAF generic-client rule; this does not affect the app updater.
- **Device note:** final APK installed and launched crash-free before deploy; after deploy the device was PIN-locked, so a fresh in-app tap-through was not possible. Server data behind every Dub Hub tab is verified above.

## Remaining items

| Item | Status |
|---|---|
| GitHub push / release asset | Blocked: `remote: Your account is suspended.` / `403`. Source mirror and release asset can wait — the APK is served from `zyverse.in`. |
| Play Console upload | Manual store listing/signing step remains. |
| Dead DNS record | Delete `ws.zyverse.in` (`153.52.255.71`). |
| Security upgrade | Done in a separate worktree: branch `security-upgrade`, path `C:\Users\ParthGupta\ZyniVerse-security`, commit `0a09868` (Next.js `16.4.2` → `16.4.6`). Original checkout unchanged. PR not publishable because GitHub is suspended and `gh` is unavailable. |
