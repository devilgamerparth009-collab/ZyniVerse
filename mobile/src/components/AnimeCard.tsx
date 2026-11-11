import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { Anime } from '../types';
import { animePoster, animeTitle, formatScore, getScoreColor } from '../utils/helpers';

const SCREEN_WIDTH = Dimensions.get('window').width;
export const GRID_CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;

interface Props {
  anime: Anime;
  width?: number;
  compact?: boolean;
  showScore?: boolean;
}

export default function AnimeCard({ anime, width, compact = false, showScore = true }: Props) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const cardWidth = width ?? (compact ? 118 : GRID_CARD_WIDTH);
  const title = animeTitle(anime);
  const imageUrl = animePoster(anime);
  const score = anime.averageScore;

  const scale = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();

  return (
    <Animated.View style={{ width: cardWidth, transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={1}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => navigation.navigate('AnimeDetail', { id: anime.id, title })}
      >
        <View
          style={[
            styles.imageWrapper,
            { height: cardWidth * 1.42, backgroundColor: colors.surface },
          ]}
        >
          {imageUrl ? (
            <Animated.Image
              source={{ uri: imageUrl }}
              style={[styles.image, { opacity: imageOpacity }]}
              resizeMode="cover"
              onLoad={() =>
                Animated.timing(imageOpacity, {
                  toValue: 1,
                  duration: 320,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }).start()
              }
            />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: colors.surfaceLight }]}>
              <Text style={[styles.placeholderText, { color: colors.textDim }]}>?</Text>
            </View>
          )}
          {showScore && score ? (
            <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(score) }]}>
              <Text style={styles.scoreText}>{formatScore(score)}</Text>
            </View>
          ) : null}
          {anime.format ? (
            <View style={styles.formatBadge}>
              <Text style={[styles.formatText, { color: colors.text }]}>{anime.format}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: colors.textDim }]} numberOfLines={1}>
          {anime.episodes ? `${anime.episodes} eps` : anime.status || ''}
          {anime.seasonYear ? ` • ${anime.seasonYear}` : ''}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  imageWrapper: {
    width: '100%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 28,
  },
  scoreBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  scoreText: {
    color: '#000',
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  formatBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: 'rgba(10,10,15,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  formatText: {
    fontSize: 9,
    fontWeight: '700',
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: 8,
    lineHeight: 18,
  },
  meta: {
    fontSize: fontSize.xs,
    marginTop: 4,
  },
});
