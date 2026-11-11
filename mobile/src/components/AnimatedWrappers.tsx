/**
 * Reusable animation wrapper components for ZyniVerse.
 * Use these throughout the app for consistent, polished animations.
 */
import React, { useRef, useEffect, ReactNode } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface AnimProps {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
}

/** Fades in + slides up from below */
export function FadeSlideIn({ children, delay = 0, style }: AnimProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Scales in from center */
export function ScaleIn({ children, delay = 0, style }: AnimProps) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Pulses repeatedly — good for badges / notifications */
export function PulseBadge({ children, style }: AnimProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Slides in from the left */
export function SlideInLeft({ children, delay = 0, style }: AnimProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateX }] }, style]}>
      {children}
    </Animated.View>
  );
}

