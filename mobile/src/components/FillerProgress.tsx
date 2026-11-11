import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { getFillerColor } from '../utils/helpers';

interface Props {
  totalEpisodes: number;
  totalFillers: number;
  fillerPercentage: number;
}

export default function FillerProgress({ totalEpisodes, totalFillers, fillerPercentage }: Props) {
  const { colors } = useTheme();
  const barColor = getFillerColor(fillerPercentage);
  const canonCount = totalEpisodes - totalFillers;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.percentageRow}>
        <Text style={[styles.percentage, { color: barColor }]}>
          {fillerPercentage.toFixed(1)}%
        </Text>
        <Text style={[styles.label, { color: colors.textMuted }]}>Filler</Text>
      </View>
      <View style={styles.barContainer}>
        <View style={[styles.barBackground, { backgroundColor: colors.surfaceLight }]}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.min(fillerPercentage, 100)}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      </View>
      <View style={styles.counts}>
        <Text style={[styles.countText, { color: colors.textMuted }]}>
          <Text style={{ color: colors.success }}>{canonCount}</Text> Canon
        </Text>
        <Text style={[styles.countText, { color: colors.textMuted }]}>
          <Text style={{ color: colors.error }}>{totalFillers}</Text> Filler
        </Text>
        <Text style={[styles.countText, { color: colors.textMuted }]}>
          <Text style={{ color: colors.text }}>{totalEpisodes}</Text> Total
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  percentageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  percentage: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  label: {
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  barContainer: {
    marginBottom: spacing.sm,
  },
  barBackground: {
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  counts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countText: {
    fontSize: fontSize.sm,
  },
});
