import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Milliseconds to wait before the animation starts. */
  delay?: number;
  duration?: number;
  /** Vertical travel distance in pixels. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Small entrance animation used across the app so content fades and lifts
 * into place instead of popping in. Uses the native driver, so it stays
 * smooth even while lists are loading images.
 */
export default function FadeInView({
  children,
  delay = 0,
  duration = 420,
  offset = 14,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
