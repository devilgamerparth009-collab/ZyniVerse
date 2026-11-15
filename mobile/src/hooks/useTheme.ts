import { useAppTheme, ThemeMode } from '../theme/ThemeContext';
import { getThemeName } from '../utils/themeUtils';

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
  };
}
