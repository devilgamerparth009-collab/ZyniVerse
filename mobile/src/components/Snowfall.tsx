import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Flake = {
  start: number;
  x: number;
  size: number;
  duration: number;
  drift: number;
  opacity: number;
  glyph: string;
};

const GLYPHS = ['❄', '❅', '❆', '•'];

function buildFlakes(count: number): Flake[] {
  return Array.from({ length: count }, (_, i) => {
    const size = 8 + Math.random() * 12;
    return {
      // Seeded start so the very first frame already looks like snow, not a
      // single wave falling from the top edge.
      start: Math.random(),
      x: Math.random() * (SCREEN_W - size),
      size,
      duration: 6500 + Math.random() * 7000,
      drift: 8 + Math.random() * 18,
      opacity: 0.35 + Math.random() * 0.5,
      glyph: GLYPHS[i % GLYPHS.length],
    };
  });
}

/**
 * Lightweight snowfall overlay for the Christmas skin.
 *
 * Every flake is a single native-driven `translateY` loop, so the animation
 * keeps running on the UI thread and never blocks scrolling. The whole layer
 * is `pointerEvents="none"`, which means it can sit on top of the home screen
 * without stealing a single tap.
 */
export default function Snowfall({
  count = 22,
  color = '#e0f2fe',
}: {
  count?: number;
  color?: string;
}) {
  const flakes = useMemo(() => buildFlakes(count), [count]);
  const values = useRef(flakes.map((f) => new Animated.Value(f.start))).current;

  useEffect(() => {
    const animations = values.map((value, index) => {
      const flake = flakes[index];
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: flake.duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });

    return () => animations.forEach((a) => a.stop());
  }, [flakes, values]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flakes.map((flake, index) => {
        const progress = values[index];
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-40, SCREEN_H + 40],
        });
        const translateX = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [flake.x, flake.x + flake.drift, flake.x - flake.drift / 2],
        });
        return (
          <Animated.Text
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              fontSize: flake.size,
              color,
              opacity: flake.opacity,
              transform: [{ translateY }, { translateX }],
            }}
          >
            {flake.glyph}
          </Animated.Text>
        );
      })}
    </View>
  );
}
