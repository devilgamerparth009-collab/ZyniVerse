import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_THEME,
  DIWALI_THEME,
  CHRISTMAS_THEME,
  NIGHT_THEME,
  LIGHT_THEME,
  ThemeConfig,
  isChristmasWindow,
  storeTheme,
} from '../utils/themeUtils';
import { colors } from './index';
import { bumpThemeVersion } from './index';

export type ThemeMode = 'default' | 'diwali' | 'christmas' | 'night' | 'light';

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
  isChristmas: boolean;
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
 * Seasonal defaults for people who have never picked a theme:
 *  - November   → Diwali
 *  - 1–25 Dec   → Christmas
 * Outside those windows the signature Cyberpunk Dark theme is used, so the
 * festival skin is purely additive and expires on its own.
 */
function seasonalModeForToday(): ThemeMode | null {
  const now = new Date();
  if (isChristmasWindow(now)) return 'christmas';
  if (now.getMonth() === 10) return 'diwali';
  return null;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return (
    value === 'default' ||
    value === 'diwali' ||
    value === 'christmas' ||
    value === 'night' ||
    value === 'light'
  );
}

function resolveColors(t: ThemeConfig, mode: ThemeMode): ThemeColors {
  const isLight = mode === 'light';
  const isDiwali = mode === 'diwali';
  const isChristmas = mode === 'christmas';
  return {
    background: t.background,
    surface: t.surface,
    surfaceLight: isLight
      ? '#f1f5f9'
      : isDiwali
        ? '#261c12'
        : isChristmas
          ? '#16233a'
          : '#181b2e',
    primary: t.primary,
    primaryDark: isDiwali
      ? '#b45309'
      : isChristmas
        ? '#38bdf8'
        : isLight
          ? '#3730a3'
          : '#00cbb2',
    secondary:
      t.secondary ||
      (isDiwali ? '#ea580c' : isChristmas ? '#f472b6' : isLight ? '#06b6d4' : '#7000ff'),
    accent:
      t.accent || (isDiwali ? '#fbbf24' : isChristmas ? '#f8fafc' : isLight ? '#ec4899' : '#ff00e6'),
    text: t.text,
    textMuted: t.textMuted,
    textDim: isLight
      ? '#94a3b8'
      : isDiwali
        ? '#92400e'
        : isChristmas
          ? '#6b8cae'
          : '#64748b',
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

function themeForMode(mode: ThemeMode): ThemeConfig {
  switch (mode) {
    case 'diwali':
      return DIWALI_THEME;
    case 'christmas':
      return CHRISTMAS_THEME;
    case 'night':
      return NIGHT_THEME;
    case 'light':
      return LIGHT_THEME;
    default:
      return DEFAULT_THEME;
  }
}

/** Per-mode storage key for the cached palette (default needs no cache). */
const THEME_CONFIG_KEY: Record<Exclude<ThemeMode, 'default'>, string> = {
  diwali: 'zt_theme_config_diwali',
  christmas: 'zt_theme_config_christmas',
  night: 'zt_theme_config_night',
  light: 'zt_theme_config_light',
};

/** A seasonal skin is only valid inside its own window. */
function isSeasonalModeActive(mode: ThemeMode, date = new Date()): boolean {
  if (mode === 'christmas') return isChristmasWindow(date);
  if (mode === 'diwali') return date.getMonth() === 10;
  return true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('default');
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const modeRef = React.useRef<ThemeMode>('default');

  const applyMode = React.useCallback((next: ThemeMode) => {
    modeRef.current = next;
    setModeState(next);
    setCurrentTheme(themeForMode(next));
    syncGlobalColors(resolveColors(themeForMode(next), next));
  }, []);

  useEffect(() => {
    async function initTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_MODE_KEY);

        let selectedMode: ThemeMode | null = isThemeMode(saved) ? saved : null;
        // A saved festival skin must not survive its own window (e.g. someone
        // picked Christmas in December and reopens the app in January).
        if (selectedMode && !isSeasonalModeActive(selectedMode)) {
          await AsyncStorage.removeItem(THEME_MODE_KEY);
          selectedMode = null;
        }
        if (!selectedMode) selectedMode = seasonalModeForToday();

        applyMode(selectedMode ?? 'default');
      } catch {
        // Fallback: keep the signature theme.
      }
    }
    initTheme();
  }, [applyMode]);

  // The Christmas skin reverts to the normal ZyniVerse theme on its own once
  // 25 December is over, even if the app stays open for days.
  useEffect(() => {
    const tick = () => {
      const active = modeRef.current;
      if (active !== 'christmas' && active !== 'diwali') return;
      if (isSeasonalModeActive(active)) return;
      applyMode('default');
      AsyncStorage.setItem(THEME_MODE_KEY, 'default').catch(() => {});
    };
    const timer = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [applyMode]);

  const setTheme = async (newMode: ThemeMode) => {
    const t = themeForMode(newMode);
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, newMode);
      await Promise.all(
        (Object.keys(THEME_CONFIG_KEY) as Exclude<ThemeMode, 'default'>[]).map((key) =>
          key === newMode
            ? storeTheme(THEME_CONFIG_KEY[key], t)
            : AsyncStorage.removeItem(THEME_CONFIG_KEY[key])
        )
      );
    } catch {
      // ignore
    }

    applyMode(newMode);
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
        isChristmas: mode === 'christmas',
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
      isChristmas: false,
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
