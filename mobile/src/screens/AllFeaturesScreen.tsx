import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { getCurrentUser } from '../services/api';
import { colors, spacing, fontSize, borderRadius, themed } from '../theme';
import type { DiscoverMode } from '../types';
import { openSafeWebUrl } from '../utils/safeLinks';

type Feature = {
  label: string;
  emoji: string;
  /** Website path kept only for static, server-only, or privileged flows. */
  path?: string;
  /** Native screen when the website feature already has a full APK screen. */
  screen?: string;
  params?: Record<string, any>;
  /** Follow list needs the signed-in user's id resolved at tap time. */
  follow?: 'followers' | 'following';
};

type Section = {
  title: string;
  short: string;
  icon: string;
  subtitle: string;
  data: Feature[];
};

/** Reuse the native Discover screen the way Reels reuses its native stack screen. */
function D(mode: DiscoverMode): Pick<Feature, 'screen' | 'params'> {
  return { screen: 'Discover', params: { mode } };
}

const SECTIONS: Section[] = [
  {
    title: 'Dub & schedule',
    short: 'Dub & schedule',
    icon: '🎙️',
    subtitle: 'Native dub tools and stable catalog links',
    data: [
      { label: 'Dub Hub', emoji: '🇮🇳', screen: 'HindiDub', params: { tab: 'all' } },
      { label: 'Dubbed anime discovery', emoji: '🎙️', screen: 'Dubbed' },
      { label: 'Live dubs', emoji: '📡', screen: 'LiveDubs' },
      { label: 'Daily dub schedule', emoji: '🗓️', screen: 'DailyDubSchedule' },
      { label: 'TV guide', emoji: '📺', screen: 'TVGuide' },
      // Stable website redirects: the destination can move without breaking the app.
      { label: 'Open Indian dub catalog', emoji: '🔗', path: '/go/dub/animedubhindi' },
      { label: 'Open regional dub catalog', emoji: '🔗', path: '/go/dub/desidubanime' },
    ],
  },
  {
    title: 'Discover',
    short: 'Discover',
    icon: '🧭',
    subtitle: 'Anime, manga, and their detail pages',
    data: [
      { label: 'Trending', emoji: '🔥', screen: 'Browse', params: { mode: 'trending' } },
      { label: 'Popular', emoji: '⭐', screen: 'Browse', params: { mode: 'popular' } },
      { label: 'Top rated', emoji: '🏆', screen: 'Browse', params: { mode: 'top-rated' } },
      { label: 'Seasonal', emoji: '🌸', screen: 'Browse', params: { mode: 'seasonal' } },
      { label: 'Upcoming', emoji: '⏳', screen: 'Browse', params: { mode: 'upcoming' } },
      { label: 'Episode pulse', emoji: '🔥', screen: 'EpisodePulse' },
      { label: 'A–Z alphabetical', emoji: '🔤', ...D('a-z') },
      { label: 'Genres', emoji: '🎭', ...D('genres') },
      { label: 'Tags', emoji: '🏷️', ...D('tags') },
      { label: 'Smart search', emoji: '🔍', ...D('semantic') },
      { label: 'Compare anime', emoji: '⚖️', ...D('compare') },
      { label: 'Watch order', emoji: '🧭', ...D('watch-order') },
      { label: 'Wiki', emoji: '📜', ...D('wiki') },
      { label: 'Characters', emoji: '👤', ...D('characters') },
      { label: 'Staff', emoji: '🎬', ...D('staff') },
      { label: 'Studios', emoji: '🏢', ...D('studios') },
      { label: 'Voice actors', emoji: '🎤', ...D('voice-actors') },
      { label: 'Indian dub guide', emoji: '🇮🇳', screen: 'HindiDub', params: { tab: 'all' } },
      { label: 'Watch guide', emoji: '▶️', ...D('guides') },
      { label: 'Guides', emoji: '📚', ...D('guides') },
      { label: 'Critiques', emoji: '🖊️', ...D('critiques') },
      { label: 'Theories', emoji: '💭', ...D('theories') },
      { label: 'All filler lists', emoji: '📃', screen: 'FillerLibrary' },
      { label: 'Anime birthdays', emoji: '🎂', ...D('calendar') },
      { label: 'Anime night', emoji: '🌙', ...D('random') },
      { label: 'Theatrical releases', emoji: '🎬', ...D('calendar') },
      { label: 'Popular characters', emoji: '⭐', ...D('characters') },
      { label: 'My characters', emoji: '💛', ...D('saved') },
    ],
  },
  {
    title: 'Manga & other media',
    short: 'Manga',
    icon: '📚',
    subtitle: 'Readers and related catalogs',
    data: [
      { label: 'Manga', emoji: '📚', screen: 'Manga' },
      { label: 'Manga chapters & reader', emoji: '📖', screen: 'Manga' },
      { label: 'Manga releases', emoji: '🆕', ...D('manga-releases') },
      { label: 'Light novels', emoji: '📕', ...D('light-novels') },
      { label: 'Toons', emoji: '🧸', ...D('toons') },
      { label: 'Doujinshi', emoji: '📓', ...D('doujinshi') },
      { label: 'Figures', emoji: '🗿', ...D('figures') },
      { label: 'Live action', emoji: '🎥', ...D('live-action') },
      { label: 'Voice lines', emoji: '🔊', ...D('voice-lines') },
      { label: 'Manga list', emoji: '📃', ...D('lists') },
      { label: 'Manga Million', emoji: '🏅', ...D('challenges') },
      { label: 'Podcast', emoji: '🎧', ...D('blog') },
    ],
  },
  {
    title: 'Community & fun',
    short: 'Community',
    icon: '💬',
    subtitle: 'Native screens where available',
    data: [
      { label: 'Social feed', emoji: '📰', screen: 'Feed' },
      { label: 'Messages', emoji: '💬', screen: 'Messages' },
      { label: 'Local chats', emoji: '🗨️', screen: 'LocalChats' },
      { label: 'Friends', emoji: '🤝', screen: 'Friends' },
      { label: 'Discover people', emoji: '🧭', screen: 'DiscoverPeople' },
      { label: 'Followers', emoji: '👥', screen: 'FollowList', follow: 'followers' },
      { label: 'Following', emoji: '👥', screen: 'FollowList', follow: 'following' },
      { label: 'Broadcast channels', emoji: '📣', screen: 'Channels' },
      { label: 'Stories', emoji: '✨', screen: 'Stories' },
      { label: 'Forum', emoji: '💭', screen: 'Forum' },
      { label: 'Communities', emoji: '🏛️', screen: 'CommunityHub' },
      { label: 'Moments', emoji: '✨', ...D('posts') },
      { label: 'Blog', emoji: '✍️', ...D('blog') },
      { label: 'Fan art / Cosplay', emoji: '🎨', ...D('saved') },
      { label: 'Memes', emoji: '😂', ...D('posts') },
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
    short: 'Lists & stats',
    icon: '📈',
    subtitle: 'Your profile and tracking tools',
    data: [
      { label: 'Profile & achievements', emoji: '👤', screen: 'Profile' },
      { label: 'Custom lists', emoji: '📚', ...D('lists') },
      { label: 'Shared watchlists', emoji: '🤝', ...D('shared-watchlists') },
      { label: 'Anime Tracker', emoji: '📺', screen: 'Tracker' },
      { label: 'Watchlist', emoji: '📌', ...D('watchlist') },
      { label: 'Season tracker', emoji: '📊', ...D('seasonal-tracker') },
      { label: 'Stats dashboard', emoji: '📈', ...D('stats') },
      { label: 'Stats timeline', emoji: '🕒', ...D('timeline') },
      { label: 'Wrapped / Recap', emoji: '🎊', ...D('wrapped') },
      { label: 'Activity graph', emoji: '📉', ...D('graph') },
      { label: 'Activity', emoji: '🏃', ...D('activity') },
      { label: 'Backlog', emoji: '🗃️', ...D('backlog') },
      { label: 'Saved', emoji: '💾', ...D('saved') },
      { label: 'Tier lists', emoji: '🏅', ...D('tierlist') },
    ],
  },
  {
    title: 'Tools & extras',
    short: 'Tools',
    icon: '🧰',
    subtitle: 'Useful website utilities',
    data: [
      { label: 'Tools', emoji: '🧰', ...D('tools') },
      { label: 'Binge calculator', emoji: '🍿', ...D('binge-calculator') },
      { label: 'Filler time', emoji: '⏭️', ...D('filler-time') },
      { label: 'Watch stats', emoji: '📊', ...D('watch-stats') },
      { label: 'Calendar', emoji: '🗓️', ...D('calendar') },
      { label: 'Random picker', emoji: '🎲', ...D('random') },
      { label: 'Events', emoji: '🎉', ...D('events') },
      { label: 'Conventions', emoji: '🎪', ...D('conventions') },
      { label: 'Awards', emoji: '🏆', ...D('awards') },
      { label: 'Challenges', emoji: '⚔️', ...D('challenges') },
      { label: 'Contests', emoji: '🎯', ...D('contests') },
      { label: 'Tournaments', emoji: '🥊', screen: 'Tournaments' },
      { label: 'Anime themes & OST', emoji: '🎵', screen: 'OST' },
      { label: 'Wallpapers', emoji: '🖼️', screen: 'Wallpapers' },
      { label: 'Download / extension', emoji: '⬇️', path: '/download' },
      { label: 'AI corner', emoji: '🤖', ...D('semantic') },
      { label: 'Developer / webhooks', emoji: '🛠️', path: '/developer/webhooks' },
      { label: 'Admin', emoji: '🔐', path: '/admin' },
    ],
  },
  {
    title: 'Account, data & commerce',
    short: 'Account',
    icon: '⚙️',
    subtitle: 'Sensitive actions are confirmed on the website',
    data: [
      { label: 'Edit profile', emoji: '✏️', screen: 'EditProfile' },
      { label: 'Settings', emoji: '⚙️', screen: 'Settings' },
      { label: 'Data, imports & tokens', emoji: '🔑', path: '/profile?tab=api' },
      { label: 'Export data', emoji: '📤', path: '/api/watchlist/export?format=csv' },
      { label: 'Rewards & earning', emoji: '🪙', ...D('rewards') },
      { label: 'Premium', emoji: '💎', ...D('premium') },
      { label: 'Merch', emoji: '🛍️', ...D('merch') },
      { label: 'My orders', emoji: '📦', ...D('orders') },
      { label: 'Commissions', emoji: '🎨', ...D('commissions') },
    ],
  },
  {
    title: 'Info & legal',
    short: 'Info',
    icon: 'ℹ️',
    subtitle: 'About ZyniVerse and your rights',
    data: [
      { label: 'About', emoji: 'ℹ️', path: '/about' },
      { label: 'Contact', emoji: '📮', path: '/contact' },
      { label: 'Feedback', emoji: '💬', path: '/feedback' },
      { label: 'Terms', emoji: '📃', path: '/terms' },
      { label: 'Privacy', emoji: '🔒', path: '/privacy' },
      { label: 'DMCA', emoji: '⚖️', path: '/dmca' },
      { label: 'Disclaimer', emoji: '📄', path: '/disclaimer' },
      { label: 'Docs', emoji: '📖', path: '/docs' },
      { label: 'More anime sites', emoji: '🌐', path: '/best-anime-sites' },
      { label: 'Alternatives', emoji: '🔁', path: '/alternatives' },
      { label: 'Link to us', emoji: '🔗', path: '/link-to-us' },
    ],
  },
];

const FEATURE_COUNT = SECTIONS.reduce((total, section) => total + section.data.length, 0);
const CATEGORY_COUNT = SECTIONS.length;
const NATIVE_COUNT = SECTIONS.reduce(
  (total, section) => total + section.data.filter((item) => !!item.screen).length,
  0
);

/** Shortcuts reuse the exact entries above — no duplicated feature data. */
const FEATURED_ITEMS = [
  'Popular',
  'Trending',
  'Dub Hub',
  'Daily dub schedule',
  'Watchlist',
  'Random picker',
]
  .map((label) => {
    for (const section of SECTIONS) {
      const item = section.data.find((entry) => entry.label === label);
      if (item) return { item, category: section.short };
    }
    return null;
  })
  .filter((entry): entry is { item: Feature; category: string } => entry !== null);

const TAB_SCREENS = new Set(['Profile', 'Forum', 'Tournaments']);

function CatalogHero() {
  const { colors: active, isLaunch } = useTheme();
  const tint = active.primary;
  const stats = [
    { value: FEATURE_COUNT, label: 'Features' },
    { value: CATEGORY_COUNT, label: 'Categories' },
    { value: NATIVE_COUNT, label: 'In the app' },
  ];

  return (
    <FadeInView delay={20} offset={18}>
      <View style={[styles.hero, { backgroundColor: active.surface, borderColor: active.border }]}>
        <View style={[styles.heroGlow, { backgroundColor: `${tint}18` }]} pointerEvents="none" />
        <View style={styles.heroTop}>
          <Text style={styles.heroEmoji}>🧰</Text>
          <View
            style={[styles.heroBadge, { backgroundColor: `${tint}1f`, borderColor: `${tint}66` }]}
          >
            <Text style={[styles.heroBadgeText, { color: tint }]}>
              {isLaunch ? '✦ LAUNCH EDITION' : '✦ ALL IN ONE PLACE'}
            </Text>
          </View>
        </View>
        <Text style={[styles.heroTitle, { color: active.text }]}>
          Your whole anime world, in one place
        </Text>
        <Text style={[styles.heroText, { color: active.textMuted }]}>
          Explore {FEATURE_COUNT} features across {CATEGORY_COUNT} categories. Jump straight into
          the screens and tools you use most.
        </Text>
        <View style={styles.statRow}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[styles.statCard, { backgroundColor: `${tint}14`, borderColor: `${tint}33` }]}
            >
              <Text style={[styles.statValue, { color: tint }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: active.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </FadeInView>
  );
}

function FeaturedRail({ onOpen }: { onOpen: (item: Feature) => void }) {
  const { colors: active } = useTheme();
  const tint = active.primary;

  return (
    <FadeInView delay={80} offset={14} style={styles.featuredWrap}>
      <View style={styles.featuredHead}>
        <Text style={[styles.featuredTitle, { color: active.text }]}>⭐ Featured</Text>
        <Text style={[styles.featuredHint, { color: active.textDim }]}>Popular picks</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.rail}
      >
        {FEATURED_ITEMS.map(({ item, category }) => (
          <PressableScale
            key={`featured-${item.label}`}
            accessibilityLabel={`Open ${item.label}`}
            onPress={() => void onOpen(item)}
            style={[styles.featureCard, { backgroundColor: active.surface, borderColor: active.border }]}
          >
            <View style={[styles.featureIcon, { backgroundColor: `${tint}1f` }]}>
              <Text style={styles.featureEmoji}>{item.emoji}</Text>
            </View>
            <Text style={[styles.featureLabel, { color: active.text }]} numberOfLines={2}>
              {item.label}
            </Text>
            <Text style={[styles.featureTag, { color: tint }]} numberOfLines={1}>
              {category}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </FadeInView>
  );
}

function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  const { colors: active } = useTheme();
  const tint = active.primary;

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🔎</Text>
      <Text style={[styles.emptyTitle, { color: active.text }]}>No features found</Text>
      <Text style={[styles.emptyText, { color: active.textMuted }]}>
        {query
          ? `Nothing matches "${query}". Try another word or clear your search.`
          : 'Try another search to find what you need.'}
      </Text>
      <PressableScale
        style={[styles.emptyBtn, { backgroundColor: tint }]}
        onPress={onClear}
        accessibilityLabel="Clear search"
      >
        <Text style={[styles.emptyBtnText, { color: active.background }]}>Clear search</Text>
      </PressableScale>
    </View>
  );
}

export default function AllFeaturesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors: active, isLaunch } = useTheme();
  const tint = active.primary;
  const [query, setQuery] = useState('');
  const listRef = useRef<SectionList<Feature, Section>>(null);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      data: section.data.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q) ||
          section.subtitle.toLowerCase().includes(q) ||
          (item.screen ? 'native screen' : 'opens in your browser').includes(q)
      ),
    })).filter((section) => section.data.length > 0);
  }, [query]);

  const resultCount = useMemo(
    () => sections.reduce((total, section) => total + section.data.length, 0),
    [sections]
  );

  const open = async (item: Feature) => {
    if (item.follow) {
      const mode = item.follow;
      try {
        const me = await getCurrentUser();
        if (!me) {
          navigation.navigate('Login');
          return;
        }
        navigation.navigate('FollowList', { userId: me.id, mode });
      } catch {
        navigation.navigate('Login');
      }
      return;
    }
    if (item.screen) {
      // Tab screens live inside MainTabs, not the root stack.
      if (TAB_SCREENS.has(item.screen)) {
        navigation.navigate('MainTabs', { screen: item.screen, params: item.params });
      } else {
        navigation.navigate(item.screen, item.params);
      }
      return;
    }
    if (item.path) {
      openSafeWebUrl(item.path, '/');
    }
  };

  const scrollToSection = (index: number) => {
    listRef.current?.scrollToLocation({
      sectionIndex: index,
      itemIndex: 0,
      viewOffset: 92,
      animated: true,
    });
  };

  const trimmedQuery = query.trim();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="All features"
        subtitle="Browse every screen, tool, and guide"
        emoji="🧰"
      />

      {/* Search and category shortcuts stay within reach while scrolling. */}
      <FadeInView delay={110} offset={10} style={styles.searchWrap}>
        <View
          style={[styles.searchBox, { borderColor: active.border, backgroundColor: active.surface }]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.search, { color: active.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search features and guides"
            placeholderTextColor={active.textDim}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
            >
              <Text style={[styles.clearText, { color: active.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {trimmedQuery ? (
          <Text style={[styles.resultText, { color: active.textDim }]}>
            {resultCount} {resultCount === 1 ? 'match' : 'matches'} for "{trimmedQuery}"
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
          >
            {SECTIONS.map((section, index) => (
              <PressableScale
                key={section.title}
                accessibilityLabel={`Jump to ${section.title}`}
                onPress={() => scrollToSection(index)}
                style={[styles.chip, { borderColor: active.border, backgroundColor: active.surface }]}
              >
                <Text style={styles.chipEmoji}>{section.icon}</Text>
                <Text style={[styles.chipText, { color: active.textMuted }]}>{section.short}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </FadeInView>

      <SectionList<Feature, Section>
        ref={listRef}
        sections={sections}
        keyExtractor={(item, index) => `${item.label}-${index}`}
        ListHeaderComponent={
          <>
            <CatalogHero />
            <FeaturedRail onOpen={open} />
          </>
        }
        ListEmptyComponent={
          <FadeInView delay={40}>
            <EmptyState query={trimmedQuery} onClear={() => setQuery('')} />
          </FadeInView>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: `${tint}1a`, borderColor: `${tint}44` },
              ]}
            >
              <Text style={styles.sectionIconText}>{section.icon}</Text>
            </View>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { color: active.text }]}>{section.title}</Text>
              <Text style={[styles.sectionSubtitle, { color: active.textDim }]} numberOfLines={1}>
                {section.subtitle}
              </Text>
            </View>
            <Text style={[styles.sectionCount, { color: tint, backgroundColor: `${tint}1a` }]}>
              {section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <PressableScale
            accessibilityLabel={`${item.label}, ${
              item.screen ? 'opens in the app' : 'opens in your browser'
            }`}
            onPress={() => void open(item)}
            style={[styles.row, { backgroundColor: active.surface, borderColor: active.border }]}
          >
            <View style={[styles.rowEmoji, { backgroundColor: `${tint}16` }]}>
              <Text style={styles.rowEmojiText}>{item.emoji}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: active.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.rowKind, { color: active.textDim }]}>
                {item.screen ? 'Opens in the app' : 'Opens in your browser'}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: active.textDim }]}>›</Text>
          </PressableScale>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        windowSize={7}
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
    paddingBottom: spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  searchIcon: {
    fontSize: 16,
  },
  search: {
    flex: 1,
    paddingVertical: 0,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  clearBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  clearText: {
    fontSize: 15,
    fontWeight: '700',
  },
  chipRow: {
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 7,
    marginRight: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 13,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  resultText: {
    paddingTop: spacing.sm,
    fontSize: fontSize.xs,
  },
  hero: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroEmoji: {
    fontSize: 30,
  },
  heroBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
  },
  featuredWrap: {
    paddingTop: spacing.lg,
  },
  featuredHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  featuredTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  featuredHint: {
    fontSize: 10,
  },
  rail: {
    paddingHorizontal: spacing.md,
  },
  featureCard: {
    width: 148,
    marginRight: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: {
    fontSize: 20,
  },
  featureLabel: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  featureTag: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionIconText: {
    fontSize: 20,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 10,
  },
  sectionCount: {
    minWidth: 30,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  rowEmoji: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEmojiText: {
    fontSize: 19,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  rowKind: {
    marginTop: 2,
    fontSize: 10,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 42,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  emptyBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
}));
