import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import {
  checkForUpdate,
  downloadUpdate,
  getReadyUpdate,
  installUpdate,
  skipVersion,
  openInstallPermissionSettings,
  currentVersionCode,
  currentVersionName,
  formatBytes,
  DownloadedUpdate,
  UpdateRelease,
} from '../services/updater';

export default function UpdateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [release, setRelease] = useState<UpdateRelease | null>(null);
  const [ready, setReady] = useState<DownloadedUpdate | null>(null);
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const existing = await getReadyUpdate();
      setReady(existing);
      const latest = await checkForUpdate();
      setRelease(latest);
    } catch (e: any) {
      setError(e?.message || 'Could not check for updates.');
    } finally {
      setChecking(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const startDownload = async () => {
    if (!release || downloading) return;
    setDownloading(true);
    setError(null);
    setProgress(0);
    try {
      const result = await downloadUpdate(release, (state) => {
        setProgress(state.progress);
        setBytes(state.bytes);
        setTotalBytes(state.totalBytes);
      });
      setReady(result);
    } catch (e: any) {
      setError(e?.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const install = async () => {
    if (!ready?.uri) return;
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

  const skip = async () => {
    if (!release) return;
    await skipVersion(release.latestVersionCode);
    navigation.goBack();
  };

  const updateAvailable = !!release?.updateAvailable && !ready;
  const hasReady = !!ready;
  const installedCode = currentVersionCode();
  const installedName = currentVersionName();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="App Update" emoji="⬆️" subtitle="Install new versions in-app" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Installed build */}
        <FadeInView delay={0}>
          <View
            style={[
              styles.hero,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.heroGlow, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={styles.heroEmoji}>📱</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroKicker, { color: colors.textMuted }]}>INSTALLED</Text>
              <Text style={[styles.heroVersion, { color: colors.text }]}>
                ZyniVerse {installedName}
              </Text>
              <Text style={[styles.heroSub, { color: colors.textDim }]}>
                Build {installedCode || '—'}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: `${hasReady || updateAvailable ? '#22c55e' : colors.primary}1f` },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: hasReady || updateAvailable ? '#22c55e' : colors.primary },
                ]}
              >
                {hasReady ? 'READY' : updateAvailable ? 'NEW' : checking ? '…' : 'CURRENT'}
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* Latest release */}
        <FadeInView delay={60}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {checking ? (
              <View style={styles.centerRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.muted, { color: colors.textMuted }]}>Checking for updates…</Text>
              </View>
            ) : !release ? (
              <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Could not reach the server</Text>
                <Text style={[styles.muted, { color: colors.textMuted }]}>
                  Check your connection and try again. Your current build keeps working.
                </Text>
              </View>
            ) : (
              <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {hasReady
                    ? `Version ${release.latestVersionName} is ready`
                    : release.updateAvailable
                      ? `Version ${release.latestVersionName} available`
                      : 'You are up to date'}
                </Text>
                <Text style={[styles.muted, { color: colors.textMuted }]}>
                  {hasReady
                    ? 'Tap Install to open Android’s installer. Your data and lists stay intact.'
                    : release.updateAvailable
                      ? 'Download it here — no browser, no Play Store.'
                      : `Latest release is ${release.latestVersionName}. We will let you know when something new ships.`}
                </Text>

                {!!release.notes?.length && (
                  <View style={styles.notes}>
                    {release.notes.map((note) => (
                      <View key={note} style={styles.noteRow}>
                        <Text style={[styles.noteDot, { color: colors.primary }]}>•</Text>
                        <Text style={[styles.noteText, { color: colors.text }]}>{note}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </FadeInView>

        {/* Progress */}
        {(downloading || (progress > 0 && progress < 1)) && (
          <FadeInView delay={100}>
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Downloading update…</Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                {Math.round(progress * 100)}%
                {totalBytes > 0 ? ` · ${formatBytes(bytes)} / ${formatBytes(totalBytes)}` : ''}
              </Text>
            </View>
          </FadeInView>
        )}

        {!!error && (
          <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text>
        )}

        {/* Actions */}
        <FadeInView delay={140} style={styles.actions}>
          {hasReady ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={install}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>Install update</Text>
            </TouchableOpacity>
          ) : updateAvailable ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={startDownload}
              disabled={downloading}
              activeOpacity={0.85}
            >
              {downloading ? (
                <ActivityIndicator color="#0a0a0f" />
              ) : (
                <Text style={styles.primaryText}>
                  Download {release?.sizeBytes ? formatBytes(release.sizeBytes) : 'update'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.primary }]}
              onPress={refresh}
              disabled={checking}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryText, { color: colors.primary }]}>
                {checking ? 'Checking…' : 'Check again'}
              </Text>
            </TouchableOpacity>
          )}

          {updateAvailable && !release?.mandatory && (
            <TouchableOpacity onPress={skip} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: colors.textDim }]}>
                Skip this version
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => Linking.openURL('https://zyverse.in/download').catch(() => {})}
            style={styles.skipBtn}
          >
            <Text style={[styles.skipText, { color: colors.textDim }]}>
              Download page on zyverse.in
            </Text>
          </TouchableOpacity>
        </FadeInView>

        <Text style={[styles.footnote, { color: colors.textDim }]}>
          Updates are signed with the same key as your current app, so Android installs them
          over the top. Nothing is deleted.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroGlow: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 26 },
  heroKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroVersion: { fontSize: fontSize.lg, fontWeight: '900', marginTop: 2 },
  heroSub: { fontSize: fontSize.xs, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 6 },
  muted: { fontSize: fontSize.sm, lineHeight: 19 },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notes: { marginTop: spacing.md, gap: 6 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteDot: { fontSize: fontSize.md, lineHeight: 20, fontWeight: '900' },
  noteText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  progressFill: { height: 8, borderRadius: 4 },
  error: { fontSize: fontSize.sm, marginBottom: spacing.md, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  primaryBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryText: { color: '#0a0a0f', fontSize: fontSize.md, fontWeight: '900' },
  secondaryBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryText: { fontSize: fontSize.md, fontWeight: '800' },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  skipText: { fontSize: fontSize.xs, fontWeight: '600' },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});
