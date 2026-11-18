export type ListStatus =
  | 'CURRENT'
  | 'COMPLETED'
  | 'PLANNING'
  | 'DROPPED'
  | 'PAUSED'
  | 'REWATCHING';

export interface AnimeTitle {
  english?: string | null;
  romaji?: string | null;
  native?: string | null;
  userPreferred?: string | null;
}

export interface AnimeCover {
  large?: string | null;
  medium?: string | null;
  extraLarge?: string | null;
  color?: string | null;
}

export interface AnimeStudio {
  id?: number;
  name: string;
  isAnimationStudio?: boolean;
}

export interface AnimeDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export interface AnimeTrailer {
  id?: string | null;
  site?: string | null;
  thumbnail?: string | null;
}

export interface AnimeTag {
  id: number;
  name: string;
  rank?: number | null;
  isMediaSpoiler?: boolean;
}

export interface Anime {
  id: number;
  idMal?: number | null;
  malId?: number | null;
  title: AnimeTitle;
  coverImage?: AnimeCover | null;
  bannerImage?: string | null;
  episodes?: number | null;
  duration?: number | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  genres?: string[];
  tags?: AnimeTag[];
  studios?: { nodes?: AnimeStudio[] } | AnimeStudio[];
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  trending?: number | null;
  description?: string | null;
  startDate?: AnimeDate | null;
  endDate?: AnimeDate | null;
  siteUrl?: string | null;
  trailer?: AnimeTrailer | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  streamingEpisodes?: { title: string; url: string }[];
  type?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  isAdult?: boolean;
}

export interface MediaPage {
  pageInfo: { hasNextPage: boolean; total: number };
  media: Anime[];
}

export interface SearchSuggestion {
  id: number;
  title: string;
  titleRomaji?: string | null;
  poster?: string | null;
  format?: string | null;
  status?: string | null;
  year?: number | null;
  episodes?: number | null;
}

export interface CharacterEdge {
  role?: string | null;
  name?: string | null;
  node: {
    id: number;
    name: { full?: string | null; native?: string | null };
    image?: { large?: string | null; medium?: string | null } | null;
    favourites?: number | null;
  };
  voiceActors?: {
    id: number;
    name: { full?: string | null };
    image?: { medium?: string | null } | null;
    languageV2?: string | null;
  }[];
}

export interface CharactersResponse {
  id: number;
  title?: AnimeTitle;
  coverImage?: AnimeCover;
  pageInfo: { hasNextPage: boolean; total: number };
  edges: CharacterEdge[];
}

export interface FillerData {
  animeId: number;
  title: string;
  totalEpisodes: number;
  totalFillers: number;
  fillerPercentage: number;
  episodes: { episode: number; type: 'canon' | 'filler' | 'mixed'; title?: string }[];
}

export interface ScheduleItem {
  mediaId: number;
  title: string;
  episode: number;
  airingAt: string;
  timeUntilAiring: number;
  media: Anime;
}

export interface DubStatus {
  malId: number;
  title: string;
  english?: { available: boolean };
  hindi?: { available: boolean; platform?: string };
  tamil?: { available: boolean; platform?: string };
  telugu?: { available: boolean; platform?: string };
}

export type DubScheduleLanguage = 'english' | 'hindi' | 'tamil' | 'telugu' | 'all';

export interface DubEntry {
  mal_id: number;
  title: string;
  displayTitle: string;
  image: string;
  synopsis: string;
  genres: string[];
  hasHindi: boolean;
  hasTamil: boolean;
  hasTelugu: boolean;
  hasEnglish: boolean;
  comingSoonLanguages: string[];
  isCurrentSeason: boolean;
  score: string;
}

export interface DubScheduleCounts {
  total: number;
  hindi: number;
  tamil: number;
  telugu: number;
  english: number;
  currentSeason: number;
  available: number;
  comingSoon: number;
  recent: number;
}

export interface DubScheduleResponse {
  success: boolean;
  source?: string;
  counts: DubScheduleCounts;
  data: {
    currentSeason: DubEntry[];
    available: DubEntry[];
    comingSoon: DubEntry[];
    recent: DubEntry[];
  };
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  stats?: {
    animeCompleted: number;
    episodesWatched: number;
    daysWatched: number;
  };
}

export interface WatchlistItem {
  mediaId: number;
  type: string;
  status: ListStatus;
  progress: number;
  total: number;
  score: number | null;
  scoreStory?: number | null;
  scoreArt?: number | null;
  scoreSound?: number | null;
  scoreCharacters?: number | null;
  scoreEnjoyment?: number | null;
  dropReason?: string | null;
}

export interface ReviewItem {
  id: string;
  mediaId: number;
  userId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user?: { username: string } | null;
}

export interface ProfileEntry {
  mediaId: number;
  type: string;
  status: ListStatus;
  progress: number;
  total: number;
  score: number | null;
  updatedAt: string;
}

export interface ProfileAchievement {
  code: string;
  name: string;
  icon: string;
  category: string;
  points: number;
  earnedAt: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  mediaId?: number | null;
  mediaTitle?: string | null;
  mediaImage?: string | null;
  message?: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Watch party                                                         */
/* ------------------------------------------------------------------ */

export interface WatchPartyUser {
  id: string;
  username: string;
  avatar?: string | null;
}

export interface WatchPartyMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: WatchPartyUser;
}

export interface WatchParty {
  id: string;
  hostId: string;
  mediaId: number;
  mediaTitle: string;
  mediaImage?: string | null;
  coverImage?: string | null;
  episode: number;
  status: 'waiting' | 'live' | 'ended';
  startTime?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  isPlaying: boolean;
  playbackPos: number;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
  host: WatchPartyUser;
  members: WatchPartyMember[];
}

export interface WatchPartySyncState {
  isPlaying: boolean;
  playbackPos: number;
  episode: number;
  status: 'waiting' | 'live' | 'ended';
  lastSyncAt?: string | null;
}

export interface WatchPartySearchResult {
  id: number;
  title: string;
  image?: string | null;
  episodes?: number | null;
  status?: string | null;
  year?: number | null;
}

export interface WatchPartyMessage {
  id: string;
  userId?: string | null;
  username: string;
  avatar?: string | null;
  message: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Manga tracker                                                       */
/* ------------------------------------------------------------------ */

export interface MangaEntry {
  id: string;
  userId?: string;
  mediaId: number;
  title: string;
  coverImage?: string | null;
  status: string;
  chapters: number;
  volumes: number;
  totalChapters?: number | null;
  totalVolumes?: number | null;
  score?: number | null;
  subType?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MangaChapter {
  id: string;
  entryId: string;
  chapter: number;
  title?: string | null;
  read: boolean;
  readAt?: string | null;
  mangaDexId?: string | null;
}

export interface MangaListResponse {
  entries: MangaEntry[];
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
  counts: Record<string, number>;
  overallTotal: number;
}

/* ------------------------------------------------------------------ */
/* Vibe (community pulse)                                              */
/* ------------------------------------------------------------------ */

export interface VibeTitle {
  mediaId: number;
  title: string;
  image?: string | null;
  fans: number;
  events: number;
  lastSeen?: string;
}

export interface VibeLiveRoom {
  id: string;
  mediaId: number;
  title: string;
  image?: string | null;
  episode: number;
  members: number;
}

export interface VibeResponse {
  generatedAt: string;
  windowDays: number;
  pulse: {
    fans: number;
    titles: number;
    episodes: number;
    liveRooms: number;
    inRooms: number;
  };
  nowWatching: VibeTitle[];
  liveRooms: VibeLiveRoom[];
}

/* ------------------------------------------------------------------ */
/* Anime DNA (taste profile)                                           */
/* ------------------------------------------------------------------ */

export interface DnaGenre {
  genre: string;
  count: number;
  pct: number;
}

export interface DnaArchetype {
  key: string;
  label: string;
  emoji: string;
  punchline: string;
  blurb: string;
}

export interface DnaWatchStyle {
  label: string;
  emoji: string;
  note: string;
}

export interface DnaProfile {
  displayName: string;
  username: string;
  avatar?: string | null;
  archetype: DnaArchetype;
  watchStyle: DnaWatchStyle;
  topGenres: DnaGenre[];
  formats: string[];
  fingerprint: string;
  genes: string[];
  totalAnime: number;
  completedCount: number;
  droppedCount: number;
  planningCount: number;
  meanScore: number;
  totalDaysWatched: number;
  streak: number;
  favoriteStudio?: string | null;
  peakYear?: number | null;
  shareCode: string;
}

export interface ProfileStats {
  total: number;
  current: number;
  planning: number;
  completed: number;
  dropped: number;
  paused: number;
  episodesWatched: number;
  meanScore: number;
}

export interface ProfileUser {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  banner?: string | null;
  themeColor?: string | null;
  signature?: string | null;
  bio?: string | null;
  createdAt: string;
  entries: ProfileEntry[];
  reviews: ReviewItem[];
  followersCount: number;
  followingCount: number;
  level: number;
  points: number;
  achievements: ProfileAchievement[];
  recentActivity: ActivityItem[];
}

export interface ProfileResponse {
  user: ProfileUser;
  stats: ProfileStats;
  topAnime: { mediaId: number; score: number | null; title: string | null; cover: string | null }[];
}

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  threadCount: number;
}

export interface ForumUser {
  id: string;
  username: string;
  avatar?: string | null;
  signature?: string | null;
}

export interface ForumThread {
  id: string;
  title: string;
  content?: string | null;
  slug?: string;
  categoryId?: string | null;
  animeId?: number | null;
  animeTitle?: string | null;
  animeImage?: string | null;
  createdAt: string;
  updatedAt?: string;
  viewCount?: number;
  postCount?: number;
  isPinned?: boolean;
  isLocked?: boolean;
  category?: { id: string; name: string; slug: string } | null;
  user: ForumUser;
  author?: ForumUser;
  upvotes?: number;
  _count?: { posts: number };
}

export interface ForumPost {
  id: string;
  threadId: string;
  content: string;
  createdAt: string;
  user: ForumUser;
  _count?: { votes: number };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  aiEnabled: boolean;
  followEnabled: boolean;
  commentEnabled: boolean;
  reviewEnabled: boolean;
  eventEnabled: boolean;
  systemEnabled: boolean;
  airingEnabled: boolean;
}

export interface CharacterTournament {
  id: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  size: number;
  bracketSize?: number | null;
  characterCount?: number | null;
  totalSlots?: number | null;
  mode: 'qualifying' | 'bracket';
  status: 'qualifying' | 'active' | 'upcoming' | 'completed' | 'cancelled';
  currentRound: number;
  totalRounds: number;
  qualifyingEndsAt?: string | null;
  roundEndsAt?: string | null;
  createdAt: string;
  creator?: { id: string; username: string; avatar?: string | null } | null;
  _count?: { participants: number; matches: number };
}

export interface TournamentParticipant {
  id: string;
  charId: number;
  charName: string;
  charImage?: string | null;
  franchiseCover?: string | null;
  pollVotes?: number;
  seed?: number | null;
}

export interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  votesA: number;
  votesB: number;
  winnerId?: string | null;
  charA?: TournamentParticipant | null;
  charB?: TournamentParticipant | null;
  winner?: TournamentParticipant | null;
  _count?: { votes: number };
}

export interface CharacterTournamentDetail {
  tournament: CharacterTournament & { participants: TournamentParticipant[] };
  rounds: { label: string; matches: TournamentMatch[] }[];
  matches: TournamentMatch[];
  totalVotes: number;
  myVotes: Record<string, 'A' | 'B'>;
  myPollVote: string | null;
  isCreator?: boolean;
}

/* ------------------------------------------------------------------ */
/* Fun Zone — public website features surfaced inside the app           */
/* ------------------------------------------------------------------ */

export interface AnimeOfTheDay {
  day: string;
  anime: {
    id: number;
    title: string;
    image: string;
    format: string;
    episodes: number;
    genres: string[];
    score: number;
    popularity: number;
    status: string;
    synopsis: string;
  };
  why: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string | null;
  points: number;
  level: number;
  achievements: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  image?: string;
  source: string;
  type: string;
  publishedAt: string;
  tags: string[];
}

export interface PollOption {
  id: string;
  label: string;
  image?: string | null;
  _count?: { votes: number };
}

export interface PollItem {
  id: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
  endsAt?: string | null;
  createdAt?: string;
  options: PollOption[];
  createdBy?: { id: string; username: string; avatar?: string | null } | null;
  _count?: { votes: number };
  userVote?: string | null;
}

export interface PollsResponse {
  polls: PollItem[];
  total: number;
  page: number;
  perPage: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  animeTitle?: string;
  animeImage?: string;
}

export interface QuizCheckResult {
  correct: boolean;
  correctAnswer?: string;
  explanation?: string;
}

export interface PlotGame {
  mediaId: number;
  plot: string;
  genres: string[];
  year: number;
}

export interface SilhouetteGame {
  mediaId: number;
  imageUrl: string;
  hint: string;
}

export interface OstGame {
  mediaId: number;
  song: string;
  artist: string;
  type: 'OP' | 'ED' | 'OST' | string;
  hint: string;
}

export interface GameGuessResult {
  correct: boolean;
  hints: string[];
  attempts: number;
  gameOver: boolean;
  target?: {
    title?: string;
    mediaId?: number;
    character?: string;
    anime?: string;
    imageUrl?: string;
  };
}

export interface OSTEntry {
  id: string;
  animeTitle: string;
  animeId: number;
  type: 'OP' | 'ED' | 'INSERT' | 'OST' | 'CHARACTER' | string;
  title: string;
  artist: string;
  composer?: string;
  videoUrl?: string;
  image?: string;
  year: number;
  season?: string;
}

export interface OSTResponse {
  osts: OSTEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface WallpaperItem {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  animeTitle?: string | null;
  resolution?: string | null;
  category?: string | null;
  tags?: string | null;
  likes: number;
  downloads: number;
}

export interface WallpapersResponse {
  items: WallpaperItem[];
  total: number;
  page: number;
  hasNextPage: boolean;
}

/* ------------------------------------------------------------------ */
/* TV & streaming guide (website /tv-schedule)                         */
/* ------------------------------------------------------------------ */

export interface TvChannelInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  region: string;
  website: string;
  dthNumbers?: string;
  type: 'tv' | 'youtube';
  subscriberCount?: string;
  logoUrl?: string;
  /** Same-origin cached copy served by /api/channel-logo/<id>. */
  logoProxyUrl?: string;
  /** Which background the logo is legible on. */
  logoPlate?: 'light' | 'dark';
  logoInvert?: boolean;
}

export interface TvTimeSlot {
  show: string;
  start: string;
  end: string;
  duration: number;
  description?: string;
  episode?: number;
  coverImage?: string;
  isLive?: boolean;
}

export interface TvDaySchedule {
  day: string;
  slots: TvTimeSlot[];
}

export interface TvChannelEntry {
  channel: TvChannelInfo;
  schedule?: TvDaySchedule;
  /** Where the listings came from; `fallback` means the offline guide. */
  source?: 'epg' | 'fallback' | 'live' | 'empty';
}

export interface TvScheduleResponse {
  day: string;
  channels: TvChannelEntry[];
  availableDays: string[];
  today?: string;
  updatedAt?: string;
  liveAiringTotal?: number;
  /** At least one linear channel is showing the curated offline guide. */
  offlineLinear?: boolean;
}

/* ------------------------------------------------------------------ */
/* Reels (website /reels)                                              */
/* ------------------------------------------------------------------ */

export interface ReelUser {
  id: string;
  username: string;
  avatar?: string | null;
  followedByMe?: boolean;
}

export interface Reel {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  duration: number;
  views: number;
  animeId?: number | null;
  animeTitle?: string | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  user: ReelUser;
}

export interface ReelsResponse {
  reels: Reel[];
  nextCursor?: string | null;
  hasMore?: boolean;
  page?: number;
}

/* ------------------------------------------------------------------ */
/* Live dub uploads (website /live-dubs)                               */
/* ------------------------------------------------------------------ */

export interface LiveDubEntry {
  videoId: string;
  title: string;
  published: string;
  language: string;
  thumbnail: string;
  url: string;
}

export interface LiveDubSource {
  id: string;
  name: string;
  channelName: string;
  channelUrl: string;
  fetchedAt: string;
  ok: boolean;
  entries: LiveDubEntry[];
}

export interface LiveDubsResponse {
  fetchedAt: string;
  sources: LiveDubSource[];
}

export interface DubCatalogTitle {
  id: string;
  source: string;
  sourceName: string;
  sourceUrl: string;
  slug: string;
  title: string;
  kind: 'series' | 'movie' | string;
  posterUrl: string | null;
  languages: string[];
  genres: string[];
  season: string | null;
  episodeInfo: string | null;
  description: string | null;
  year: number | null;
  rating: number | null;
  updatedAt: string;
  lastModified: string | null;
}

export interface DubCatalogResponse {
  success: boolean;
  items: DubCatalogTitle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DubAiring {
  id: string;
  source: string;
  sourceName: string;
  title: string;
  posterUrl: string | null;
  season: string | null;
  episodeInfo: string | null;
  languages: string[];
  dayLabel: string | null;
  timeLabel: string | null;
  releaseAt: string | null;
  sourceUrl: string;
}

export interface DubScheduleListResponse {
  success: boolean;
  total: number;
  days: string[];
  groups: { day: string; items: DubAiring[] }[];
  unscheduled: DubAiring[];
}

export interface DubLanguageStat {
  language: string;
  slug: string;
  total: number;
  series: number;
  movies: number;
}

export interface DubLanguagesResponse {
  success: boolean;
  total: number;
  languages: DubLanguageStat[];
}

export interface DubGenreStat {
  genre: string;
  slug: string;
  total: number;
  series: number;
  movies: number;
}

export interface DubGenresResponse {
  success: boolean;
  total: number;
  genres: DubGenreStat[];
}

export interface DubSourceInfo {
  id: string;
  name: string;
  shortName: string;
  description: string;
  accent: string;
  baseUrl: string;
  status: string;
  lastSyncAt: string | null;
  itemCount: number;
  redirectPath: string;
}

export interface DubOverviewResponse {
  success: boolean;
  total: number;
  series: number;
  movies: number;
  scheduleCount: number;
  languageCount: number;
  languages: DubLanguageStat[];
  sources: DubSourceInfo[];
  genres: DubGenreStat[];
  updatedAt: string | null;
  schedule: { days: string[]; endpoint: string };
}

