import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * Pressable with a springy "squish" feedback. The native driver keeps the
 * animation on the UI thread so it stays smooth while images are loading.
 */
export default function PressableScale({
  children,
  onPress,
  style,
  scaleTo = 0.96,
  disabled,
  accessibilityLabel,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
