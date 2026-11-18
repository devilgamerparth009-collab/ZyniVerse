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
- **Size:** 42,082,269 bytes (~40.1 MB)
- **SHA-256:** `7acd3613cbf93cb5166209eb2652c8241f7e71e74135e47d7dd849c7218d13fc`
- **Package / version:** `app.zyverse.mobile`, `1.4.0 / 140000` (confirmed with `aapt dump badging`)
- **Build:** `assembleRelease --no-daemon` — `BUILD SUCCESSFUL in 3m 20s`
- **Checks:** root `npx tsc --noEmit` clean; mobile `npx tsc --noEmit` clean;
  `63` vitest tests passed (`sw-freshness`, `offline-policy`); targeted ESLint
  on all changed website files clean. Full lint remains red only from
  pre-existing, out-of-scope files.
- **Direct APK URL:** `https://zyverse.in/ZyniVerse-1.4.0.apk` with an Android
  browser UA → HTTP `200`, `application/vnd.android.package-archive`,
  42,082,269 bytes, SHA-256 exactly as above.
- **Device:** installed on `192.168.1.46:38343`. Android refuses a version
  downgrade of a non-debuggable release even with `adb install -d`, so the
  interim `1.8.0` build was uninstalled first (app data lives on the server).
  `dumpsys package` reports `1.4.0 / 140000`; launch produced no
  FATAL / ReactNativeJS crash and the app process stayed alive.

## Production deployment

- **Deploy:** `dpl_J4Lhg29cZjQ4jnZPBM4nVsUeegpc` — `READY`, aliased to
  `https://zyverse.in`.
- **Verified 200:** `/api/mobile/version` (`140000` and `180000`),
  `/api/dub/overview`, `/api/dub/schedule?limit=200`, `/api/dub/sources`,
  `/hindi-dub`, `/hindi-dub-schedule`, `/genres`, `/studios`, `/watch`, `/dubbed`.
- **Version API:** `140000` → `update=False, rollback=False`; `180000` →
  `update=True, rollback=True, mandatory=False`, size/hash/URL matching the
  published APK above.
- **Production data:** `1,219` titles, `10` languages, `60` genres, `2`
  catalogues labelled `Dub Hub`; `28` airings across `8` groups plus `2`
  unscheduled rows. Earlier WordPress sync: `fetched 691`, `upserted 691`,
  `errors []`.
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
| Device tap-through | Device was PIN-locked after install; native launch was verified crash-free, but a fresh manual in-app click-through was not possible. |
| Security upgrade | Separate worktree `C:\Users\ParthGupta\ZyniVerse-security`, branch `security-upgrade`, commit `0a09868` (Next.js `16.4.2` → `16.4.6`). Website fixes were selectively merged into main; the upgrade itself stays separate. PR not publishable while GitHub is suspended. |
