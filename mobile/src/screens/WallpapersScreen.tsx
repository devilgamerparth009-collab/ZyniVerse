import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { WallpaperItem } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COL_GAP = spacing.sm;
const CARD_W = (SCREEN_WIDTH - spacing.md * 2 - COL_GAP) / 2;

const SORTS = [
  { key: 'popular', label: '🔥 Popular' },
  { key: 'recent', label: '🆕 Recent' },
  { key: 'downloads', label: '⬇️ Most saved' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

export default function WallpapersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();
  const tint = isDiwali ? '#f59e0b' : colors.primary;

  const [sort, setSort] = useState<SortKey>('popular');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<WallpaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WallpaperItem | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const fade = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (sortKey: SortKey, search: string) => {
    setError(null);
    try {
      const data = await api.fun.wallpapers({
        sort: sortKey,
        search: search || undefined,
        perPage: 30,
      });
      setItems(data.items || []);
    } catch {
      setError('Could not load wallpapers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => load(sort, query), query ? 450 : 0);
    return () => clearTimeout(t);
  }, [sort, query, load]);

  const openPreview = (item: WallpaperItem) => {
    setPreview(item);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  };

  const like = async (item: WallpaperItem) => {
    const user = await getCurrentUser().catch(() => null);
    if (!user) {
      Alert.alert('Sign in to save', 'Log in to like wallpapers and keep your favourites.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    try {
      await api.fun.likeWallpaper(item.id);
      setLiked((l) => ({ ...l, [item.id]: !l[item.id] }));
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
  };

  const download = (item: WallpaperItem) => {
    Linking.openURL(item.imageUrl).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Wallpapers" emoji="🖼️" subtitle="4K anime art for your phone" accent={tint} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search anime or character…"
            placeholderTextColor={colors.textDim}
            style={[
              styles.search,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => setSort(s.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? tint : colors.surface,
                    borderColor: active ? tint : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#08090f' : colors.textMuted, fontWeight: active ? '900' : '600' },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tint} size="large" />
          </View>
        ) : error ? (
          <ErrorView message={error} onRetry={() => load(sort, query)} />
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>🖼️</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No wallpapers found. Try a different search.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item, i) => (
              <FadeInView key={item.id} delay={Math.min(i * 35, 420)} offset={10}>
                <PressableScale onPress={() => openPreview(item)}>
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Image
                      source={{ uri: item.thumbnailUrl || item.imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                    <View style={styles.cardFoot}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.animeTitle || item.title}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textDim }]} numberOfLines={1}>
                        ❤️ {item.likes} · ⬇️ {item.downloads}
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              </FadeInView>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Full-screen preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Animated.View style={[styles.modal, { opacity: fade }]}>
          {preview && (
            <>
              <Image source={{ uri: preview.imageUrl }} style={styles.modalImage} resizeMode="contain" />
              <View style={[styles.modalBar, { paddingBottom: insets.bottom + spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {preview.animeTitle || preview.title}
                  </Text>
                  <Text style={styles.modalMeta}>
                    {preview.resolution || 'HD'}
                    {preview.category ? ` · ${preview.category}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => like(preview)}
                  accessibilityLabel="Like wallpaper"
                >
                  <Text style={styles.modalBtnText}>{liked[preview.id] ? '❤️' : '🤍'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: tint }]}
                  onPress={() => download(preview)}
                  accessibilityLabel="Download wallpaper"
                >
                  <Text style={[styles.modalBtnText, { color: '#08090f' }]}>⬇️ Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => setPreview(null)}
                  accessibilityLabel="Close preview"
                >
                  <Text style={styles.modalBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  search: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.sm,
  },
  chipRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginRight: spacing.sm,
  },
  chipText: {
    fontSize: 11,
  },
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_W,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  image: {
    width: '100%',
    height: CARD_W * 1.45,
  },
  cardFoot: {
    padding: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 9,
    marginTop: 2,
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
  },
  modalBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  modalMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 2,
  },
  modalBtn: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 6,
  },
  modalBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
