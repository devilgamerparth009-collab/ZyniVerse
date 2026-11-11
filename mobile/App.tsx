import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useOTAUpdate } from './src/hooks/useOTAUpdate';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';

function RootNavigator() {
  const { navTheme, mode } = useAppTheme();
  useOTAUpdate();

  // When the theme changes, flash the new background colour once so the
  // switch is unmistakable even on screens that keep static styles.
  const flash = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 520, useNativeDriver: true }).start();
  }, [mode, flash]);

  return (
    <View style={{ flex: 1, backgroundColor: navTheme.colors.background }}>
      <NavigationContainer theme={navTheme as any}>
        <AppNavigator />
      </NavigationContainer>
      <Animated.View
        pointerEvents="none"
        style={{
          ...StyleSheetAbsoluteFill,
          backgroundColor: navTheme.colors.background,
          opacity: flash,
        }}
      />
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
