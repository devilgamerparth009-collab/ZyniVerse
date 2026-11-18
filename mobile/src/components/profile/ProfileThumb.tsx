import React, { useEffect, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fontSize, themed } from '../../theme';

type Props = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  fallback?: string;
  accessibilityLabel?: string;
};

/** Small image with a visible placeholder, used for profile posters and activity art. */
export default function ProfileThumb({
  uri,
  style,
  fallback = '?',
  accessibilityLabel,
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View style={[style, styles.root]} accessibilityLabel={accessibilityLabel}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>{fallback}</Text>
        </View>
      )}
    </View>
  );
}

const styles = themed(() => ({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.textDim,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
}));
