import { useAppTheme, ThemeMode } from '../theme/ThemeContext';
import { getThemeName, isDiwaliWindow } from '../utils/themeUtils';

export function useTheme() {
  const { theme, colors, mode, setTheme, navTheme, isDiwali, isChristmas } = useAppTheme();

  const selectTheme = (key: ThemeMode) => setTheme(key);

  return {
    theme,
    colors,
    appliedTheme: navTheme,
    selectedThemeKey: mode,
    selectTheme,
    getThemeName,
    isDiwali,
    isChristmas,
    /** Diwali skin active inside its own November window (drives the firework overlay). */
    isDiwaliSeason: isDiwali && isDiwaliWindow(),
  };
}
