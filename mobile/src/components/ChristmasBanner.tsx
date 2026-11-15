import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spacing, borderRadius, fontSize } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { isChristmasWindow } from '../utils/themeUtils';

const CHRISTMAS_DAY = 25;

function nextChristmasStart(now: Date): Date {
  const year = now.getMonth() === 11 && now.getDate() > CHRISTMAS_DAY ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, 11, CHRISTMAS_DAY, 0, 0, 0, 0);
}

function breakdown(target: Date, now: Date) {
  const diff = Math.max(0, target.getTime() - now.getTime());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
  };
}

/**
 * Seasonal countdown card. Only renders inside the 1–25 December window, so the
 * normal home screen is untouched for the other eleven months.
 */
export default function ChristmasBanner({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => new Date());

  const active = isChristmasWindow(now);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [active]);

  const left = useMemo(() => breakdown(nextChristmasStart(now), now), [now]);
  const isToday = now.getMonth() === 11 && now.getDate() === CHRISTMAS_DAY;

  if (!active) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, { borderColor: '#1e3a5f', backgroundColor: '#0b1524' }]}
      accessibilityLabel="Christmas specials"
    >
      <View style={styles.row}>
        <Text style={styles.emoji}>{isToday ? '🎁' : '🎄'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: '#f0f9ff' }]}>
            {isToday ? 'Merry Christmas, ZyniVerse!' : 'ZyniVerse Christmas'}
          </Text>
          <Text style={[styles.sub, { color: '#93c5fd' }]}>
            {isToday
              ? 'Snow is falling — enjoy the winter specials.'
              : `Snowfall, icy accents & specials · ${left.days}d ${left.hours}h ${left.minutes}m left`}
          </Text>
        </View>
        <Text style={[styles.cta, { color: '#7dd3fc', borderColor: '#7dd3fc' }]}>Open</Text>
      </View>
      <View style={styles.glowRow}>
        <View style={[styles.glow, { backgroundColor: '#7dd3fc' }]} />
        <View style={[styles.glow, { backgroundColor: '#f472b6' }]} />
        <View style={[styles.glow, { backgroundColor: '#f8fafc' }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 26,
    marginRight: spacing.xs,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  sub: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  cta: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  glowRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  glow: {
    height: 3,
    flex: 1,
    borderRadius: borderRadius.full,
    opacity: 0.7,
  },
});
