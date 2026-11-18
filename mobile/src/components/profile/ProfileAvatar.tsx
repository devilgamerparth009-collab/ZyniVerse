import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { colors, themed } from '../../theme';
import { absoluteAvatarUrl } from '../../utils/helpers';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  accent?: string;
};

/**
 * Avatar with a permanent letter fallback. A broken remote image never leaves
 * an empty circle: the first failed URL is remembered, and a changed URL is
 * retried automatically.
 */
export default function ProfileAvatar({ uri, name, size = 64, accent }: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const resolved = uri ? absoluteAvatarUrl(uri) : '';

  useEffect(() => {
    setFailedUri(null);
  }, [resolved]);

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const showImage = !!resolved && resolved !== failedUri;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: accent || colors.primary,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: resolved }}
          style={styles.image}
          accessibilityLabel={`${name || 'User'} avatar`}
          onError={() => setFailedUri(resolved)}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={[styles.initial, { fontSize: Math.max(14, size * 0.4) }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

const styles = themed(() => ({
  container: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.primary,
    fontWeight: '900',
  },
}));
