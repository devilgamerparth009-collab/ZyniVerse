import AsyncStorage from '@react-native-async-storage/async-storage';

export type DubLanguage = 'english' | 'hindi' | 'tamil' | 'telugu';

const DUB_LANGUAGE_KEY = 'zt_pref_dub_language';
const SPOILER_KEY = 'zt_pref_hide_spoilers';

export async function getPreferredDubLanguage(): Promise<DubLanguage | null> {
  try {
    const raw = await AsyncStorage.getItem(DUB_LANGUAGE_KEY);
    if (raw === 'english' || raw === 'hindi' || raw === 'tamil' || raw === 'telugu') return raw;
    return null;
  } catch {
    return null;
  }
}

export async function setPreferredDubLanguage(language: DubLanguage | null): Promise<void> {
  try {
    if (language === null) await AsyncStorage.removeItem(DUB_LANGUAGE_KEY);
    else await AsyncStorage.setItem(DUB_LANGUAGE_KEY, language);
  } catch {
    /* non-fatal */
  }
}

export async function getHideSpoilers(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SPOILER_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setHideSpoilers(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SPOILER_KEY, value ? '1' : '0');
  } catch {
    /* non-fatal */
  }
}
