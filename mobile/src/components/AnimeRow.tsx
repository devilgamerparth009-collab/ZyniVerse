import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize } from '../theme';
import { Anime } from '../types';
import AnimeCard from './AnimeCard';
import FadeInView from './FadeInView';

interface Props {
  title: string;
  anime: Anime[];
  onSeeAll?: () => void;
  compact?: boolean;
}

export default function AnimeRow({ title, anime, onSeeAll, compact = false }: Props) {
  const { colors } = useTheme();
  if (!anime || anime.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See All →</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {anime.map((item, index) => (
          <FadeInView
            key={item.id}
            delay={Math.min(index * 35, 280)}
            offset={10}
            duration={380}
          >
            <AnimeCard anime={item} compact={compact} width={compact ? 118 : 132} />
          </FadeInView>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
});
