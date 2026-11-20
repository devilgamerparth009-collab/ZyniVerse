import { useAppTheme, ThemeMode } from '../theme/ThemeContext';
import { getThemeName, isLaunchWindow } from '../utils/themeUtils';

export function useTheme() {
  const { theme, colors, mode, setTheme, navTheme, isLaunch, isChristmas } = useAppTheme();

  const selectTheme = (key: ThemeMode) => setTheme(key);

  return {
    theme,
    colors,
    appliedTheme: navTheme,
    selectedThemeKey: mode,
    selectTheme,
    getThemeName,
    isLaunch,
    isChristmas,
    /** Aurora Launch skin active inside its own November window (drives the glow overlay). */
    isLaunchSeason: isLaunch && isLaunchWindow(),
  };
}
