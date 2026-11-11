import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { spacing, borderRadius } from '../theme';

const BASE = 'https://zyverse.in';

export default function WebScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDiwali } = useTheme();
  const tint = isDiwali ? '#f59e0b' : colors.primary;

  const path: string | undefined = route.params?.path;
  const explicitUrl: string | undefined = route.params?.url;
  const title: string = route.params?.title || 'ZyniVerse';
  const initialUrl = explicitUrl || `${BASE}${path || '/'}`;

  const webRef = useRef<WebView>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const onLoadProgress = useCallback(
    ({ nativeEvent }: any) => {
      Animated.timing(progress, {
        toValue: nativeEvent.progress,
        duration: 180,
        useNativeDriver: false,
      }).start();
    },
    [progress]
  );

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.iconText, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.host, { color: colors.textDim }]} numberOfLines={1}>
            {explicitUrl ? explicitUrl.replace(/^https?:\/\//, '') : `zyverse.in${path || '/'}`}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => Linking.openURL(initialUrl).catch(() => {})}
        >
          <Text style={[styles.iconTextSmall, { color: colors.text }]}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
        <Animated.View style={[styles.progressBar, { width: barWidth, backgroundColor: tint }]} />
      </View>

      {failed ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40 }}>📡</Text>
          <Text style={[styles.failTitle, { color: colors.text }]}>Could not load this page</Text>
          <Text style={[styles.failText, { color: colors.textMuted }]}>
            Check your connection, or open it in your browser instead.
          </Text>
          <TouchableOpacity
            style={[styles.retry, { backgroundColor: tint }]}
            onPress={() => {
              setFailed(false);
              setLoading(true);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: initialUrl }}
          style={{ flex: 1, backgroundColor: colors.background }}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onLoadProgress={onLoadProgress}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: false }).start();
          }}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={tint} size="large" />
            </View>
          )}
          startInLoadingState
        />
      )}

      {/* Bottom toolbar */}
      <View
        style={[
          styles.toolbar,
          {
            paddingBottom: insets.bottom + 8,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.toolBtn}
          disabled={!canGoBack}
          onPress={() => webRef.current?.goBack()}
        >
          <Text style={[styles.toolText, { color: canGoBack ? colors.text : colors.textDim }]}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => webRef.current?.reload()}>
          <Text style={[styles.toolText, { color: colors.text }]}>⟳ Reload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.toolText, { color: tint }]}>✕ Close</Text>
        </TouchableOpacity>
      </View>

      {loading && !failed && (
        <View pointerEvents="none" style={[styles.loadingPill, { backgroundColor: `${tint}22`, borderColor: tint }]}>
          <Text style={[styles.loadingPillText, { color: tint }]}>Loading…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 24, lineHeight: 26, marginTop: -2 },
  iconTextSmall: { fontSize: 17, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '800' },
  host: { fontSize: 10, marginTop: 1 },
  progressTrack: { height: 2, width: '100%' },
  progressBar: { height: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  failTitle: { fontSize: 16, fontWeight: '800' },
  failText: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  retry: { marginTop: 8, borderRadius: borderRadius.md, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#0b0b10', fontSize: 12, fontWeight: '900' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  toolText: { fontSize: 12, fontWeight: '700' },
  loadingPill: {
    position: 'absolute',
    top: 96,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  loadingPillText: { fontSize: 10, fontWeight: '800' },
});
