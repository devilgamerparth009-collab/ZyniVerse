# ZyniVerse v1.4.1 — Release Status

Current release: `1.4.1` / versionCode `140100`. This is a small, deliberate step
up from the stable `1.4.0 / 140000` build. The interim `1.6.0`–`1.8.0` builds
remain superseded; older APKs are kept in `public/` and `dist/` for reference but
are not advertised by the updater.

## What changed in 1.4.1

- **Stories and Broadcast Channels work** — the production database migration
  `20261119120000_add_social_v150` is applied, the endpoints are deployed, and an
  official `ZyniVerse` channel plus one branded welcome story are seeded from the
  existing `system-bot` account (no extra env var required).
- **Tournament voting in live brackets** — the native detail screen now sends the
  device id, reads `myVotes`, and shows Vote buttons on every live matchup in the
  current round. One vote per matchup, with optimistic counts and server
  reconciliation. Guests can vote without signing in.
- **Interface review** — every entry in All Features resolves to a real native
  screen or a real website page; the invented `/manga/1/chapters` link now points
  at the real manga catalog. The two dub-catalog redirects no longer run slow
  host probes, so they respond immediately instead of timing out.
- **Plain-English public UI** — no provider/source names or Hinglish in user
  facing copy; `Live EPG with real channel logos` is `Live TV`.
- **Honest schedule** — source `schedule.php`; blank rows render as `TBA` /
  `Unscheduled`, never invented.

## Verified 1.4.1 build

- **APK:** `dist/ZyniVerse-1.4.1.apk` (also hosted at `public/ZyniVerse-1.4.1.apk`)
- **Size:** 42,128,269 bytes
- **SHA-256:** `27e44ae300a25f843c8b07f10094153f18e7c458531cba168f6ad3a3d031684e`
- **Package / version:** `app.zyverse.mobile`, `1.4.1 / 140100` (`aapt2 dump badging`)
- **Signer:** `a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e`
  — identical to the published 1.4.0 build, so existing installs keep their data.
- **Build:** `gradlew.bat assembleRelease --no-daemon -PzyniHermescPath=<copied hermesc>`
  — `BUILD SUCCESSFUL`. Hermes is required; the JSC fallback crashes at startup.
- **Device:** installed on `192.168.1.46:42091` with `adb install -r` → `Success`.
  Launched with no FATAL / ReactNativeJS crash and the process stayed alive.
  Detailed on-screen tap-through is still pending because the test device became
  PIN-locked.
- **Checks:** root `npx tsc --noEmit --incremental false` and mobile
  `npx tsc --noEmit` both clean.

## Production verification

- `/api/stories`, `/api/channels` and `/api/character-tournaments` all return HTTP
  `200`.
- Seeded data: 1 official channel with a branded icon and welcome post, and 1
  welcome story using `https://zyverse.in/logo.png`.
- Live tournament `cmtzrog3c0001d9aui4b0ue8q` is `active`, `bracket`, round 3.
  A verification vote with a throwaway device id returned
  `{"success":true,"votesA":1,"votesB":0}` and the follow-up detail response
  contained `myVotes: {"...":"A"}` with the updated count.
- Version API / published-build registry point at `1.4.1 / 140100` with the hash
  and size above. The 1.4.0 APK, hash and URL were left untouched.

## Historical 1.4.0 notes (superseded)

- Stable rollback release with safe downgrade handling (explicit `rollback` flag;
  the client never silently accepts an older build).
- Unified Dub Hub (`All / Series / Movies / Schedule / Languages / Genres`, no
  Sources entry), animated tab pill, skeletons, branded fallbacks, fixed filler
  guide keys.
- Stale-first service worker (`public/sw.js` v7), server-rendered ISR `/dubbed`,
  deferred/throttled heavy motion, deduplicated ad-probe.
- Production data at that time: 1,219 titles, 10 languages, 60 genres, 28 airings
  across 8 groups, 21 future releases and 5 unscheduled rows.
- Cron: single daily Vercel cron `30 20 * * *` on `/api/cron/dub-sync`. Upstream
  egress from Vercel was unreliable (ADH host not resolved, DDS `403`); the route
  correctly reported failure without faking success or clearing cached data.

## Remaining items

| Item | Status |
|---|---|
| Public announcement | Hold until the Uptodown review publishes the new build. |
| Device tap-through | Stories, Channels and bracket voting verified through the API and a no-crash launch; full UI tap-through blocked by the test device PIN. |
| GitHub push / release asset | Blocked: `remote: Your account is suspended.` / `403`. The APK is served from `zyverse.in`, so this does not block users. |
| Uptodown upload | New build must be uploaded for review; the older `app.zyniverse.mobile` package has a signature mismatch from a lost keystore. |
| Play Console upload | Manual store listing/signing step remains. |
| Dead DNS record | Delete `ws.zyverse.in` (`153.52.255.71`). |
| Upstream vs Vercel egress | Watch the next daily cron; the resolver self-heals when the source answers again. |
| Security upgrade | Next.js `16.4.2` has a known advisory. The upgrade is isolated in `C:\Users\ParthGupta\ZyniVerse-security`, branch `security-upgrade`, commit `0a09868`; not merged into this release. |
