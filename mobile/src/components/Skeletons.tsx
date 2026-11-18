import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

type SkeletonWidth = number | `${number}%` | 'auto';

export function SkeletonBlock({
  style,
  width,
  height,
  radius = borderRadius.sm,
}: {
  style?: StyleProp<ViewStyle>;
  width?: SkeletonWidth;
  height?: number;
  radius?: number;
}) {
  const opacity = useShimmer();
  // Keep static geometry in a plain style entry so only opacity is animated.
  const geometry: ViewStyle = { width, height, borderRadius: radius };
  return <Animated.View style={[styles.block, geometry, { opacity }, style]} />;
}

/** Three poster tiles in a row, matching the Dub Hub catalogue grid. */
export function CatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.tile}>
          <SkeletonBlock height={132} radius={borderRadius.md} />
          <SkeletonBlock height={12} style={styles.gap} />
          <SkeletonBlock height={10} width="65%" style={styles.smallGap} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder rows for the watch-party list. */
export function PartyListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.partyCard}>
          <SkeletonBlock width={74} height={104} radius={borderRadius.md} />
          <View style={styles.partyBody}>
            <SkeletonBlock height={14} width="88%" radius={borderRadius.sm} />
            <SkeletonBlock height={11} width="60%" style={styles.gap} radius={borderRadius.sm} />
            <SkeletonBlock height={10} width="45%" style={styles.smallGap} radius={borderRadius.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceLight,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  tile: {
    width: '31%',
  },
  list: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  partyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm + 2,
  },
  partyBody: {
    flex: 1,
  },
  gap: {
    marginTop: spacing.sm,
  },
  smallGap: {
    marginTop: spacing.xs + 2,
  },
});
