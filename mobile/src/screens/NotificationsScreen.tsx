import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { NotificationItem } from '../types';
import { timeAgo } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';

const TYPE_ICON: Record<string, string> = {
  AIRING: '📺',
  FOLLOW: '👤',
  REVIEW: '⭐',
  COMMENT: '💬',
  IMPORT: '📥',
  SYSTEM: '📢',
  EVENT: '🎉',
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors: themeColors } = useTheme();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const user = await getCurrentUser();
      setLoggedIn(!!user);
      if (!user) {
        setItems([]);
        setUnread(0);
        return;
      }
      const data = await api.notifications.list(60);
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch (e: any) {
      setError(e?.message || 'Could not load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const markAllRead = async () => {
    if (unread === 0) return;
    try {
      await api.notifications.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (e: any) {
      Alert.alert('Could not mark as read', e?.message || 'Try again later.');
    }
  };

  const openNotification = (item: NotificationItem) => {
    const link = item.link || '';
    const animeMatch = link.match(/\/anime\/(\d+)/);
    const threadMatch = link.match(/\/forum\/(?:thread|threads)\/([A-Za-z0-9_-]+)/);
    if (animeMatch) {
      navigation.navigate('AnimeDetail', { id: Number(animeMatch[1]) });
      return;
    }
    if (threadMatch) {
      navigation.navigate('ThreadDetail', { id: threadMatch[1] });
      return;
    }
    if (link.startsWith('http')) {
      Linking.openURL(link).catch(() => {});
    } else if (link) {
      Linking.openURL(`https://zyverse.in${link.startsWith('/') ? '' : '/'}${link}`).catch(() => {});
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  if (!loggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🔔</Text>
        <Text style={styles.emptyText}>Sign in to see notifications</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && items.length === 0) {
    return <ErrorView message={error} onRetry={load} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </Text>
          {unread > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={styles.markAll}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index * 40, 320)} offset={12} duration={340}>
          <TouchableOpacity
            style={[styles.card, !item.read && styles.cardUnread]}
            activeOpacity={0.8}
            onPress={() => openNotification(item)}
          >
            <Text style={styles.typeIcon}>{TYPE_ICON[item.type] || '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.body ? (
                <Text style={styles.body} numberOfLines={3}>
                  {item.body}
                </Text>
              ) : null}
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
        </FadeInView>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌙</Text>
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptyHint}>
            Airing reminders, replies, and follows will show up here.
          </Text>
        </View>
      }
    />
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  markAll: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardUnread: {
    backgroundColor: 'rgba(192,132,252,0.1)',
    borderColor: 'rgba(192,132,252,0.35)',
  },
  typeIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  titleUnread: {
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 17,
  },
  time: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    marginTop: 4,
  },
  center: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
  },
  primaryButtonText: {
    color: '#0a0a0f',
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
}));
