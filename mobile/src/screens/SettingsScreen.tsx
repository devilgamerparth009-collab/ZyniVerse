import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { checkForUpdate, currentVersionName } from '../services/updater';
import FadeInView from '../components/FadeInView';
import { api, getCurrentUser } from '../services/api';
import { NotificationPrefs } from '../types';
import {
  DubLanguage,
  getPreferredDubLanguage,
  setPreferredDubLanguage,
} from '../services/prefs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../theme/ThemeContext';
import { isChristmasWindow } from '../utils/themeUtils';
import { openSafeWebUrl } from '../utils/safeLinks';

const appConfig = require('../../app.json');
const APP_VERSION = appConfig?.expo?.version ?? '1.4.1';

const openLink = (url: string) => openSafeWebUrl(url, '/');

function SettingRow({ label, value, onPress, disabled }: any) {
  const { colors: c } = useTheme();
  const content = (
    <View style={[styles.settingItem, { borderBottomColor: c.border }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {value !== undefined ? (
          <Text style={[styles.value, { color: c.textMuted }]}>
            {typeof value === 'string' ? value : ''}
          </Text>
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
    </View>
  );
  if (!onPress || disabled) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

function PrefToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: () => void;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.settingItem, { borderBottomColor: c.border }]}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.primary }}
        thumbColor="#ffffff"
        ios_backgroundColor={c.border}
      />
    </View>
  );
}

const DUB_OPTIONS: { key: DubLanguage | null; label: string }[] = [
  { key: null, label: 'Any' },
  { key: 'english', label: 'English' },
  { key: 'hindi', label: 'Hindi' },
  { key: 'tamil', label: 'Tamil' },
  { key: 'telugu', label: 'Telugu' },
];

const PREF_ROWS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'airingEnabled', label: 'Airing reminders' },
  { key: 'followEnabled', label: 'New followers' },
  { key: 'commentEnabled', label: 'Comments & activity' },
  { key: 'reviewEnabled', label: 'Reviews' },
  { key: 'eventEnabled', label: 'Events & contests' },
  { key: 'systemEnabled', label: 'System updates' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { selectedThemeKey: themeMode, selectTheme, colors: themeColors } = useTheme();

  // The version comes from the installed APK itself (expo-application), never
  // from a stale OTA runtime string — that mismatch is why Settings used to
  // show 1.2.0 / 1.4.1 on a 1.5.0 build.
  const installedVersion = currentVersionName() || APP_VERSION;
  const [updateLabel, setUpdateLabel] = useState('Check for updates');

  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [dubLanguage, setDub] = useState<DubLanguage | null>(null);

  const load = useCallback(async () => {
    const user = await getCurrentUser().catch(() => null);
    setLoggedIn(!!user);
    setUsername(user?.username || '');
    if (user) {
      api.notifications.prefs.get().then(setPrefs).catch(() => setPrefs(null));
    } else {
      setPrefs(null);
    }
    setDub(await getPreferredDubLanguage());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      checkForUpdate()
        .then((release) => {
          if (!alive) return;
          if (!release) return setUpdateLabel('Check for updates');
          setUpdateLabel(
            release.updateAvailable ? `v${release.latestVersionName} ready` : 'Up to date'
          );
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [])
  );

  const handleSelectTheme = (key: ThemeMode) => {
    selectTheme(key);
  };

  const togglePref = async (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await api.notifications.prefs.update({ [key]: next[key] });
    } catch (e: any) {
      setPrefs(prefs);
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
  };

  const chooseDub = async (language: DubLanguage | null) => {
    setDub(language);
    await setPreferredDubLanguage(language);
  };

  const signOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await api.auth.logout();
          setLoggedIn(false);
          setPrefs(null);
          navigation.navigate('MainTabs');
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingTop: spacing.md }}
      >
        <FadeInView delay={0} style={styles.group}>
          <Text style={[styles.groupTitle, { color: themeColors.textMuted }]}>Account</Text>
          <View style={[styles.groupContent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            {loggedIn ? (
              <>
                <SettingRow label="Signed in as" value={`@${username}`} disabled />
                <SettingRow label="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />
                <SettingRow label="Notifications" onPress={() => navigation.navigate('Notifications')} />
              </>
            ) : (
              <SettingRow label="Sign In / Sign Up" onPress={() => navigation.navigate('Login')} />
            )}
          </View>
        </FadeInView>

        {loggedIn && prefs && (
          <FadeInView delay={60} style={styles.group}>
            <Text style={[styles.groupTitle, { color: themeColors.textMuted }]}>Notification Preferences</Text>
            <View style={[styles.groupContent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              {PREF_ROWS.map((row) => (
                <PrefToggleRow
                  key={row.key}
                  label={row.label}
                  value={!!prefs[row.key]}
                  onValueChange={() => togglePref(row.key)}
                />
              ))}
            </View>
          </FadeInView>
        )}

        <FadeInView delay={110} style={styles.group}>
          <Text style={[styles.groupTitle, { color: themeColors.textMuted }]}>Preferred Dub Language</Text>
          <View style={[styles.groupContent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.dubWrap}>
              {DUB_OPTIONS.map((opt) => {
                const active = dubLanguage === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.dubChip, active && styles.dubChipActive]}
                    onPress={() => chooseDub(opt.key)}
                  >
                    <Text style={[styles.dubText, active && styles.dubTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.dubHint}>Anime detail pages highlight the dub you pick.</Text>
            <SettingRow label="Browse Dubbed Anime" onPress={() => navigation.navigate('Dubbed')} />
          </View>
        </FadeInView>

        <FadeInView delay={160} style={styles.group}>
          <Text style={[styles.groupTitle, { color: themeColors.textMuted }]}>🎨 Appearance</Text>
          <View style={[styles.groupContent, { padding: spacing.md }]}>
            <Text style={styles.themeLabel}>Theme</Text>
            <View style={styles.themeGrid}>
              {([
                { key: 'default', label: '🌆 Cyberpunk', desc: 'Neon cyan & purple', accent: '#00ffe0', bg: '#08090f' },
                {
                  key: 'christmas',
                  label: '🎄 Christmas',
                  desc: isChristmasWindow() ? 'Seasonal · live now' : 'Snow, ice & neon pink',
                  accent: '#7dd3fc',
                  bg: '#060b14',
                },
                { key: 'launch', label: '✨ Aurora Launch', desc: 'Electric cyan & violet glow', accent: '#22d3ee', bg: '#050b16' },
                { key: 'night', label: '🌙 Midnight', desc: 'Deep indigo & slate', accent: '#818cf8', bg: '#070b14' },
                { key: 'light', label: '☀️ Minimal Light', desc: 'Crisp clean slate', accent: '#4f46e5', bg: '#f8fafc' },
              ] as { key: ThemeMode; label: string; desc: string; accent: string; bg: string }[]).map(t => {
                const active = themeMode === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.themeCard, active && styles.themeCardActive, { borderColor: active ? t.accent : themeColors.border, backgroundColor: themeColors.background }]}
                    onPress={() => handleSelectTheme(t.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.themePreview, { backgroundColor: t.bg }]}>
                      <View style={[styles.themeAccentDot, { backgroundColor: t.accent }]} />
                    </View>
                    <Text style={[styles.themeCardLabel, { color: themeColors.text }, active && { color: t.accent }]}>{t.label}</Text>
                    <Text style={[styles.themeCardDesc, { color: themeColors.textMuted }]}>{t.desc}</Text>
                    {active && <Text style={[styles.themeActive, { color: t.accent }]}>✓ Active</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.themeHint}>✨ Theme is applied instantly across the entire app!</Text>
          </View>
        </FadeInView>

        <FadeInView delay={210} style={styles.group}>
          <Text style={[styles.groupTitle, { color: themeColors.textMuted }]}>About</Text>
          <View style={[styles.groupContent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <SettingRow label="Version" value={installedVersion} disabled />
            <SettingRow
              label="App update"
              value={updateLabel}
              onPress={() => navigation.navigate('Update')}
            />
            <SettingRow label="Website" value="zyverse.in" onPress={() => openLink('https://zyverse.in')} />
            <SettingRow label="Terms of Service" onPress={() => openLink('https://zyverse.in/terms')} />
            <SettingRow label="Privacy Policy" onPress={() => openLink('https://zyverse.in/privacy')} />
          </View>
        </FadeInView>

        {loggedIn && (
          <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footer}>ZyniVerse · Made for anime fans</Text>
      </ScrollView>
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  group: {
    marginBottom: spacing.md,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  groupContent: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: colors.text,
    fontSize: fontSize.md,
    flex: 1,
  },
  value: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginLeft: spacing.sm,
  },
  chevron: {
    color: colors.textDim,
    fontSize: fontSize.lg,
  },
  dubWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  dubChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  dubChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dubText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  dubTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  dubHint: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  signOutButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.error,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  footer: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  // Theme picker styles
  themeLabel: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeCard: {
    width: '47%',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  themeCardActive: {
    backgroundColor: colors.surfaceLight,
  },
  themePreview: {
    height: 44,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeAccentDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  themeCardLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  themeCardDesc: {
    color: colors.textDim,
    fontSize: 11,
  },
  themeActive: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  themeHint: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  settingValue: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
}));
