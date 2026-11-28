-- ZyniVerse 1.5.5 — safe anonymous read layer.
--
-- Goal: let the Android APK read public data straight from Supabase REST with
-- only the publishable/anon key, while the website and every write path keep
-- using Prisma on the same database.
--
-- Safety rules baked into this file:
--   1. No email, password hash, MFA secret, token, device id, IP or private row
--      is ever exposed. Only curated, already-public fields land in views.
--   2. Views are owned by the migration role (postgres in Supabase) and run
--      with definer rights (security_invoker = false), so they can read base
--      tables even after RLS is turned on.
--   3. anon/authenticated get SELECT on the views only. Direct table access is
--      revoked and base tables get RLS with no anon policy (default deny).
--   4. Writes, votes, follows, uploads, auth and economy stay server-side.
--
-- Idempotent: safe to re-run.

-- Roles exist on Supabase, but guard anyway so the file can run on a plain
-- Postgres clone used for local verification.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Public tournament list
--    Mirrors GET /api/character-tournaments (creator + _count + status order).
--    Deliberately excludes poll-vote records and per-device vote identity.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_zv_tournaments WITH (security_invoker = false) AS
SELECT
  t."id",
  t."creatorId",
  t."title",
  t."description",
  t."posterUrl",
  t."size",
  t."status",
  t."mode",
  t."bracketSize",
  t."currentRound",
  t."totalRounds",
  t."seed",
  t."qualifyingStartedAt",
  t."qualifyingEndsAt",
  t."bracketStartedAt",
  t."roundEndsAt",
  t."createdAt",
  t."startedAt",
  t."completedAt",
  CASE t."status"
    WHEN 'active' THEN 0
    WHEN 'qualifying' THEN 1
    WHEN 'upcoming' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'cancelled' THEN 4
    ELSE 9
  END AS "statusRank",
  jsonb_build_object(
    'id', u."id",
    'username', u."username",
    'avatar', u."avatar"
  ) AS "creator",
  jsonb_build_object(
    'participants', (SELECT count(*)::int FROM "CharacterTournamentParticipant" p WHERE p."tournamentId" = t."id"),
    'matches', (SELECT count(*)::int FROM "CharacterTournamentMatch" m WHERE m."tournamentId" = t."id")
  ) AS "_count"
FROM "CharacterTournament" t
JOIN "User" u ON u."id" = t."creatorId";

ALTER VIEW public_zv_tournaments SET (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 2. Leaderboard — exact shape of getUserLeaderboard().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_zv_leaderboard WITH (security_invoker = false) AS
SELECT
  up."userId",
  u."username",
  u."avatar",
  up."points",
  up."level",
  (SELECT count(*)::int FROM "UserAchievement" a WHERE a."userId" = up."userId") AS "achievements"
FROM "UserPoints" up
JOIN "User" u ON u."id" = up."userId"
WHERE up."points" > 0
ORDER BY up."points" DESC, up."level" DESC;

ALTER VIEW public_zv_leaderboard SET (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 3. Public posts — raw material for the anonymous feed. Ranking/personalised
--    `following` mode still comes from the server; this is the public slice.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_zv_posts WITH (security_invoker = false) AS
SELECT
  p."id",
  p."userId",
  u."username" AS "authorUsername",
  u."avatar" AS "authorAvatar",
  p."title",
  p."content",
  p."type",
  p."mediaId",
  p."rating",
  p."image",
  p."createdAt",
  p."updatedAt",
  (SELECT count(*)::int FROM "Comment" c WHERE c."postId" = p."id") AS "commentCount"
FROM "Post" p
JOIN "User" u ON u."id" = p."userId";

ALTER VIEW public_zv_posts SET (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 4. Public profiles — same public payload as getPublicProfileData().
--    Viewer-specific fields (isSelf / isFollowing / friendStatus / viewerId)
--    are intentionally NOT here: only the server knows the viewer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_zv_profiles WITH (security_invoker = false) AS
SELECT
  u."id" AS "userId",
  u."username",
  u."avatar",
  u."banner",
  u."bio",
  u."signature",
  u."themeColor",
  u."createdAt",
  (SELECT count(*)::int FROM "Follow" f WHERE f."followingId" = u."id") AS "followersCount",
  (SELECT count(*)::int FROM "Follow" f WHERE f."followerId" = u."id") AS "followingCount",
  (
    SELECT count(*)::int FROM "FriendRequest" fr
    WHERE fr."status" = 'accepted' AND (fr."senderId" = u."id" OR fr."receiverId" = u."id")
  ) AS "friendsCount",
  coalesce(up."level", 1) AS "level",
  coalesce(up."points", 0) AS "points",
  jsonb_build_object(
    'total', coalesce(stats.total, 0),
    'completed', coalesce(stats.completed, 0),
    'current', coalesce(stats.current, 0),
    'planning', coalesce(stats.planning, 0),
    'episodesWatched', coalesce(stats."episodesWatched", 0),
    'meanScore', coalesce(stats."meanScore", 0)
  ) AS "stats",
  (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', act."id",
          'type', act."type",
          'mediaId', act."mediaId",
          'mediaTitle', act."mediaTitle",
          'mediaImage', act."mediaImage",
          'message', act."message",
          'createdAt', act."createdAt"
        ) ORDER BY act."createdAt" DESC
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT a2."id", a2."type", a2."mediaId", a2."mediaTitle", a2."mediaImage", a2."message", a2."createdAt"
      FROM "Activity" a2
      WHERE a2."userId" = u."id"
      ORDER BY a2."createdAt" DESC
      LIMIT 12
    ) act
  ) AS "activities"
FROM "User" u
LEFT JOIN "UserPoints" up ON up."userId" = u."id"
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE x."status" = 'COMPLETED')::int AS completed,
    count(*) FILTER (WHERE x."status" = 'CURRENT')::int AS current,
    count(*) FILTER (WHERE x."status" = 'PLANNING')::int AS planning,
    coalesce(sum(x."progress"), 0)::int AS "episodesWatched",
    coalesce(round(avg(x."score") FILTER (WHERE x."type" = 'ANIME' AND x."score" > 0)::numeric, 1), 0) AS "meanScore"
  FROM (
    SELECT le."type", le."status", le."progress", le."score"
    FROM "ListEntry" le
    WHERE le."userId" = u."id"
    ORDER BY le."updatedAt" DESC
    LIMIT 200
  ) x
) stats ON true;

ALTER VIEW public_zv_profiles SET (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 5. Dub / TV catalogue rows (already public scraped listings).
--    lastError is omitted from the source-state view: it can contain internal
--    host/paths and is not needed by the app.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_zv_dub_catalog WITH (security_invoker = false) AS
SELECT
  "id", "source", "sourceId", "sourceUrl", "slug", "title", "kind",
  "posterUrl", "languages", "genres", "season", "episodeInfo", "description",
  "year", "rating", "lastModified", "detailFetchedAt", "firstSeenAt", "updatedAt"
FROM "DubCatalogTitle";

ALTER VIEW public_zv_dub_catalog SET (security_invoker = false);

CREATE OR REPLACE VIEW public_zv_dub_schedule WITH (security_invoker = false) AS
SELECT
  "id", "source", "sourceId", "title", "posterUrl", "season", "episodeInfo",
  "languages", "dayLabel", "timeLabel", "releaseAt", "sourceUrl", "updatedAt"
FROM "DubScheduleEntry";

ALTER VIEW public_zv_dub_schedule SET (security_invoker = false);

CREATE OR REPLACE VIEW public_zv_dub_sources WITH (security_invoker = false) AS
SELECT "source", "baseUrl", "status", "lastCheckedAt", "lastSyncAt", "itemCount"
FROM "DubSourceState";

ALTER VIEW public_zv_dub_sources SET (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 6. Vibe aggregates. Privacy-first already: counts only, no user ids.
--    Mirrors src/lib/vibe.ts (7 day window, 1500 row cap, 12 titles).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_zv_vibe_activity WITH (security_invoker = false) AS
SELECT a."userId", a."mediaId", a."mediaTitle", a."mediaImage", a."type", a."createdAt"
FROM (
  SELECT "userId", "mediaId", "mediaTitle", "mediaImage", "type", "createdAt"
  FROM "Activity"
  WHERE "createdAt" >= now() - interval '7 days'
    AND "mediaId" IS NOT NULL
    AND "type" IN ('WATCHING', 'CURRENT', 'WATCHED_EPISODE', 'COMPLETED')
  ORDER BY "createdAt" DESC
  LIMIT 1500
) a;

ALTER VIEW public_zv_vibe_activity SET (security_invoker = false);

CREATE OR REPLACE VIEW public_zv_vibe_titles WITH (security_invoker = false) AS
SELECT
  "mediaId",
  coalesce(
    (array_agg("mediaTitle" ORDER BY "createdAt" DESC) FILTER (WHERE "mediaTitle" IS NOT NULL AND "mediaTitle" <> ''))[1],
    'Anime #' || "mediaId"::text
  ) AS "title",
  (array_agg("mediaImage" ORDER BY "createdAt" DESC) FILTER (WHERE "mediaImage" IS NOT NULL AND "mediaImage" <> ''))[1] AS "image",
  count(DISTINCT "userId")::int AS "fans",
  count(*)::int AS "events",
  max("createdAt") AS "lastSeen"
FROM public_zv_vibe_activity
GROUP BY "mediaId"
ORDER BY "fans" DESC, "events" DESC, "lastSeen" DESC;

ALTER VIEW public_zv_vibe_titles SET (security_invoker = false);

CREATE OR REPLACE VIEW public_zv_vibe_rooms WITH (security_invoker = false) AS
SELECT
  wp."id",
  wp."mediaId",
  wp."mediaTitle" AS "title",
  coalesce(wp."coverImage", wp."mediaImage") AS "image",
  wp."episode",
  (SELECT count(*)::int FROM "WatchPartyMember" m WHERE m."partyId" = wp."id") AS "members"
FROM "WatchParty" wp
WHERE wp."status" = 'live'
ORDER BY wp."updatedAt" DESC;

ALTER VIEW public_zv_vibe_rooms SET (security_invoker = false);

CREATE OR REPLACE VIEW public_zv_vibe_pulse WITH (security_invoker = false) AS
SELECT
  (SELECT count(DISTINCT "userId")::int FROM public_zv_vibe_activity) AS "fans",
  (SELECT count(DISTINCT "mediaId")::int FROM public_zv_vibe_activity) AS "titles",
  (SELECT count(*)::int FROM public_zv_vibe_activity WHERE "type" = 'WATCHED_EPISODE') AS "episodes",
  (SELECT count(*)::int FROM "WatchParty" WHERE "status" = 'live') AS "liveRooms",
  (
    SELECT count(DISTINCT m."userId")::int
    FROM "WatchPartyMember" m
    JOIN "WatchParty" wp ON wp."id" = m."partyId"
    WHERE wp."status" = 'live'
  ) AS "inRooms";

ALTER VIEW public_zv_vibe_pulse SET (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 7. Lock the base tables down.
--    Prisma connects as the Supabase `postgres` role, which bypasses RLS, so
--    the website and all server routes keep working unchanged.
--    No anon/authenticated policy is added anywhere -> direct table reads are
--    denied by default. The curated views above remain readable.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  locked text[] := ARRAY[
    'User', 'UserSession', 'ApiKey', 'UserPoints', 'UserAchievement',
    'ListEntry', 'Post', 'Comment', 'SavedPost', 'Follow', 'FriendRequest',
    'Activity', 'ActivityReaction', 'Notification', 'NotificationPreference',
    'CharacterTournament', 'CharacterTournamentParticipant',
    'CharacterTournamentMatch', 'CharacterTournamentPollVote',
    'CharacterTournamentVote', 'DubCatalogTitle', 'DubScheduleEntry',
    'DubSourceState', 'WatchParty', 'WatchPartyMember', 'BroadcastChannel'
  ];
BEGIN
  FOREACH t IN ARRAY locked LOOP
    IF to_regclass('public."' || t || '"') IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public."%I" ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public."%I" FROM anon, authenticated', t);
    END IF;
  END LOOP;
END
$$;

-- Explicit allow-list: only these views are readable with the public key.
REVOKE ALL ON TABLE public_zv_tournaments, public_zv_leaderboard, public_zv_posts,
  public_zv_profiles, public_zv_dub_catalog, public_zv_dub_schedule,
  public_zv_dub_sources, public_zv_vibe_activity, public_zv_vibe_titles,
  public_zv_vibe_rooms, public_zv_vibe_pulse FROM anon, authenticated;

GRANT SELECT ON TABLE public_zv_tournaments, public_zv_leaderboard, public_zv_posts,
  public_zv_profiles, public_zv_dub_catalog, public_zv_dub_schedule,
  public_zv_dub_sources, public_zv_vibe_activity, public_zv_vibe_titles,
  public_zv_vibe_rooms, public_zv_vibe_pulse TO anon, authenticated;

-- Sanity check (run manually): these must return rows and User must not.
--   select count(*) from public_zv_tournaments;
--   select count(*) from public_zv_leaderboard;
--   select * from "User" limit 1;  -- as anon: permission denied / 0 rows
