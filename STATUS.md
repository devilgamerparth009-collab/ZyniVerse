# ZyniVerse v1.4.3 â€” Release Status

Current release: `1.4.3` / versionCode `140300`. It replaces `1.4.2 / 140200`
as the advertised build while keeping `v1.4.1` and `v1.4.2` APKs valid and
published. The new APK uses the **same signing certificate**, so an in-place
update keeps lists, messages and settings. Older APKs stay in `public/` and
`dist/` for reference only.

## What changed in 1.4.3

- **No third-party website shortcuts** â€” user-facing taps from the APK stay on
  `zyverse.in`; Dub Hub, news, feed, channels, alerts and media tiles no longer
  open third-party sites.
- **Aurora Launch theme** â€” the Diwali skin is replaced with the Aurora Launch
  palette and a softer glow overlay; public UI copy remains plain English.
- **Episode Pulse** â€” a new native screen shows anonymous, aggregate episode
  reactions from public `/api/episodes/hot?days=7&limit=12`; it only routes to
  `AnimeDetail`.
- **Stale Install button fix** â€” cached APK code/hash/size are validated against
  the installed build and latest server release before Install is offered.
- **APK verification retained** â€” downloads are still checked against the
  published SHA-256 hash and byte size before install; failed or stale files
  are deleted instead of installed.

## Verified 1.4.3 build

- **APK:** `dist/ZyniVerse-1.4.3.apk` (also mirrored at
  `public/ZyniVerse-1.4.3.apk`)
- **Size:** 42,134,969 bytes
- **SHA-256:** `4d092e816df37240a2fbbb50699196dd5848aeb25419bcddd507c017998a7fb8`
- **Package / version:** `app.zyverse.mobile`, `1.4.3 / 140300`
  (`output-metadata.json`)
- **Signer:** `a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e`
  â€” identical to the published 1.4.2, 1.4.1 and 1.4.0 builds, so existing
  installs keep their data (`apksigner verify --verbose --print-certs`).
- **Version bump:** `mobile/app.json`, `mobile/android/app/build.gradle`, and
  `mobile/android/app/src/main/res/values/strings.xml` updated to `1.4.3 /
  140300`.
- **Build command:**

  ```powershell
  $env:JAVA_HOME = 'C:\Users\ParthGupta\jdk17'
  $hermesc = (powershell -NoProfile -ExecutionPolicy Bypass -File '..\scripts\copy-hermesc.ps1').Trim()
  .\gradlew.bat assembleRelease --no-daemon "-PzyniHermescPath=$hermesc"
  ```

  Result: `BUILD SUCCESSFUL in 3m 19s`; `1177 actionable tasks: 71 executed,
  1106 up-to-date`.
- **Copies:** `dist/` and `public/` APK hashes both match the value above.
- **On-device 1.4.3 tap-through:** not done. Local verification covers APK
  hash/size/signature, typecheck and the release metadata/build checks below.

## Checks for the 1.4.3 batch

- Mobile `npx tsc --noEmit -p tsconfig.json` — clean.
- Root `npx tsc --noEmit --incremental false` — clean.
- `npx eslint --no-cache .` — clean.
- `npx vitest run` — 55 files, 629 passed / 1 failed
  (`src/__tests__/conventions.test.ts > getConventions > filters by status`,
  expected > 0 got 0; appears unrelated/time-dependent).
- `npm run build:sw && npx next build` — succeeded on Next.js `16.4.6`.
  `prisma generate` hit a transient `EPERM` rename on
  `query_engine-windows.dll.node` on two `npm run build` attempts (engine
  already present/locked), so SW + Next build were run after generation.
- Local `next start -p 3100` checks passed:
  `/api/mobile/version?platform=android&versionCode=140100`,
  `/changelog`, `/download` served v1.4.3 with the correct hash/size/notes.
- v1.4.3 signed APK built, copied to `dist/` and `public/`, and verified by
  SHA-256, size and `apksigner` signer digest (v2, same certificate as
  1.4.2/1.4.1/1.4.0).
- APK string scan was noisy/binary with no obvious third-party tap-navigation
  domains observed; not a definitive proof.

## Production release state

- `src/lib/mobile-release.ts` is the source of truth: it advertises
  `1.4.3 / 140300`, the hash and size above, and release notes for the link
  cleanup, Aurora Launch theme, Episode Pulse and stale Install fix. The 1.4.2,
  1.4.1 and 1.4.0 hash/size entries remain untouched for rollback.
- `/api/mobile/version?platform=android&versionCode=<older>` is backed by the
  v1.4.3 release metadata in this checkout; deploy is required before existing
  users see it.
- `/changelog` includes the v1.4.3 release entry in this checkout.
- `/changelog` and `/tools/anime-dice` are in the sitemap. `/doujinshi` and
  `/mature` are disallowed in `robots.txt` and emit `noindex, nofollow,
  nocache`.
- Report files in `Downloads/` updated for v1.4.3 while preserving the 30-page
  layout (`ZyniVerse-Project-Report.docx` and `.pdf`, Word/PDF 30 pages).
  Pre-v1.4.3 backups: `Downloads\ZyniVerse-Project-Report.pre-v143-backup.docx`
  and `.pdf` (originals also remain in
  `C:\Users\ParthGupta\AppData\Local\Temp\opencode\report-backup`).

## Historical 1.4.1 notes (superseded)

- Stories and Broadcast Channels shipped with the production migration
  `20261119120000_add_social_v150`, an official `ZyniVerse` channel and a
  branded welcome story seeded from `system-bot`.
- Tournament voting worked in live bracket matchups with one vote per
  matchup, optimistic counts and server reconciliation.
- Every entry in All Features resolved to a real native screen or real website
  page; the invented `/manga/1/chapters` link pointed at the real catalog.
- Public UI stayed in plain English; dub-catalog redirects no longer ran slow
  host probes.
- Live TV timings refreshed automatically and showed `TBA` / `Unscheduled`
  instead of invented times.
- API checks returned HTTP 200 for `/api/stories`, `/api/channels` and
  `/api/character-tournaments`; a throwaway-device vote returned
  `{"success":true,"votesA":1,"votesB":0}`.
- The 1.4.1 APK was installed on `192.168.1.46:42091` with `adb install -r`
  and launched without FATAL / ReactNativeJS errors. Full tap-through was
  blocked by the test device PIN.

## Historical 1.4.0 notes (superseded)

- Stable rollback release with safe downgrade handling (explicit `rollback`
  flag; the client never silently accepts an older build).
- Unified Dub Hub (`All / Series / Movies / Schedule / Languages / Genres`, no
  Sources entry), animated tab pill, skeletons, branded fallbacks, fixed filler
  guide keys.
- Stale-first service worker (`public/sw.js` v7), server-rendered ISR `/dubbed`,
  deferred/throttled heavy motion, deduplicated ad-probe.
- Production data at that time: 1,219 titles, 10 languages, 60 genres, 28
  airings across 8 groups, 21 future releases and 5 unscheduled rows.
- Cron: single daily Vercel cron `30 20 * * *` on `/api/cron/dub-sync`. Upstream
  egress from Vercel was unreliable (ADH host not resolved, DDS `403`); the
  route correctly reported failure without faking success or clearing data.

## Remaining items

| Item | Status |
|---|---|
| Publish v1.4.3 | Local signed APK is ready in `dist/` and `public/`; upload to Uptodown and redeploy the website so `/api/mobile/version` serves v1.4.3 (manual). |
| Promotion posts | Blocked until the exact Uptodown URL is known; `[UPTODOWN_LINK]` must be replaced and posts finalized only after listing is live. |
| On-device v1.4.3 tap-through | Pending; prior 1.4.1 launch/no-crash was verified and 1.4.3 has local APK/signature/build verification. |
| GitHub push / release asset | Blocked: `remote: Your account is suspended.` / `403`. The APK is served from `zyverse.in`, so this does not block users. |
| Play Console upload | Manual store listing/signing step remains. |
| Dead DNS record | Delete `ws.zyverse.in` (`153.52.255.71`). |
| Upstream vs Vercel egress | Watch the next daily cron; the resolver self-heals when the source answers again. |
| Vitest failure follow-up | `src/__tests__/conventions.test.ts > getConventions > filters by status` failed (expected > 0 got 0); appears unrelated/time-dependent, worth a targeted check if needed. |
| `prisma generate` EPERM | Transient rename EPERM seen twice on `query_engine-windows.dll.node`; retry in a clean environment if full `npm run build` is needed again. |
