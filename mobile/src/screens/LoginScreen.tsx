import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api, WEB_HOST } from '../services/api';
import { DiscordLogo, GitHubLogo, GoogleLogo } from '../components/SocialIcons';

type Mode = 'login' | 'signup';
type Provider = 'google' | 'github' | 'discord';
const SOCIAL_PROVIDERS: Provider[] = ['google', 'github', 'discord'];

/** Floating neon orb, lifted from the website's login background. */
function Orb({
  size,
  color,
  from,
  to,
  duration,
  delay,
}: {
  size: number;
  color: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  duration: number;
  delay: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [t, duration, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: 0.16,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) },
        ],
      }}
    />
  );
}

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isLaunch } = useTheme();
  const primaryAccent = isLaunch ? '#22d3ee' : colors.primary;

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Social sign-in stays inside the app: the provider page loads in a WebView
  // and the website hands the finished session back through postMessage.
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }>>({});
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const oauthFinished = useRef(false);

  const brandAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const logoSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(brandAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.06, duration: 1600, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(logoSpin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [brandAnim, formAnim, logoPulse, logoSpin]);

  useEffect(() => {
    let alive = true;
    api.auth
      .providers()
      .then((list) => {
        if (alive) setProviders(list || {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === 'login' || username.trim().length >= 3);

  /**
   * Email/password is verified by the dedicated mobile endpoint. Everything
   * happens in-app: the returned Auth.js JWT is stored and sent as a Bearer
   * token, so no Custom Tab, external browser or OAuth redirect is involved.
   */
  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await api.auth.login(email.trim(), password, mfaRequired ? totp.trim() : undefined);
        setMfaRequired(false);
        setTotp('');
      } else {
        await api.auth.register(email.trim(), username.trim(), password);
      }
      navigation.goBack();
    } catch (e: any) {
      if (e?.mfaRequired) {
        setMfaRequired(true);
        setTotp('');
      }
      setError(e?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openSocial = useCallback(
    async (provider: Provider) => {
      if (oauthBusy || loading) return;
      setError(null);
      setOauthError(null);
      setOauthBusy(provider);
      oauthFinished.current = false;
      try {
        // The website starts Auth.js itself inside the WebView, so its CSRF and
        // callback cookies are handled by the WebView's own cookie jar. No
        // external Custom Tab, no deep link, no manual cookie forwarding.
        setOauthUrl(`${WEB_HOST}/login?provider=${provider}&mobile=1`);
      } catch (e: any) {
        setOauthBusy(null);
        setOauthError(e?.message || 'Could not start sign-in. Please try again.');
      }
    },
    [oauthBusy, loading]
  );

  const closeSocial = useCallback(() => {
    oauthFinished.current = true;
    setOauthUrl(null);
    setOauthBusy(null);
  }, []);

  const handleSocialMessage = useCallback(
    async (raw: string) => {
      if (oauthFinished.current) return;
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }
      if (data?.type !== 'zyni-auth' || typeof data.cookie !== 'string') return;
      if (!data.cookie.includes('session-token=')) return;

      oauthFinished.current = true;
      setOauthUrl(null);
      setOauthBusy(null);
      setOauthError(null);
      try {
        await api.auth.setCookie(data.cookie);
        const user = await api.auth.current();
        if (!user) throw new Error('Could not verify the social sign-in. Please try again.');
        navigation.goBack();
      } catch (e: any) {
        setError(e?.message || 'Could not finish social sign-in. Please try again.');
      }
    },
    [navigation]
  );

  const brandStyle = {
    opacity: brandAnim,
    transform: [{ translateY: brandAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };
  const formStyle = {
    opacity: formAnim,
    transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  const availableSocial = SOCIAL_PROVIDERS.filter((provider) => providers[provider]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Orb size={260} color={primaryAccent} from={{ x: -120, y: -60 }} to={{ x: 40, y: 60 }} duration={7000} delay={0} />
      <Orb size={220} color="#ff00e6" from={{ x: 220, y: 60 }} to={{ x: 120, y: -40 }} duration={9000} delay={300} />
      <Orb size={180} color="#38bdf8" from={{ x: -60, y: 460 }} to={{ x: 180, y: 380 }} duration={8000} delay={600} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.brandContainer, brandStyle]}>
          <Animated.View
            style={[
              styles.logoBorderBox,
              {
                borderColor: primaryAccent,
                shadowColor: primaryAccent,
                transform: [{ scale: logoPulse }],
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.logoHalo,
                {
                  borderColor: primaryAccent,
                  transform: [
                    {
                      rotate: logoSpin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          <Text style={[styles.brandTitle, { color: colors.text }]}>ZyniVerse</Text>
          <Text style={[styles.brandSubtitle, { color: primaryAccent }]}>
            ゼニバース • Your Anime Universe
          </Text>
        </Animated.View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardHeading, { color: colors.text }]}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={[styles.cardSubheading, { color: colors.textMuted }]}>
            {mode === 'login'
              ? 'Sign in to sync your lists, dubs, forum posts and tournaments.'
              : 'Join the community — track anime, dubs, reels and events.'}
          </Text>

          <Animated.View style={formStyle}>
            {mode === 'signup' && (
              <View style={styles.inputWrap}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Username</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Choose a username"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
            )}

            <View style={styles.inputWrap}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="name@domain.com"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Password</Text>
              <View
                style={[
                  styles.passwordRow,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: colors.text }]}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((s) => !s)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {mode === 'login' && mfaRequired && (
              <View style={styles.inputWrap}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Two-factor code</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder="6-digit authenticator code"
                  placeholderTextColor={colors.textDim}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={totp}
                  onChangeText={setTotp}
                />
                <Text style={{ marginTop: 6, fontSize: 11, color: colors.textDim }}>
                  Enter the code from your authenticator app, then sign in again.
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: primaryAccent, shadowColor: primaryAccent },
                (!canSubmit || loading) && styles.submitDisabled,
              ]}
              onPress={submit}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#08090f" size="small" />
              ) : (
                <Text style={[styles.submitButtonText, { color: '#08090f' }]}>
                  {mode === 'login' ? 'Sign In  →' : 'Create Account  →'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              style={styles.modeSwitch}
            >
              <Text style={[styles.modeSwitchText, { color: colors.textMuted }]}>
                {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
                <Text style={[styles.modeSwitchLink, { color: primaryAccent }]}>
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {availableSocial.length > 0 && (
            <View style={styles.socialBlock}>
              <View style={styles.socialDivider}>
                <View style={[styles.socialDividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.socialDividerText, { color: colors.textDim }]}>or continue with</Text>
                <View style={[styles.socialDividerLine, { backgroundColor: colors.border }]} />
              </View>
              <View style={styles.socialRow}>
                {availableSocial.map((provider) => (
                  <TouchableOpacity
                    key={provider}
                    style={[
                      styles.socialButton,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      !!oauthBusy && styles.submitDisabled,
                    ]}
                    onPress={() => void openSocial(provider)}
                    disabled={!!oauthBusy || loading}
                    activeOpacity={0.8}
                  >
                    {provider === 'google' ? (
                      <GoogleLogo size={19} />
                    ) : provider === 'github' ? (
                      <GitHubLogo size={19} color={colors.text} />
                    ) : (
                      <DiscordLogo size={19} color={colors.text} />
                    )}
                    <Text style={[styles.socialButtonText, { color: colors.text }]}>
                      {provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'Discord'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {oauthError && <Text style={styles.errorText}>⚠️ {oauthError}</Text>}
            </View>
          )}
        </View>

        <Text style={[styles.secureNote, { color: colors.textDim }]}>
          🔒 Email sign-in and social sign-in both stay in the app — no external browser.
        </Text>
      </ScrollView>

      <Modal
        visible={!!oauthUrl}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeSocial}
      >
        <View
          style={[
            styles.oauthContainer,
            { backgroundColor: colors.background, paddingTop: insets.top },
          ]}
        >
          <View style={[styles.oauthHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeSocial} style={styles.oauthClose} activeOpacity={0.8}>
              <Text style={[styles.oauthCloseText, { color: colors.text }]}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={[styles.oauthTitle, { color: colors.text }]}>
              {oauthBusy ? `Sign in with ${oauthBusy.charAt(0).toUpperCase() + oauthBusy.slice(1)}` : 'Signing in'}
            </Text>
            <View style={styles.oauthClose} />
          </View>
          {oauthUrl && (
            <WebView
              source={{ uri: oauthUrl }}
              style={[styles.oauthWebView, { backgroundColor: colors.background }]}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              startInLoadingState
              onMessage={(event) => void handleSocialMessage(event.nativeEvent.data)}
              onError={() => setOauthError('Could not load the sign-in page. Please try again.')}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoBorderBox: {
    width: 84,
    height: 84,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    backgroundColor: '#0d0e18',
    overflow: 'hidden',
  },
  logoHalo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    opacity: 0.5,
  },
  logoImage: {
    width: 62,
    height: 62,
    borderRadius: 16,
  },
  brandTitle: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    elevation: 8,
  },
  cardHeading: {
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 4,
  },
  cardSubheading: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputWrap: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorBox: {
    backgroundColor: '#3b0d0c',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modeSwitch: {
    marginTop: 18,
    alignItems: 'center',
  },
  modeSwitchText: {
    fontSize: 13,
  },
  modeSwitchLink: {
    fontWeight: '800',
  },
  socialBlock: {
    marginTop: 20,
  },
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.6,
  },
  socialDividerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialButton: {
    flexGrow: 1,
    flexBasis: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  socialButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  oauthContainer: {
    flex: 1,
  },
  oauthHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  oauthClose: {
    width: 70,
  },
  oauthCloseText: {
    fontSize: 13,
    fontWeight: '700',
  },
  oauthTitle: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  oauthWebView: {
    flex: 1,
  },
  secureNote: {
    textAlign: 'center',
    fontSize: 10.5,
    marginTop: 18,
    letterSpacing: 0.3,
  },
});
