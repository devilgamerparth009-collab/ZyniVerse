import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_THEME,
  DIWALI_THEME,
  NIGHT_THEME,
  LIGHT_THEME,
  ThemeConfig,
  storeTheme,
} from '../utils/themeUtils';
import { colors } from './index';
import { bumpThemeVersion } from './index';

export type ThemeMode = 'default' | 'diwali' | 'night' | 'light';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceLight: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  card: string;
  notification: string;
  tierS: string;
  tierA: string;
  tierB: string;
  tierC: string;
  tierD: string;
  tierF: string;
  watching: string;
  completed: string;
  planning: string;
  paused: string;
  dropped: string;
}

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ThemeConfig;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => Promise<void>;
  isDiwali: boolean;
  navTheme: {
    dark: boolean;
    colors: {
      primary: string;
      background: string;
      card: string;
      text: string;
      border: string;
      notification: string;
    };
    fonts: {
      regular: { fontFamily: string; fontWeight: string };
      medium: { fontFamily: string; fontWeight: string };
      bold: { fontFamily: string; fontWeight: string };
      heavy: { fontFamily: string; fontWeight: string };
    };
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Remembers the theme the user explicitly picked (as opposed to a seasonal default). */
const THEME_MODE_KEY = 'zt_theme_mode';

/**
 * Diwali lands in November, so the app dresses itself up automatically for the
 * whole month. A user who has explicitly picked a theme always wins — this is
 * only the default for people who have never chosen one.
 */
function seasonalModeForToday(): ThemeMode | null {
  const now = new Date();
  if (now.getMonth() === 10) return 'diwali';
  return null;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'default' || value === 'diwali' || value === 'night' || value === 'light';
}

function resolveColors(t: ThemeConfig, mode: ThemeMode): ThemeColors {
  const isLight = mode === 'light';
  return {
    background: t.background,
    surface: t.surface,
    surfaceLight: isLight ? '#f1f5f9' : mode === 'diwali' ? '#261c12' : '#181b2e',
    primary: t.primary,
    primaryDark: mode === 'diwali' ? '#b45309' : isLight ? '#3730a3' : '#00cbb2',
    secondary: t.secondary || (mode === 'diwali' ? '#ea580c' : isLight ? '#06b6d4' : '#7000ff'),
    accent: t.accent || (mode === 'diwali' ? '#fbbf24' : isLight ? '#ec4899' : '#ff00e6'),
    text: t.text,
    textMuted: t.textMuted,
    textDim: isLight ? '#94a3b8' : mode === 'diwali' ? '#92400e' : '#64748b',
    border: t.border,
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    card: t.surface,
    notification: t.notification,
    tierS: '#FF7F7F',
    tierA: '#FFBF7F',
    tierB: '#FFDF7F',
    tierC: '#BFFF7F',
    tierD: '#7FBFFF',
    tierF: '#BF7FFF',
    watching: '#22c55e',
    completed: '#3b82f6',
    planning: '#f59e0b',
    paused: '#94a3b8',
    dropped: '#ef4444',
  };
}

function syncGlobalColors(active: ThemeColors) {
  Object.assign(colors, active);
  bumpThemeVersion();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('default');
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(DEFAULT_THEME);

  useEffect(() => {
    async function initTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_MODE_KEY);

        let selectedMode: ThemeMode | null = isThemeMode(saved) ? saved : null;
        if (!selectedMode) selectedMode = seasonalModeForToday();

        if (!selectedMode) {
          setModeState('default');
          setCurrentTheme(DEFAULT_THEME);
          syncGlobalColors(resolveColors(DEFAULT_THEME, 'default'));
          return;
        }

        let selectedTheme: ThemeConfig = DEFAULT_THEME;
        if (selectedMode === 'diwali') selectedTheme = DIWALI_THEME;
        else if (selectedMode === 'night') selectedTheme = NIGHT_THEME;
        else if (selectedMode === 'light') selectedTheme = LIGHT_THEME;

        setModeState(selectedMode);
        setCurrentTheme(selectedTheme);
        syncGlobalColors(resolveColors(selectedTheme, selectedMode));
      } catch {
        // Fallback
      }
    }
    initTheme();
  }, []);

  const setTheme = async (newMode: ThemeMode) => {
    let t: ThemeConfig = DEFAULT_THEME;
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, newMode);
      await AsyncStorage.removeItem('zt_theme_config_diwali');
      await AsyncStorage.removeItem('zt_theme_config_night');
      await AsyncStorage.removeItem('zt_theme_config_light');

      if (newMode === 'diwali') {
        t = DIWALI_THEME;
        await storeTheme('zt_theme_config_diwali', DIWALI_THEME);
      } else if (newMode === 'night') {
        t = NIGHT_THEME;
        await storeTheme('zt_theme_config_night', NIGHT_THEME);
      } else if (newMode === 'light') {
        t = LIGHT_THEME;
        await storeTheme('zt_theme_config_light', LIGHT_THEME);
      }
    } catch {
      // ignore
    }

    setModeState(newMode);
    setCurrentTheme(t);
    syncGlobalColors(resolveColors(t, newMode));
  };

  const activeColors = resolveColors(currentTheme, mode);

  const navTheme = {
    dark: mode !== 'light',
    colors: {
      primary: activeColors.primary,
      background: activeColors.background,
      card: activeColors.surface,
      text: activeColors.text,
      border: activeColors.border,
      notification: activeColors.notification,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '900' },
    },
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        theme: currentTheme,
        colors: activeColors,
        setTheme,
        isDiwali: mode === 'diwali',
        navTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const fallback = resolveColors(DEFAULT_THEME, 'default');
    return {
      mode: 'default' as ThemeMode,
      theme: DEFAULT_THEME,
      colors: fallback,
      setTheme: async () => {},
      isDiwali: false,
      navTheme: {
        dark: true,
        colors: {
          primary: fallback.primary,
          background: fallback.background,
          card: fallback.surface,
          text: fallback.text,
          border: fallback.border,
          notification: fallback.notification,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      },
    };
  }
  return ctx;
}
