# Supabase direct-read migration (1.5.5)

## Status right now

| Item | State |
| --- | --- |
| Prisma DB ↔ Supabase project identity | ✅ Same project (pooler + direct URL ke username me wahi project ref jo Supabase URL me hai) |
| SQL migration file | ✅ `supabase/migrations/20261124000000_public_read_views.sql` |
| Mobile REST helper | ✅ `mobile/src/services/supabasePublic.ts` |
| Wired direct-first reads | Tournament list, leaderboard |
| Views ready, wiring abhi nahi | Public posts, public profiles, dub/TV catalog, vibe aggregates |
| Supabase REST live check | ❌ `402 Payment Required` (Cloudflare) on `/rest/v1`, `/auth/v1/health`, `/storage/v1` — project paused/billing block |
| Migration applied to DB | ❌ Nahi (402 ke chalte verify/apply nahi ho paya) |
| Direct reads in shipping APK | ⛔ OFF (`EXPO_PUBLIC_DIRECT_PUBLIC_READS` set nahi) — leaderboard/tournament reads abhi website fallback karte hain |
| Updater + announcement feed | ✅ GitHub Releases + bundled JSON; inhe server ki zarurat nahi |

Important: abhi APK me koi bhi Supabase key embed nahi hai. Website ke paas jo anon/publishable key hai wo server-side realtime/storage ke liye hai. Is migration me **service-role key, DB password, AUTH_SECRET ya koi bhi server secret APK me nahi jayega**.

## Kya ban gaya

### 1. PII-free public views (`public_zv_*`)

| View | Kya deti hai | Kya nahi deti |
| --- | --- | --- |
| `public_zv_tournaments` | Tournament list + creator (id/username/avatar) + participant/match counts + status rank | Poll votes, `deviceId`, `userId` of voters |
| `public_zv_leaderboard` | userId, username, avatar, points, level, achievements | Email, koi bhi private profile field |
| `public_zv_posts` | Post id/author/title/content/media/rating/image/timestamps + comment count | Koi bhi viewer-specific like/save state |
| `public_zv_profiles` | Public profile + stats + last 12 activities | `isSelf`, `isFollowing`, `friendStatus`, `viewerId` (sirf server jaanta hai) |
| `public_zv_dub_catalog`, `public_zv_dub_schedule`, `public_zv_dub_sources` | Public scraped listings | `lastError` (internal host/path leak ho sakta tha) |
| `public_zv_vibe_activity`, `_titles`, `_rooms`, `_pulse` | Sirf aggregate counts (7 din, 1500 row cap) | Username/user id nahi — privacy-first by design |

### 2. RLS + privilege lockdown

- Sensitive base tables (`User`, `UserSession`, `ApiKey`, votes, follows, notifications, etc.) par `ENABLE ROW LEVEL SECURITY`.
- `anon` / `authenticated` se un tables ka `REVOKE ALL`.
- Sirf upar wali views par `GRANT SELECT`.
- Views `security_invoker = false` (definer rights) se chalengi taaki postgres owner RLS ke baad bhi padh sake.
- Prisma `postgres.<ref>` role se connect karta hai → RLS bypass → **website aur saare server routes bilkul waise hi chalenge**.
- Supabase realtime sirf `broadcast` events use karta hai (`postgres_changes` nahi), isliye table RLS se realtime tootne ka risk nahi.

### 3. Mobile helper

`mobile/src/services/supabasePublic.ts`:
- Sirf `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` padhta hai.
- Hard-coded view allowlist — arbitrary table read impossible.
- `EXPO_PUBLIC_DIRECT_PUBLIC_READS=1` ke bina bilkul band.
- 4s timeout + 3 failures ke baad 10 minute ka circuit breaker.
- `withDirectFallback()` — koi bhi error/validation fail → wahi purana zyverse call.

### 4. Abhi wired

- `api.tournaments.list()` — public view se direct, server wahi sorting (`statusRank`, createdAt desc) aur `characterCount` mapping.
- `api.leaderboard.get()` — `Prefer: count=exact` se `total`, shape wahi `{ entries, total }`.

Baaki features (feed, public profile, dub, vibe) ke views ban gaye hain par unhe wire nahi kiya kyunki unka server response complex/personalized hai aur 402 ki wajah se live verify possible nahi tha. Galat shape = toota hua UI; isliye fallback-safe approach apnaya gaya.

## Apply kaise karein (jab Supabase project active ho)

1. Supabase project ka billing/pause fix karein. Verify:
   ```
   GET https://<ref>.supabase.co/auth/v1/health  -> 200
   ```
2. SQL editor ya `supabase db push` se migration chalayein:
   ```
   supabase/migrations/20261124000000_public_read_views.sql
   ```
3. Sanity queries (anon key se, service role ke bina):
   ```
   select count(*) from public_zv_tournaments;
   select count(*) from public_zv_leaderboard;
   select count(*) from public_zv_vibe_pulse;
   select * from "User" limit 1;   -- denial / 0 rows hona chahiye
   ```
4. Website + app dono se tournament create/edit karke dekhein — dono ko same rows dikhne chahiye (DB ek hi hai).

## APK me enable kaise karein

`mobile/.env` (gitignored) me:
```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_...>
EXPO_PUBLIC_DIRECT_PUBLIC_READS=1
```
Phir signed APK rebuild karein. Anon/publishable key embed karna allowed hai; **service-role key yahan kabhi na daalein**.

Agar views missing hain ya project phir se 402 ho jaye to app automatically zyverse API par wapas aa jayega — koi crash nahi.

## Hamesha server par rehne wale (jaan-bujh kar migration nahi kiya)

- Auth, MFA, email, uploads, Stripe, cron, scrapers, webhooks, rate limiting
- Vote / like / comment / follow writes, bracket generation, `myVotes`, `X-Device-Id` guest state
- Notifications, economy, achievements grant, chat, watch-party signaling
- WebView bridge (updater aur announcement feed ab GitHub/bundled hain — inhe server par rakhne ki zarurat nahi)

Inke liye pehle identity bridge (Auth.js JWT → Supabase JWT) aur per-user RLS policies chahiye; tab tak direct access unsafe hai.
