import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeConfig {
  primary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  notification: string;
  accent?: string;
  secondary?: string;
}

/**
 * 🌌 ZyniVerse Cyberpunk Dark Theme (Official Signature Design)
 * Electric Cyan (#00ffe0), Deep Neon Purple (#7000ff), and Hot Magenta (#ff00e6)
 */
export const DEFAULT_THEME: ThemeConfig = {
  primary: '#00ffe0',
  secondary: '#7000ff',
  accent: '#ff00e6',
  background: '#08090f',
  surface: '#121422',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  border: '#1e2438',
  notification: '#00ffe0',
};

/**
 * ✨ Aurora Launch Theme (Official launch skin)
 * Deep space navy with electric cyan, orbital blue and soft violet light.
 * Replaces the former seasonal festival skin with a clean, year-round-safe look.
 */
export const LAUNCH_THEME: ThemeConfig = {
  primary: '#22d3ee',
  secondary: '#8b5cf6',
  accent: '#f0abfc',
  background: '#050b16',
  surface: '#0f172a',
  text: '#f0f9ff',
  textMuted: '#7dd3fc',
  border: '#1e3a5a',
  notification: '#22d3ee',
};

/** Cool light trails shared by the Aurora launch glow overlay. */
export const LAUNCH_GLOW_COLORS = ['#22d3ee', '#60a5fa', '#a78bfa', '#f0abfc'] as const;

/**
 * 🎄 Christmas Anime Wonderland (icy blue, snow white & neon pink)
 *
 * Seasonal skin, not a rebrand: the dark base and the pink/cyan signature stay
 * intact, only the accents shift to a frozen winter palette.
 */
export const CHRISTMAS_THEME: ThemeConfig = {
  primary: '#7dd3fc',
  secondary: '#f472b6',
  accent: '#f8fafc',
  background: '#060b14',
  surface: '#0f1a2b',
  text: '#f0f9ff',
  textMuted: '#93c5fd',
  border: '#1e3a5f',
  notification: '#7dd3fc',
};

/**
 * 🌙 Midnight Indigo Theme (Easy on eyes for night viewing)
 */
export const NIGHT_THEME: ThemeConfig = {
  primary: '#818cf8',
  secondary: '#6366f1',
  accent: '#a78bfa',
  background: '#070b14',
  surface: '#0f172a',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  border: '#1e293b',
  notification: '#818cf8',
};

/**
 * ☀️ Clean Minimal Light Theme (Crisp, High-Contrast Modern Style)
 */
export const LIGHT_THEME: ThemeConfig = {
  primary: '#4f46e5',
  secondary: '#06b6d4',
  accent: '#ec4899',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  notification: '#4f46e5',
};

export async function storeTheme(key: string, theme: ThemeConfig): Promise<void> {
  try {
    const serialized = JSON.stringify(theme);
    await AsyncStorage.setItem(key, serialized);
  } catch {
    /* ignore */
  }
}

export async function loadStoredThemeByKey(key: string): Promise<ThemeConfig> {
  try {
    const serialized = await AsyncStorage.getItem(key);
    if (serialized) {
      return JSON.parse(serialized) as ThemeConfig;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export async function forceSetTheme(themeKey: string, theme: ThemeConfig): Promise<boolean> {
  try {
    await storeTheme(themeKey, theme);
    return true;
  } catch {
    return false;
  }
}

export function getThemeName(theme: ThemeConfig): string {
  if (theme.primary === CHRISTMAS_THEME.primary) return 'Christmas';
  if (theme.primary === LAUNCH_THEME.primary) return 'Aurora Launch';
  if (theme.primary === NIGHT_THEME.primary) return 'Night';
  if (theme.primary === LIGHT_THEME.primary) return 'Light';
  return 'Cyberpunk Dark';
}

/** Launch skin window: the whole of November (local time). */
export function isLaunchWindow(date = new Date()): boolean {
  return date.getMonth() === 10;
}

/** Seasonal window for the Christmas skin: 1–25 December (local time). */
export function isChristmasWindow(date = new Date()): boolean {
  return date.getMonth() === 11 && date.getDate() >= 1 && date.getDate() <= 25;
}

/** Milliseconds until 00:00 on 26 December, or 0 when the window is closed. */
export function msUntilChristmasEnds(date = new Date()): number {
  if (!isChristmasWindow(date)) return 0;
  const end = new Date(date.getFullYear(), 11, 26, 0, 0, 0, 0);
  return Math.max(0, end.getTime() - date.getTime());
}
