# Updater + offline independence (1.5.5 final)

## Final signed APK

- Files: `dist/ZyniVerse-1.5.5.apk` and `public/ZyniVerse-1.5.5.apk`
- Size: **42,686,001 bytes**
- SHA-256: **`9bdff38505513d8173cced22e3cc83c7bc5f32ce163aed57cf7ceb596b446026`**
- Package/version: `app.zyniverse.mobile`, `1.5.5 / 150500`
- Signer SHA-256: **`a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e`** (unchanged; existing installs keep their data)
- Secret scan: no `sb_secret_`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `DATABASE_URL` or `POSTGRES_PASSWORD` inside the APK.

## GitHub-only updater

`mobile/src/services/updater.ts` no longer calls `https://zyverse.in/api/mobile/version`.

- Manifest URL used by the app: `https://github.com/devilgamerparth009-collab/ZyniVerse/releases/latest/download/version.json`
- APK URL in the manifest: `https://github.com/devilgamerparth009-collab/ZyniVerse/releases/download/v1.5.5/ZyniVerse-1.5.5.apk`
- Download-page button in `UpdateScreen.tsx` opens `release.downloadPage` (GitHub release page) or `GITHUB_RELEASES_URL`.
- `latest/download` keeps working across releases without rebuilding the APK.
- SHA-256 **and** size verification is unchanged. A bad/corrupt download is deleted and never installed.
- Offline: the last verified APK is cached and re-verified before the Install button appears.

The website `/api/mobile/version` route still exists for browser/download pages, but the native app does not consult it. A website outage, Vercel block or billing issue can no longer stop existing installs from receiving a new APK.

## Bundled feed

`mobile/src/screens/HomeScreen.tsx` imports `mobile/src/content/mobile-feed.json` directly. The app no longer calls `/api/mobile/feed`. Announcements and spotlight cards work offline and need no website. Website copy in `src/content/mobile-feed.json` is kept in sync for the browser/download page, but it is not on the app's runtime path.

What's New, the announcement card and all Discover wording are professional English. They describe user benefits only; no GitHub, AniList, sync, proxy, backend or website-outage details are shown to the user.

## Advertising

Ad units now cover Discover and Channels in addition to the existing screens. A failed unit collapses to zero height and an interstitial with no advert dismisses itself, so there is no `SPONSORED / Ad unavailable` placeholder. More placements can increase impressions; payout, rates and approval remain controlled by the ad network.

## Direct filler guide

`mobile/src/services/fillerDirect.ts` downloads the same public AniFiller release JSON the website uses:

`https://github.com/AniraTeam/AniFiller/releases/latest/download/anifiller.json`

It resolves AniList id → MAL id → normalised title/alias/slug on the phone and keeps the dataset on device (24 hours fresh, 7 days stale). `getFiller()` in `api.ts` still has its 5-minute result cache and Retry behavior. No `/api/filler/{id}` call remains in the APK; the website route stays for web/widget consumers. Coverage is unchanged (the curated 182 shows). The first successful download needs internet; after that the guide works from the cached copy.

## Native Discover + local-first writes

Website user-facing areas now open native `DiscoverScreen` routes from `AllFeaturesScreen`, `safeLinks.ts` and the feature hubs where a safe native path exists. Public catalogues read AniList directly; user-owned drafts, notes, lists, watchlist, stats and tool data use `localRepo.ts` AsyncStorage envelopes (`zv_local_v1`).

Every local record is owner-scoped (`user:` from the offline profile hint, otherwise `device:`), revisioned, dirty-flagged and queued in an outbox. Deletes are tombstones, and secret-shaped fields are stripped before storage. No sync transport is connected in this build: no sync control is exposed, and pending writes remain on-device. A future authenticated transport can be injected with `setLocalSyncTransport()` without embedding a service-role key, DB password or Auth secret in the APK.

## New release checklist

1. Build and sign the APK with the same key; verify package, version, signer, hash and size.
2. Update `PUBLISHED_BUILDS["<version>"]` and `TARGET_NOTES` in `src/lib/mobile-release.ts`.
3. Upload the signed APK plus a refreshed `version.json` to a new GitHub release tagged `vX.Y.Z` (`gh release upload ... --clobber`).
4. Re-download the `latest/download` manifest and APK; confirm hash/size/signer again.

## Still needs a live backend

Login/session, profile edits, watchlist/tracking, feed/posts/comments/reels/chat/notifications, uploads, votes, guest device state and the shared Arena tournament database cannot survive a full `zyverse.in` outage. See `docs/FEATURE_DATA_SOURCE_AUDIT.md` for the exact list and reasons.

Supabase direct reads are prepared but still OFF:

- `EXPO_PUBLIC_DIRECT_PUBLIC_READS=1` is **not** embedded in the APK.
- Supabase REST currently returns `402 Payment Required` for `/rest/v1/`, `/auth/v1/health` and `/storage/v1`; the project is paused/billing-gated.
- There is no `SUPABASE_JWT_SECRET`, so the Auth.js JWT cannot be exchanged for a Supabase JWT and `auth.uid()` RLS cannot be enabled yet.
- `supabase/migrations/20261124000000_public_read_views.sql` is ready but not activated.
- `supabase/migrations/20261124010000_user_scope_bridge.sql.pending` is intentionally unapplied.

No git commit/push, no Vercel Auth/Protection change and no Firewall change was made.
