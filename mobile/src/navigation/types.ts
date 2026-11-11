export type BrowseMode =
  | 'trending'
  | 'popular'
  | 'top-rated'
  | 'seasonal'
  | 'upcoming';

export type RootStackParamList = {
  Splash: undefined;
  MainTabs: undefined;
  AnimeDetail: { id: number; title?: string };
  FillerGuide: { id: number; title: string };
  Browse: {
    mode?: BrowseMode;
    genre?: string;
    title?: string;
    search?: string;
  };
  Dubbed: undefined;
  ThreadList: {
    category?: string;
    categoryName?: string;
    animeId?: number;
    animeTitle?: string;
  };
  ThreadDetail: { id: string; title?: string };
  Notifications: undefined;
  EditProfile: undefined;
  ForumCategory: { slug: string; name?: string };
  Settings: undefined;
  Recommendations: undefined;
  TournamentDetail: { id: string; title: string };
  Login: undefined;
  FunZone: undefined;
  Quiz: undefined;
  Games: { mode?: 'plot' | 'silhouette' | 'ost' } | undefined;
  Polls: undefined;
  Leaderboard: undefined;
  News: undefined;
  OST: undefined;
  Wallpapers: undefined;
  TVGuide: undefined;
  Reels: undefined;
  LiveDubs: undefined;
  Wordle: undefined;
  DailyDubSchedule: undefined;
  Web: { title?: string; path?: string; url?: string };
};

export type TabParamList = {
  Home: undefined;
  FunZone: undefined;
  Tournaments: undefined;
  Search: undefined;
  Schedule: undefined;
  Forum: undefined;
  Profile: undefined;
};
