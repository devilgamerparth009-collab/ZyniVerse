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
 * 🪔 Diwali Regal Festival Theme (Luxurious Warm Amber & Royal Gold)
 * Elegant deep mahogany night with glowing warm gold and flame accents
 */
export const DIWALI_THEME: ThemeConfig = {
  primary: '#f59e0b',
  secondary: '#ea580c',
  accent: '#fbbf24',
  background: '#0c0a08',
  surface: '#1c150e',
  text: '#fef3c7',
  textMuted: '#d97706',
  border: '#382a1a',
  notification: '#f59e0b',
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
  if (theme.primary === DIWALI_THEME.primary) return 'Diwali';
  if (theme.primary === NIGHT_THEME.primary) return 'Night';
  if (theme.primary === LIGHT_THEME.primary) return 'Light';
  return 'Cyberpunk Dark';
}
