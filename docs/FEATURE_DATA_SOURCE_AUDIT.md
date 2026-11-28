# ZyniVerse Android — full data-source audit (final 1.5.5)

Snapshot: after the local-first/native-Discover signed rebuild on **24 Nov 2026**.
Scope: every screen, service, helper, bundled JSON, native plugin and website API route called by the APK.

## Verified final artifact

| Item | Value |
|---|---|
| APK | `dist/ZyniVerse-1.5.5.apk` = `public/ZyniVerse-1.5.5.apk` |
| Size | **42,686,001 bytes** |
| SHA-256 | **`9bdff38505513d8173cced22e3cc83c7bc5f32ce163aed57cf7ceb596b446026`** |
| Package | `app.zyniverse.mobile` |
| Version | `1.5.5 / 150500` |
| Signer | `a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e` (unchanged) |
| Secret scan | No service-role key, DB URL/password, `AUTH_SECRET` or Supabase `sb_secret_` in the APK |

## Legend

| Label | Meaning |
|---|---|
| **DIRECT** | No `zyverse.in` hop: AniList, public dataset, CDN, bundled asset or device storage. |
| **ZY-API** | App calls `https://zyverse.in/api/...` for shared server data. |
| **AUTH/ZY** | User/session-specific website backend (Auth.js cookie/Bearer + Prisma). |
| **SERVER-ONLY** | Needs secrets, scrapers, transactions, rate limits, moderation or side effects. Cannot safely live in an APK. |
| **LOCAL/DEVICE** | Bundled or stored on the phone. No network. |
| **STATIC LINK** | `zyverse.in` text/URL shown to the user or used as a safe-origin allowlist; not a runtime data dependency. |

---

## 1. What was removed from the APK

These no longer contact `zyverse.in` at all:

| Feature | Now |
|---|---|
| In-app updater | GitHub Releases manifest + APK only (`updater.ts`). Website `/api/mobile/version` removed from the app path. |
| Announcement/feed card | Bundled `mobile/src/content/mobile-feed.json`; `/api/mobile/feed` removed. |
| Home rows, Browse, Search, suggestions, genres, schedule, characters, recommendations, batch, anime detail | Direct AniList GraphQL. Website proxy fallbacks removed. |
| Anime of the Day | Deterministic pick from direct AniList trending; website fallback removed. |
| Watch/streaming links | AniList `externalLinks`/`streamingEpisodes` + curated official platform searches; `/api/streaming/links` removed. |
| Dub badges on detail | Anitaly + GitHub MyDubList direct; `/api/anime-dub-status` fallback removed. |
| Artwork / avatars | `imageCandidates()` returns direct upstream URLs only. No `/api/avatar` proxy fallback. |
| TV Guide / Daily Dub chips | Bundled official channel PNGs first; hardcoded website proxy fallbacks removed. |
| Tournament character search | Direct AniList character search; website fallback removed. |
| Genres when offline | Bundled `OFFLINE_GENRES` list. |

### 1.1 Native local-first areas

Website user-facing areas that can run without shared secrets now open `DiscoverScreen`, a native Reels-style screen registered like any other stack route:

- Public catalogues read AniList directly: genres, tags, A–Z, characters, staff, studios, voice-cast directory, watch order, smart search, compare, manga/light novels/toons/doujinshi, calendar and random picker.
- User-owned areas use `localRepo.ts` device envelopes: content drafts, notes, lists, watchlist, stats/graph/recap, saved items, tier lists, convention/award/challenge/contest notes and local tools.
- Writes are owner-scoped (`user:` when an offline profile hint exists, otherwise `device:`), timestamped and queued in an outbox with tombstones. A sync transport can be injected later with `setLocalSyncTransport()`; none is connected in this build, so pending writes stay safely on-device.
- `AllFeaturesScreen` and `safeLinks.ts` map native-safe website paths to `Discover` instead of opening the website. Account/token/export, `/admin`, `/developer/webhooks` and download remain WebView/static/server-only.
- `DiscoverScreen` uses professional, user-facing English. It does not expose sync, backend or proxy terminology; account/checkout actions simply direct users to the website.

`npx tsc --noEmit -p mobile/tsconfig.json` passes. The final JS bundle was checked to ensure `/api/mobile/feed`, `/api/mobile/version`, `/anime-of-the-day`, `/anime-dub-status` and the old announcement copy are absent. What's New, the announcement card and Discover copy are professional English with no internal sync/backend details. No literal service-role key, DB URL/password, `AUTH_SECRET` or Supabase `sb_secret_` marker is present in the APK.

---

## 2. Remaining literal `zyverse.in` matches in `mobile/src`

There are **67 literal matches**, but only the `api.ts` base host is a runtime data origin. The rest are static links, comments, allowlists, Discover honesty copy or relative upload-path resolution.

| Group | Examples | Classification |
|---|---|---|
| Runtime API origin | `api.ts:78` `WEB_HOST`, `WEB_API = ${WEB_HOST}/api`; app identity headers | **ZY-API / AUTH/ZY** (see §3) |
| WebView + safe-link policy | `safeLinks.ts:11,61,157`, `WebScreen.tsx:22`, `navigation/types.ts:75` | **STATIC LINK / allowlist** |
| Relative uploaded-image paths | `avatar-src.ts:34`, `helpers.ts:194`, `ChannelDetailScreen.tsx:142`, `StoriesScreen.tsx:220` | **ZY-API asset fallback** (server-owned uploads) |
| User-facing product/legal/share links | `SettingsScreen.tsx` website/Terms/Privacy, `HubScreen.tsx` premium/clubs/blog/wiki, `ReelsScreen.tsx`, `TasteProfileScreen.tsx`, `FeedScreen.tsx`, `FunZoneScreen.tsx` | **STATIC LINK** |
| Native Discover user-facing copy | `discoverData.ts:5,82,89` | **STATIC COPY** — professional English, no internal details; no fetch |
| Unused/legacy static data | `freshDubDropsData.ts`, `tvGuideData.ts`, `channelLogos.ts:47-48` | **STATIC LINK / no fetch** |
| Ad allowlist | `AdBanner.tsx:59` | third-party ad host allowlist, not an app data call |
| Comments | `updater.ts:167`, `anilistDirect.ts:7,593`, `api.ts:1150`, `fillerDirect.ts:6`, `navigation/types.ts:85`, `helpers.ts:207` | documentation only |

No safe public AniList data call uses the website as a fallback anymore.

---

## 3. Exact remaining backend-dependent features

### 3.1 Auth / session — cannot be standalone
`POST /api/mobile/auth/login`, `POST /api/register`, `POST /api/auth/logout`, `/api/auth/providers`, `/api/auth/csrf`, `/api/auth/signin/{provider}`, `/api/auth/mobile-web-token`, `GET /api/mobile/me`.

Why: bcrypt/OTP/OAuth, session cookie issuance and revocation live on the server. The APK stores only an Auth.js cookie/JWT; there is no Supabase JWT bridge. Offline cached profile is display-only and a real `401` still signs the user out.

### 3.2 Profile, watchlist, tracking and user-owned data
`/api/mobile/profile-summary`, `/api/profile`, `/api/watchlist`, `/api/track/episode`, `/api/lists`, `/api/moments`, `/api/economy`, `/api/daily-login/claim`, `/api/achievements`, `/api/reviews`, `/api/manga/list|chapters|history`, `/api/account/delete`, `/api/users/*`, `/api/dna/*`.

Why: rows are private/user-owned and writes trigger achievements, points, notifications and moderation. RLS keyed to the current user is not available yet.

Native `Discover` now offers device-local equivalents for lists, watchlist notes, stats, recap, backlog, saved items and tier lists. Writes land in `zv_local_v1` owner envelopes with an outbox; no transport is connected, so they are shown as `SAVED` and never pretend to be shared.

### 3.3 Shared community DB
Feed, posts, comments, activity, channels, stories, reels, memes, clips, fanart, cosplay, clubs, forum, polls, challenges, contests, bingo, tierlists, merch, awards, blog, wiki, leaderboard, news, OST, wallpapers, vibe, quiz, games, episode pulse, watch party.

Why: shared cross-device state, analytics, rate limits, votes, uploads and moderation. Public-view migration is prepared but not enabled because Supabase is paused/billing-gated.

The native `Discover` versions of posts, clubs, blog, wiki, critiques, theories and guides are local drafts with a pending outbox. They do not fetch or mutate the shared DB; `AllFeaturesScreen` and `safeLinks.ts` no longer open the website for these safe native areas.

### 3.4 Dub Hub / TV data
`/api/dub/catalog`, `/api/dub/schedule`, `/api/dub/live-schedule`, `/api/dub/languages`, `/api/dub/genres`, `/api/dub/overview`, `/api/dub-schedule`, `/api/live-dubs`, `/api/tv-schedule`, `/api/tv-schedule/live`.

Why: the website cron/import jobs scrape Indian dub listing sites into Prisma/Postgres. The app has no safe way to scrape those sites from a phone (CORS, site ToS/HTML fragility, rate limits). Posters and channel logos are already direct/bundled; only the schedule/catalog rows still need the backend.

### 3.5 Filler guide — now independent
`mobile/src/services/fillerDirect.ts` downloads the public AniFiller release JSON directly from GitHub, with a 24-hour fresh / 7-day stale on-device cache and a 60-second timeout. `getFiller()` in `mobile/src/services/api.ts` resolves AniList id → MAL id → normalised title/alias/slug with the same logic as `src/lib/filler.ts`, then keeps its existing 5-minute result cache. No `/api/filler/{id}` call remains in the APK.

The website route stays for web/widget consumers. Coverage is unchanged (the curated 182 shows). The first successful download needs internet; after that the cached dataset works offline.

### 3.6 Arena tournaments
`/api/character-tournaments` list/detail/create/vote/poll-vote/start/finalize/finalize-qualifying.

Why intentionally kept shared: website and app must see the same tournaments and votes. Guest votes use `X-Device-Id`, bracket generation is multi-row, and votes need rate limiting/dedupe/transactions. Character search and bracket portraits are already direct AniList.

### 3.7 Chat, notifications, social graph
`/api/chat/*`, `/api/notifications*`, `/api/follow`, `/api/friends*`, `/api/users/discover|search`, realtime `dm:*`, `party:*`, `presence:online`.

Why: realtime publish, unread counters and user-scoped writes require server state.

### 3.8 Uploads / storage
`/api/upload` plus relative paths such as `/uploads/...`.

Why: local-disk/Supabase-Storage writes need server-side authorization and, for some buckets, a service-role key. Public Storage object URLs already load directly. Putting a service-role key or DB password in the APK is forbidden and was never done.

### 3.9 WebView fallback
`WebScreen.tsx` is locked to `zyverse.in` and uses a short-lived `/api/auth/mobile-web-token` bridge for signed-in pages. Unknown links are never opened. Some native-only routes still intentionally open their website counterpart.

---

## 4. Supabase migration status

Prepared, not activated:

- `supabase/migrations/20261124000000_public_read_views.sql` — PII-free public views/RLS for tournaments, leaderboard, posts and similar rows.
- `supabase/migrations/20261124010000_user_scope_bridge.sql.pending` — identity bridge prep, intentionally unapplied.
- `mobile/src/services/supabasePublic.ts` — anon-only allowlisted REST reader; `EXPO_PUBLIC_DIRECT_PUBLIC_READS=1` is **not** embedded, so direct reads are OFF.

Blockers:

1. Supabase REST returns `402 Payment Required` for `/rest/v1/`, `/auth/v1/health` and `/storage/v1` (paused/billing-gated project).
2. No `SUPABASE_JWT_SECRET`; the Auth.js JWT cannot be exchanged for a Supabase JWT, so `auth.uid()` RLS is unavailable.
3. Vercel production redeploy was blocked by `Your Team exceeded our fair use limits and has been blocked.`

---

## 5. Verdict

**Safe `zyverse.in` dependencies: removed.** This includes the updater, feed announcements, all public AniList reads, artwork proxying, dub badges, anime-of-the-day, watch links, filler guide and tournament character search. Safe public catalogue and user-authored areas are now native `Discover` screens; user writes are local-first with an outbox.

**Still `zyverse.in`-dependent:** login/session, real shared profile/watchlist writes, shared community content, scraped dub/TV catalogs, Arena votes/state, chat/notifications, uploads, checkout/account actions and WebView fallback. These are not safe to make device-local: they need a shared database and server-side authorization/secrets, or a canonical public API that does not currently exist. The app shows local drafts/overviews for these areas and says when the real action stays server-side. Direct Supabase can be enabled only after the project is active, the anon/RLS views are applied, and an Auth.js→Supabase identity bridge exists.

No git commit/push, no Vercel Auth/Protection change and no Firewall change was made for this audit.
