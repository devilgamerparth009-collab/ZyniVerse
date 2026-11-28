import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { imageCandidates } from '../lib/avatar-src';
import { useTheme } from '../hooks/useTheme';
import ImageWithFallback from './ImageWithFallback';

type ResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';

interface Props {
  /** Raw artwork URL. Direct URL is tried first, cached proxy second. */
  uri?: string | null;
  /** Applies to the outer box (width, height, radius, borders, absolute fill). */
  style?: StyleProp<ViewStyle>;
  /** Extra styles for the inner image only. */
  imageStyle?: StyleProp<ImageStyle>;
  /** Short caption shown under the brand mark when artwork cannot load. */
  fallbackLabel?: string | null;
  resizeMode?: ResizeMode;
  blurRadius?: number;
  accessibilityLabel?: string;
}

/** Artwork wrapper that can never leave a blank hole in the UI. */
export default function SafeImage({
  uri,
  style,
  imageStyle,
  fallbackLabel,
  resizeMode = 'cover',
  blurRadius,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const sources = useMemo(() => imageCandidates(uri), [uri]);
  const [failed, setFailed] = useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  const label = fallbackLabel?.trim() || 'ZyniVerse';

  return (
    <View style={[styles.root, style]} accessibilityLabel={accessibilityLabel || label}>
      <View style={[styles.fallback, { backgroundColor: colors.surface }]}>
        <View style={[styles.orb, { borderColor: `${colors.primary}66` }]}>
          <Text style={[styles.brand, { color: colors.primary }]}>Z</Text>
        </View>
        <Text style={[styles.fallbackText, { color: colors.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
      </View>

      {!failed && sources.length > 0 ? (
        <ImageWithFallback
          sources={sources}
          style={[StyleSheet.absoluteFillObject, imageStyle]}
          resizeMode={resizeMode}
          blurRadius={blurRadius}
          onGiveUp={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  orb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.35)',
  },
  brand: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -1,
  },
  fallbackText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
});
