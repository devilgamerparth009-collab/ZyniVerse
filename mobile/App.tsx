import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import AdInterstitial from './src/components/AdInterstitial';
import {
  autoPrepareUpdate,
  getReadyUpdate,
  installUpdate,
  openInstallPermissionSettings,
  remindLater,
  shouldPromptUpdate,
  UpdateRelease,
} from './src/services/updater';

function RootNavigator() {
  const { navTheme, mode, colors } = useAppTheme();
  const insets = useSafeAreaInsets();

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

  // In-app APK updater. Launch never blocks on the network: the check runs a
  // few seconds after the UI is interactive, downloads quietly, and then a
  // small floating card offers a one-tap install. Content-only changes ship
  // through /api/mobile/feed and never need this at all.
  const [release, setRelease] = useState<UpdateRelease | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const existing = await getReadyUpdate();
      // Always ask the server first: a cached APK from an older release must
      // never resurrect an update card after the user skipped it or installed
      // that version from somewhere else.
      const latest = (await autoPrepareUpdate()) || existing?.release || null;
      if (!alive || !latest?.updateAvailable) return;
      if (!(await shouldPromptUpdate(latest))) return;
      setRelease(latest);
      setBannerVisible(true);
    }, 5000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    Animated.timing(bannerAnim, {
      toValue: bannerVisible ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [bannerVisible, bannerAnim]);

  const install = async () => {
    const ready = await getReadyUpdate(release);
    if (!ready?.uri) {
      Alert.alert(
        'Update available',
        'The download is still in progress. Open Settings → App update to check its status.'
      );
      return;
    }
    const opened = await installUpdate(ready.uri);
    if (!opened) {
      Alert.alert(
        'Allow installs',
        'Android needs permission to install this update. Turn on “Allow from this source”, then tap Install again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: () => openInstallPermissionSettings() },
        ]
      );
    }
  };

  const later = async () => {
    setBannerVisible(false);
    if (release) await remindLater(release.latestVersionCode);
  };

  return (
    <View style={{ flex: 1, backgroundColor: navTheme.colors.background }}>
      <NavigationContainer ref={navigationRef} theme={navTheme as any}>
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
      <AdInterstitial />

      {release && (
        <Animated.View
          pointerEvents={bannerVisible ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: insets.bottom + 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${colors.primary}22`,
            }}
          >
            <Text style={{ fontSize: 20 }}>⬆️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 14 }}>
              ZyniVerse {release.latestVersionName} ready
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
              Installs over the top — your lists and data stay intact.
            </Text>
          </View>
          <TouchableOpacity
            onPress={install}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <Text style={{ color: '#0a0a0f', fontWeight: '900', fontSize: 12 }}>Install</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={later}
            accessibilityLabel="Remind me later"
            style={{ paddingHorizontal: 4, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.textDim, fontSize: 16, fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
