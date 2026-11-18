import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { DIWALI_SPARK_COLORS } from '../utils/themeUtils';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Point in each spark's timeline where the rocket reaches its burst origin. */
const LAUNCH_END = 0.55;

type Spark = {
  originX: number;
  originY: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  launchDuration: number;
  burstDuration: number;
  delay: number;
};

/**
 * Builds a few small, widely spaced firework bursts. Everything is seeded once
 * with useMemo so the layout stays stable while the screen scrolls.
 */
function buildSparks(bursts: number): Spark[] {
  const sparks: Spark[] = [];
  const perBurst = 5;

  for (let burst = 0; burst < bursts; burst += 1) {
    const originX = SCREEN_W * (0.16 + Math.random() * 0.68);
    const originY = SCREEN_H * (0.16 + Math.random() * 0.34);
    const delay = Math.random() * 4000;
    const launchDuration = 1800 + Math.random() * 900;
    const burstDuration = 1600 + Math.random() * 700;

    for (let ray = 0; ray < perBurst; ray += 1) {
      sparks.push({
        originX,
        originY,
        angle: (Math.PI * 2 * ray) / perBurst + (Math.random() - 0.5) * 0.3,
        distance: 30 + Math.random() * 44,
        size: 2 + Math.random() * 2.5,
        color: DIWALI_SPARK_COLORS[ray % DIWALI_SPARK_COLORS.length],
        launchDuration,
        burstDuration,
        // A tiny offset keeps the rays from looking mechanically identical.
        delay: delay + ray * 25,
      });
    }
  }

  return sparks;
}

/**
 * Subtle Diwali firework overlay: a handful of gold/amber sparks rise, bloom
 * outward and fade. Each spark is one native-driver transform/opacity loop, so
 * the animation never runs JS work per frame and cannot intercept taps.
 */
export default function DiwaliFireworks({ bursts = 3 }: { bursts?: number }) {
  const sparks = useMemo(() => buildSparks(bursts), [bursts]);
  const progress = useRef(sparks.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = sparks.map((spark, index) => {
      const value = progress[index];
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(spark.delay),
          Animated.timing(value, {
            toValue: LAUNCH_END,
            duration: spark.launchDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: spark.burstDuration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Hidden reset (opacity is 0 at both ends), so the next burst starts
          // from the launch point instead of sliding the sparks backwards.
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

    return () => loops.forEach((loop) => loop.stop());
  }, [sparks, progress]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {sparks.map((spark, index) => {
        const value = progress[index];
        const dx = Math.cos(spark.angle) * spark.distance;
        const dy = Math.sin(spark.angle) * spark.distance;

        const translateX = value.interpolate({
          inputRange: [0, LAUNCH_END, 1],
          outputRange: [spark.originX, spark.originX, spark.originX + dx],
          extrapolate: 'clamp',
        });
        const translateY = value.interpolate({
          inputRange: [0, LAUNCH_END, 1],
          outputRange: [SCREEN_H + 24, spark.originY, spark.originY + dy],
          extrapolate: 'clamp',
        });
        const opacity = value.interpolate({
          inputRange: [0, 0.12, LAUNCH_END, 0.72, 1],
          outputRange: [0, 0.32, 0.5, 0.55, 0],
          extrapolate: 'clamp',
        });
        const scale = value.interpolate({
          inputRange: [0, LAUNCH_END, 0.72, 1],
          outputRange: [0.4, 0.8, 1, 0.2],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.spark,
              {
                width: spark.size,
                height: spark.size,
                borderRadius: spark.size / 2,
                backgroundColor: spark.color,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  spark: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
