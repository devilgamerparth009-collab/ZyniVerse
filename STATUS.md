# ZyniVerse v1.4.0 — Release Status

Stable rollback release. Version `1.4.0` / versionCode `140000`. The interim
`1.6.0`–`1.8.0` builds are superseded; older APKs are kept in `public/` and
`dist/` for reference but are no longer advertised by the updater.

## What changed

- **Version rollback** — app metadata, native Gradle config, updater, server
  version endpoint, in-app feed and published-build registry all report
  `1.4.0 / 140000`. `minSupportedVersionCode` stays `130000`.
- **Safe rollback handling** — the version API sets an explicit `rollback`
  flag when an installed build is newer than the stable release. The client
  only accepts an older build when that flag is present, so a bad deploy can
  never silently downgrade users. The update screen explains that Android may
  require removing the newer build first.
- **Unified Dub Hub** — one screen for `All / Series / Movies / Schedule /
  Languages / Genres`; no Sources entry. Animated tab pill, skeletons and press
  feedback, branded poster/avatar fallbacks, and fixed filler-guide keys.
- **Plain-English public UI** — Hinglish copy and upstream provider names were
  removed from the dub UI. Public DTOs neutralise source labels (`Dub Hub`),
  hostnames and sync errors. `Live EPG with real channel logos` is now `Live TV`.
- **Honest schedule** — source `schedule.php`; blank rows render as
  `TBA` / `Unscheduled`, never invented. Sync is stage-aware with per-stage
  cursors/status and never reports success or revalidates caches unless a real
  write happened.
- **Real destinations for every feature** — `/genres`, `/studios`, `/watch`,
  `/genre/[name]`, `/dubbed`, `/hindi-dub`, `/hindi-dub-schedule`,
  `/go/dub/[source]` and `/manga/[id]/chapters` all resolve to real pages.
- **Website feel / speed** — stale-first service worker (`public/sw.js` v7),
  server-rendered ISR `/dubbed`, deferred/throttled heavy motion, deduplicated
  ad-probe. `vercel.json` buildCommand explicitly runs `npm run build:sw`.

## Verified build

- **APK:** `dist/ZyniVerse-1.4.0.apk` (also hosted at `public/ZyniVerse-1.4.0.apk`)
- **Size:** 42,093,909 bytes (~40.1 MB)
- **SHA-256:** `c9178820be0b777850d187abfd5f70ff2e314aec9fa4eeb2a2d7565fc86bddd9`
- **Package / version:** `app.zyverse.mobile`, `1.4.0 / 140000` (confirmed with `aapt dump badging`)
- **Build:** `assembleRelease --no-daemon` — `BUILD SUCCESSFUL in 56s`
- **Checks:** root `npx tsc --noEmit --incremental false` clean; mobile
  `npx tsc --noEmit` clean; `npx vitest run src/__tests__/filler.test.ts`
  passed (`1` file, `6` tests); `npm run build` succeeded after the Next.js
  security-nudge retry. Full lint remains red only from pre-existing,
  out-of-scope files.
- **Direct APK URL:** `https://zyverse.in/ZyniVerse-1.4.0.apk` with an Android
  browser UA → HTTP `200`, `application/vnd.android.package-archive`,
  42,093,909 bytes, SHA-256 exactly as above. A ranged request returns HTTP
  `206` with `Content-Range: bytes 0-1023/42093909`.
- **Device:** installed on `192.168.1.46:38343` with `adb install -r` →
  `Success`. Android refuses a version downgrade of a non-debuggable release
  even with `adb install -d`, so the earlier interim `1.8.0` build had to be
  uninstalled first (app data lives on the server). The current device was
  already on `1.4.0 / 140000`; launch produced no FATAL / ReactNativeJS crash
  and the app process stayed alive. The Home `Explore ZyniVerse` row,
  announcement card and schedule cross-links were visible in the native UI.

## Production deployment

- **Deploy:** `dpl_256uWSkrjCEGXNTVyGwzVTvuatzb` — `READY`, aliased to
  `https://zyverse.in`.
- **Verified 200:** `/api/mobile/version` (`140000` and `180000`),
  `/api/dub/overview`, `/api/dub/schedule?limit=200`, `/api/filler/21`,
  `/api/dub/sources`, `/hindi-dub`, `/hindi-dub-schedule`, `/genres`,
  `/studios`, `/watch`, `/dubbed`.
- **Version API:** `140000` → `update=False, rollback=False`; `180000` →
  `update=True, rollback=True, mandatory=False`, size/hash/URL matching the
  published APK above.
- **Filler API:** `/api/filler/21` returns `found=true` with real One Piece
  guide data; misses and upstream errors stay `no-store` so a newly published
  guide is never hidden by a cached miss.
- **Production data:** `1,219` titles, `10` languages, `60` genres, `2`
  catalogues labelled `Dub Hub`; `28` airings across `8` groups, `21` future
  releases and `5` unscheduled rows. Earlier WordPress sync: `fetched 691`,
  `upserted 691`, `errors []`.
- **Cron:** single daily Vercel cron `30 20 * * *` on `/api/cron/dub-sync`.
  Production `CRON_SECRET` was set to a known value and the site redeployed;
  a Bearer-triggered call now returns HTTP `200` (previously `401`).
- **Cron honesty check:** at trigger time the upstream was unreachable from
  Vercel's egress (Anime Dub Hindi schedule host not resolved; Desi Dub Anime
  returned `403`). The route correctly returned `success=False`, left
  `lastSyncAt` unchanged, and skipped revalidation — no false success. Cached
  data stayed intact at `28` airings. `schedule.php` is reachable from the
  local network with future airings through `25 Nov 2026`, so this is an
  upstream/datacenter-IP issue, not a data or code fault; the resolver probes
  several candidate hosts and self-heals on a later run.

## Remaining items

| Item | Status |
|---|---|
| GitHub push / release asset | Blocked: `remote: Your account is suspended.` / `403`. APK is served from `zyverse.in`, so this does not block users. |
| Play Console upload | Manual store listing/signing step remains. |
| Dead DNS record | Delete `ws.zyverse.in` (`153.52.255.71`). |
| Upstream vs Vercel egress | Watch the next daily cron; the resolver self-heals when the source answers again. No code change needed for a third-party block. |
| Device tap-through | Partial: Home explore row, announcement card and schedule cross-links were verified in the native UI. `uiautomator dump` then went stale because the November Diwali animation never lets the view hierarchy idle, so Dub Hub tab scroll/labels, the live countdown, filler guide and the removed mobile AniList button still need a manual tap-through. |
| Security upgrade | `npm run build` warns that Next.js `16.4.2` has a known vulnerability and suggests the security upgrade command. The upgrade remains separate in `C:\Users\ParthGupta\ZyniVerse-security`, branch `security-upgrade`, commit `0a09868` (Next.js `16.4.2` → `16.4.6`); website fixes were selectively merged into main. PR not publishable while GitHub is suspended. |

## v1.5.0 social branch (in progress, not shipped)

- **Branch:** `social-v1.5.0`. `v1.4.0` APK/hash/URL and the deployed website are
  untouched by this work.
- **Added:** people discovery with reasons, tappable follower/following lists,
  Instagram-style broadcast channels, 24h stories, chat reactions/delete/typing,
  and real empty-state entry points on both platforms. Full details and the
  required migration are in `docs/v150-social-features.md`.
- **Cannot deploy before:** `npx prisma migrate deploy` is run on the production
  database, and `ZYVERSE_OFFICIAL_USER_ID` is set if the official seed channel is
  wanted.
- **Verification:** root and mobile typechecks clean; filler tests 6/6;
  `npm run build` succeeded after the standard security-nudge retry (795 pages,
  including all new social routes).
