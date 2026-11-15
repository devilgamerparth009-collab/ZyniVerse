import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

/**
 * Pure-View Santa hat. No image asset, no extra dependency — it scales to any
 * avatar size and renders instantly, which matters because it is drawn on top
 * of every avatar preset in the picker.
 */
export default function SantaHat({
  size = 28,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const height = size * 0.78;
  return (
    <View pointerEvents="none" style={[{ width: size, height }, style]}>
      {/* Cone */}
      <View
        style={{
          position: 'absolute',
          bottom: height * 0.18,
          left: size * 0.1,
          width: size * 0.82,
          height: height * 0.7,
          backgroundColor: '#e11d48',
          borderTopLeftRadius: size * 0.5,
          borderTopRightRadius: size * 0.5,
          transform: [{ rotate: '-10deg' }],
        }}
      />
      {/* Pom-pom */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: size * 0.24,
          height: size * 0.24,
          borderRadius: size * 0.12,
          backgroundColor: '#ffffff',
        }}
      />
      {/* Fur brim */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: size,
          height: height * 0.26,
          borderRadius: size * 0.2,
          backgroundColor: '#ffffff',
        }}
      />
    </View>
  );
}
