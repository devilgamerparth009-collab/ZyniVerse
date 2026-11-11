import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

const COLORS = ['#00ffe0', '#ff00e6', '#7000ff', '#f59e0b', '#22c55e', '#22d3ee'];

interface Props {
  /** Bump this value to replay the burst. */
  trigger: number;
  count?: number;
}

function Particle({
  index,
  trigger,
  count,
}: {
  index: number;
  trigger: number;
  count: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const startX = width / 2 + (Math.random() - 0.5) * 80;
  const drift = (Math.random() - 0.5) * width * 0.9;
  const color = COLORS[index % COLORS.length];
  const size = 5 + Math.random() * 7;
  const spin = 1 + Math.random() * 4;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 900 + Math.random() * 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
      delay: (index % count) * 12,
    }).start();
  }, [trigger]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 420],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, drift],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 * spin}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: startX,
        top: 40,
        width: size,
        height: size * 1.6,
        borderRadius: 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate }],
      }}
    />
  );
}

/** Lightweight confetti burst — no extra native deps required. */
export default function Celebration({ trigger, count = 28 }: Props) {
  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <Particle key={i} index={i} trigger={trigger} count={count} />
      ))}
    </View>
  );
}
