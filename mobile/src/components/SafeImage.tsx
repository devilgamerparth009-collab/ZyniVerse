import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { mediaImageUrl } from '../services/api';
import { useTheme } from '../hooks/useTheme';

type ResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';

interface Props {
  /** Raw artwork URL. Proxied/normalised internally; may be null or malformed. */
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

/**
 * Artwork wrapper that can never leave a blank hole in the UI.
 *
 * A branded placeholder is always painted first. The image fades in only after
 * a successful load; a failed or missing URL simply leaves the placeholder in
 * place instead of hiding an image at opacity 0 forever.
 */
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
  const resolved = useMemo(() => mediaImageUrl(uri), [uri]);
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFailed(false);
    opacity.setValue(0);
  }, [resolved, opacity]);

  const onLoad = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const onError = () => {
    opacity.setValue(0);
    setFailed(true);
  };

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

      {resolved && !failed ? (
        <Animated.Image
          source={{ uri: resolved }}
          style={[StyleSheet.absoluteFillObject, imageStyle, { opacity }]}
          resizeMode={resizeMode}
          blurRadius={blurRadius}
          onLoad={onLoad}
          onError={onError}
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
