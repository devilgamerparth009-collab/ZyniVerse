import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export default function LoadingSpinner({ size = 'large', fullScreen = false }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.container,
        fullScreen && [styles.fullScreen, { backgroundColor: colors.background }],
      ]}
    >
      <ActivityIndicator size={size} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
  },
});
