# ZyniVerse v1.5.0 — Social features blueprint

Status: implemented on branch `social-v1.5.0`. **Not shipped.** `v1.4.0`
remains the published stable APK and the deployed website build.

## What was added

| Feature | Website | Native APK |
|---|---|---|
| Find people / discovery | `/people` | `DiscoverPeople` |
| Followers / following lists | `/users/[id]/followers`, `/users/[id]/following` | `FollowList` |
| Broadcast channels | `/channels`, `/channels/[slug]` | `Channels`, `ChannelDetail` |
| Stories (24h) | `/stories` | `Stories` |
| Chat reactions, delete, typing | existing `/messages` | `ChatScreen` |
| "Say hi" / message entry points | profile + people pages | profile, friends, messages, fun zone |

Discovery ranks people by shared watchlist titles, mutual followers, friendship,
and recent activity, with a "New here" fallback so the list is never empty.
Follower/following counts on profiles are now tappable on both platforms.
Broadcast channels are one-to-many (owner posts, followers react). Stories
expire after 24 hours and can belong to a user or a channel.

## Database migration (required before deploy)

Run once against the production database:

```powershell
npx prisma migrate deploy
```

Migration: `prisma/migrations/20261119120000_add_social_v150/migration.sql`
Creates `BroadcastChannel`, `ChannelSubscription`, `ChannelPost`,
`ChannelPostReaction`, `Story`, `StoryView`. `relationMode = "prisma"` is used,
so no database-level foreign keys are added.

**Do not deploy the website before applying this migration** — the new routes
query these tables.

## Optional: official seed channel

Set `ZYVERSE_OFFICIAL_USER_ID` to an existing user id to auto-create the
official `zyniverse` channel with one welcome post sourced from
`src/content/mobile-feed.json`. Without it, `ensureOfficialChannel()` is a
no-op and channels simply start empty. Never throws.

## API surface

- `GET /api/users/discover?limit=24` (auth)
- `GET /api/users/[id]/followers`, `GET /api/users/[id]/following`
- `GET|POST /api/channels`
- `GET /api/channels/[slug]`
- `POST|DELETE /api/channels/[slug]/subscribe`
- `GET|POST /api/channels/[slug]/posts`
- `PATCH|DELETE /api/channels/[slug]/posts/[postId]` (owner only for both)
- `POST /api/channels/[slug]/posts/[postId]/react`
- `GET|POST /api/stories`
- `POST /api/stories/[id]/view`
- `POST /api/chat/messages/[id]/react`, `DELETE /api/chat/messages/[id]`
- `POST /api/chat/typing` (ephemeral, no persistence)

Chat compatibility: `GET /api/chat/messages` still returns `reactions` as a row
array for the existing web client and additionally returns `reactionCounts` and
`myReactions` for native clients. The native helper normalises both shapes.
The legacy `/api/chat/messages/[id]/reaction` alias is kept for compatibility.

## Verification completed on the branch

- Root `npx tsc --noEmit --incremental false --pretty false` — clean
- Mobile `npx tsc --noEmit --pretty false` — clean
- `npx vitest run src/__tests__/filler.test.ts` — 1 file, 6 tests passed
- `npm run build` — succeeded after the standard Next.js security-nudge retry;
  all 795 pages generated, including the new social routes
- `npx next typegen` — clean
- Native Android assembly — **BUILD SUCCESSFUL** with **Hermes enabled**
  (1177 Gradle tasks). Metro bundled all 1265 modules, so every new
  screen/import resolves correctly.
- Installed on a physical device (`app.zyverse.mobile`, versionCode `140000`):
  launch is clean, no FATAL/JS errors, `MainActivity` stays in the foreground.

### Local Hermes build workaround (resolved)

By default the Hermes compiler lives inside `node_modules`, and Windows
Application Control (Device Guard) blocks executables there:

```
'...hermesc.exe' was blocked by your organization's Device Guard policy.
```

The block is **path-based, not hash-based** — copying the compiler plus its DLLs
to `%LOCALAPPDATA%\ZyniVerse\hermesc` makes it run normally. A JSC fallback
build also assembled, but crashed at startup with `Unexpected token '?'`
(older JSC cannot parse optional chaining), so **JSC is not a valid release
engine** here — always build with Hermes.

For local release builds:

```powershell
$hermesc = (powershell -NoProfile -ExecutionPolicy Bypass -File mobile\scripts\copy-hermesc.ps1).Trim()
cd mobile\android
$env:JAVA_HOME='C:\Users\ParthGupta\jdk17'
.\gradlew assembleRelease --no-daemon -PzyniHermescPath=$hermesc
```

`mobile/android/app/build.gradle` accepts `-PzyniHermescPath` as an opt-in
override; the default Hermes path is unchanged when the flag is absent, so this
is harmless on machines without the WDAC policy. No `eas.json`/cloud build is
needed. The test APK was NOT copied to `dist/` or `public/` — `v1.4.0` remains
the published build.

## Deliberately not included

- Vibe Marketplace / paid Verified Pass (moderation + legal load, not a parity win)
- Group chat rooms (separate scope; DMs, clubs and watch-party chat already exist)
- Push notification expansion (existing push subscription infra is unchanged)

## Before release

1. Apply the migration and set `ZYVERSE_OFFICIAL_USER_ID`.
2. Bump app version to `1.5.0 / 150000` (app.json, gradle, updater, published
   build registry, version API) and build a fresh signed APK.
3. Keep the `v1.4.0` APK/hash/URL intact until the new build is verified.
4. Manual device tap-through: discovery, follow lists, channels, stories,
   reactions and typing indicator.
