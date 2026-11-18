import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';

const WEB_HOST = 'https://zyverse.in';

type Feature = {
  label: string;
  emoji: string;
  /** Website path — opened in the browser (read-only / complex UGC flows). */
  path?: string;
  /** Native screen when the website feature already has a full APK screen. */
  screen?: string;
  params?: Record<string, any>;
};

type Section = { title: string; subtitle: string; data: Feature[] };

const SECTIONS: Section[] = [
  {
    title: 'Dub & schedule',
    subtitle: 'Sab kuch ek hi Dub Hub me — yahin se kholo',
    data: [
      { label: 'Dub Hub — all / series / movies / schedule', emoji: '🇮🇳', screen: 'HindiDub', params: { tab: 'all' } },
      { label: 'Dub Hub — weekly schedule & tonight', emoji: '🗓️', screen: 'HindiDub', params: { tab: 'schedule' } },
      { label: 'Dub Hub — languages', emoji: '🌐', screen: 'HindiDub', params: { tab: 'languages' } },
      { label: 'Dub Hub — genres', emoji: '🎭', screen: 'HindiDub', params: { tab: 'genres' } },
      { label: 'Dubbed anime discovery', emoji: '🎙️', screen: 'Dubbed' },
      { label: 'Hindi dub schedule (website)', emoji: '📅', path: '/hindi-dub/schedule' },
      { label: 'Hindi dub channel schedule', emoji: '📺', path: '/hindi-dub-schedule' },
      { label: 'Hindi dub language pages', emoji: '🗣️', path: '/hindi-dub/languages/hindi' },
    ],
  },
  {
    title: 'Discover',
    subtitle: 'Anime, manga aur unke detail pages',
    data: [
      { label: 'Trending', emoji: '🔥', screen: 'Browse', params: { mode: 'trending' } },
      { label: 'Popular', emoji: '⭐', screen: 'Browse', params: { mode: 'popular' } },
      { label: 'Top rated', emoji: '🏆', screen: 'Browse', params: { mode: 'top-rated' } },
      { label: 'Seasonal', emoji: '🌸', screen: 'Browse', params: { mode: 'seasonal' } },
      { label: 'Upcoming', emoji: '⏳', screen: 'Browse', params: { mode: 'upcoming' } },
      { label: 'A–Z alphabetical', emoji: '🔤', path: '/a-z' },
      { label: 'Genres (anime / manga)', emoji: '🎭', path: '/genres' },
      { label: 'Tags', emoji: '🏷️', path: '/tags' },
      { label: 'Semantic search', emoji: '🔍', path: '/search/semantic' },
      { label: 'Compare anime', emoji: '⚖️', path: '/compare-anime' },
      { label: 'Watch order', emoji: '🧭', screen: 'Hub', params: { kind: 'watch-order', title: 'Watch Order' } },
      { label: 'Wiki', emoji: '📜', screen: 'Hub', params: { kind: 'wiki', title: 'Wiki' } },
      { label: 'Characters', emoji: '👤', screen: 'Hub', params: { kind: 'characters', title: 'Characters' } },
      { label: 'Staff', emoji: '🎬', path: '/staff' },
      { label: 'Voice actors / Indian dubs', emoji: '🎤', path: '/voice-actors/indian' },
      { label: 'Studios', emoji: '🏢', path: '/studios' },
      { label: 'Indian dub guide', emoji: '🇮🇳', path: '/indian-dubs' },
      { label: 'Watch guide', emoji: '▶️', path: '/watch' },
    ],
  },
  {
    title: 'Manga & other media',
    subtitle: 'Reader aur related catalogs',
    data: [
      { label: 'Manga', emoji: '📚', screen: 'Manga' },
      { label: 'Manga chapters & reader', emoji: '📖', path: '/manga/1/chapters' },
      { label: 'Manga releases', emoji: '🆕', screen: 'Hub', params: { kind: 'manga-releases', title: 'Manga Releases' } },
      { label: 'Light novels', emoji: '📕', screen: 'Hub', params: { kind: 'light-novels', title: 'Light Novels' } },
      { label: 'Toons', emoji: '🧸', path: '/toons' },
      { label: 'Doujinshi', emoji: '📓', path: '/doujinshi' },
      { label: 'Figures', emoji: '🗿', path: '/figures' },
      { label: 'Live action', emoji: '🎥', path: '/live-action' },
      { label: 'Voice lines', emoji: '🔊', path: '/voice-lines' },
    ],
  },
  {
    title: 'Community & fun',
    subtitle: 'Native screens where available',
    data: [
      { label: 'Social feed', emoji: '📰', screen: 'Feed' },
      { label: 'Messages', emoji: '💬', screen: 'Messages' },
      { label: 'Friends', emoji: '🤝', screen: 'Friends' },
      { label: 'Forum', emoji: '💭', screen: 'Forum' },
      { label: 'Clubs', emoji: '🏛️', screen: 'Hub', params: { kind: 'clubs', title: 'Clubs' } },
      { label: 'Moments', emoji: '✨', screen: 'Hub', params: { kind: 'moments', title: 'Moments' } },
      { label: 'Blog', emoji: '✍️', screen: 'Hub', params: { kind: 'blog', title: 'Blog' } },
      { label: 'Fan art / Cosplay', emoji: '🎨', screen: 'Hub', params: { kind: 'fanart', title: 'Fan Art' } },
      { label: 'Memes', emoji: '😂', screen: 'Hub', params: { kind: 'memes', title: 'Memes' } },
      { label: 'Reels', emoji: '🎬', screen: 'Reels' },
      { label: 'Polls', emoji: '🗳️', screen: 'Polls' },
      { label: 'Quiz', emoji: '🧠', screen: 'Quiz' },
      { label: 'Leaderboard', emoji: '🏆', screen: 'Leaderboard' },
      { label: 'Watch party', emoji: '🍿', screen: 'WatchParty' },
      { label: 'Wordle', emoji: '🟩', screen: 'Wordle' },
      { label: 'Anime DNA', emoji: '🧬', screen: 'TasteProfile' },
      { label: 'Vibe', emoji: '📡', screen: 'Vibe' },
      { label: 'News', emoji: '📰', screen: 'News' },
    ],
  },
  {
    title: 'Lists, stats & tracking',
    subtitle: 'Profile ke andar bhi yahi options',
    data: [
      { label: 'Profile (all tabs)', emoji: '👤', screen: 'Profile' },
      { label: 'Custom lists', emoji: '📚', path: '/lists' },
      { label: 'Shared watchlists', emoji: '🤝', path: '/shared-watchlists' },
      { label: 'Watchlist', emoji: '📌', screen: 'Hub', params: { kind: 'watchlist', title: 'Watchlist' } },
      { label: 'Season tracker', emoji: '📊', screen: 'Hub', params: { kind: 'seasonal-tracker', title: 'Season Tracker' } },
      { label: 'Stats dashboard', emoji: '📈', path: '/stats' },
      { label: 'Stats timeline', emoji: '🕒', path: '/stats/timeline' },
      { label: 'Wrapped / Recap', emoji: '🎊', path: '/stats/wrapped' },
      { label: 'Activity graph', emoji: '📉', path: '/graph' },
      { label: 'Activity', emoji: '🏃', path: '/activity' },
      { label: 'Backlog', emoji: '🗃️', path: '/backlog' },
      { label: 'Saved', emoji: '💾', path: '/saved' },
      { label: 'Tier lists', emoji: '🏅', path: '/tierlist' },
      { label: 'Achievements', emoji: '🎖️', screen: 'Profile' },
    ],
  },
  {
    title: 'Tools & extras',
    subtitle: 'Website ke utility pages',
    data: [
      { label: 'Tools', emoji: '🧰', path: '/tools' },
      { label: 'Binge calculator', emoji: '🍿', path: '/tools/binge-calculator' },
      { label: 'Filler time', emoji: '⏭️', path: '/tools/filler-time' },
      { label: 'Watch stats', emoji: '📊', path: '/tools/watch-stats' },
      { label: 'Events', emoji: '🎉', path: '/events' },
      { label: 'Conventions', emoji: '🎪', path: '/conventions' },
      { label: 'Awards', emoji: '🏆', path: '/awards' },
      { label: 'Challenges', emoji: '⚔️', path: '/challenges' },
      { label: 'Contests', emoji: '🎯', path: '/contests' },
      { label: 'Tournaments', emoji: '🥊', screen: 'Tournaments' },
      { label: 'Anime themes (OP/ED)', emoji: '🎵', screen: 'OST' },
      { label: 'Wallpapers', emoji: '🖼️', screen: 'Wallpapers' },
      { label: 'OST vault', emoji: '🎧', screen: 'OST' },
      { label: 'Download / extension', emoji: '⬇️', path: '/download' },
      { label: 'AI corner', emoji: '🤖', path: '/ai' },
      { label: 'Developer / webhooks', emoji: '🛠️', path: '/developer/webhooks' },
      { label: 'Admin', emoji: '🔐', path: '/admin' },
    ],
  },
  {
    title: 'Account, data & commerce',
    subtitle: 'Sensitive actions website par confirm hoti hain',
    data: [
      { label: 'Edit profile', emoji: '✏️', screen: 'EditProfile' },
      { label: 'Settings', emoji: '⚙️', screen: 'Settings' },
      { label: 'API keys & imports', emoji: '🔑', path: '/profile?tab=api' },
      { label: 'Export data', emoji: '📤', path: '/api/watchlist/export?format=csv' },
      { label: 'Daily reward / economy', emoji: '🪙', path: '/earn' },
      { label: 'Premium', emoji: '💎', path: '/premium' },
      { label: 'Merch', emoji: '🛍️', path: '/merch' },
      { label: 'My orders', emoji: '📦', path: '/my-orders' },
      { label: 'Commissions', emoji: '🎨', path: '/commissions' },
      { label: 'Earn', emoji: '💸', path: '/earn' },
    ],
  },
  {
    title: 'Info & legal',
    subtitle: 'ZyniVerse ke baare me',
    data: [
      { label: 'About', emoji: 'ℹ️', path: '/about' },
      { label: 'Contact', emoji: '📮', path: '/contact' },
      { label: 'Terms', emoji: '📃', path: '/terms' },
      { label: 'Privacy', emoji: '🔒', path: '/privacy' },
      { label: 'DMCA', emoji: '⚖️', path: '/dmca' },
      { label: 'Disclaimer', emoji: '📄', path: '/disclaimer' },
      { label: 'Docs', emoji: '📖', path: '/docs' },
      { label: 'Best anime sites', emoji: '🌐', path: '/best-anime-sites' },
      { label: 'Alternatives', emoji: '🔁', path: '/alternatives' },
      { label: 'Link to us', emoji: '🔗', path: '/link-to-us' },
    ],
  },
];

export default function AllFeaturesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      data: section.data.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q)
      ),
    })).filter((section) => section.data.length > 0);
  }, [query]);

  const open = (item: Feature) => {
    if (item.screen) {
      // These live inside the bottom-tab navigator, not the root stack.
      if (item.screen === 'Profile' || item.screen === 'Forum' || item.screen === 'Tournaments') {
        navigation.navigate('MainTabs', { screen: item.screen, params: item.params });
      } else {
        navigation.navigate(item.screen, item.params);
      }
      return;
    }
    if (item.path) {
      Linking.openURL(`${WEB_HOST}${item.path}`).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="All features"
        subtitle="Website ki har category — native screen ya safe website link"
        emoji="🧰"
      />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Feature search karein…"
          placeholderTextColor={colors.textDim}
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.label}-${index}`}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => open(item)}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.kind}>{item.screen ? 'Native screen' : 'Opens on zyverse.in'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.sm,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  emoji: {
    width: 28,
    fontSize: 17,
    textAlign: 'center',
  },
  label: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  kind: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  chevron: {
    color: colors.textDim,
    fontSize: 18,
  },
}));
