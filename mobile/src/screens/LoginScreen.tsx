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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { GoogleLogo, GitHubLogo, DiscordLogo } from '../components/SocialIcons';

type Mode = 'login' | 'signup';
type Provider = 'google' | 'github' | 'discord';

const WEB_HOST = 'https://zyverse.in';
/** Must match `expo.scheme` in app.json. */
const OAUTH_REDIRECT = 'zyniverse://auth';

/** Reads the session cookie the website hands back on our deep link. */
function cookieFromRedirect(url: string): string | null {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(url.slice(queryIndex + 1).split('#')[0]);
  const cookie = params.get('cookie');
  return cookie && cookie.includes('session-token') ? cookie : null;
}

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
  const { colors, isDiwali } = useTheme();
  const primaryAccent = isDiwali ? '#f59e0b' : colors.primary;

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which social providers the server actually has credentials for. Assume
  // none until the server says otherwise: an unconfigured provider would send
  // people to a broken OAuth page in an external browser.
  const [available, setAvailable] = useState<Record<Provider, boolean>>({
    google: false,
    github: false,
    discord: false,
  });

  const anySocial = available.google || available.github || available.discord;

  // Social OAuth runs in the system browser (Custom Tabs) so Google/GitHub can
  // show their own consent screens without an embedded-WebView block.
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null);

  // Entrance + ambient animations
  const brandAnim = useRef(new Animated.Value(0)).current;
  const socialAnim = useRef(new Animated.Value(0)).current;
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
      Animated.timing(socialAnim, {
        toValue: 1,
        duration: 480,
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

    api.auth
      .providers()
      .then((list) => {
        setAvailable({
          google: !!list?.google,
          github: !!list?.github,
          discord: !!list?.discord,
        });
      })
      .catch(() => {});
  }, []);

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === 'login' || username.trim().length >= 3);

  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await api.auth.login(email.trim(), password);
      } else {
        await api.auth.register(email.trim(), username.trim(), password);
      }
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Opens the website's own login flow in the system browser (Custom Tabs).
   *
   * The site starts the provider handshake on its own origin, so Google and
   * GitHub see a normal browser instead of an embedded WebView (which they
   * often block). When it finishes, the site redirects to
   * `zyniverse://auth?cookie=…`; `openAuthSessionAsync` catches that and we
   * store the session cookie for the app's own API client.
   */
  const openOAuth = useCallback(
    async (provider: Provider) => {
      if (oauthBusy) return;
      if (!available[provider]) {
        setError(
          `${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not enabled on the server yet. Use email or another provider.`
        );
        return;
      }
      setError(null);
      setOauthBusy(provider);

      const startUrl = `${WEB_HOST}/login?provider=${provider}&mobile=1&redirect=${encodeURIComponent(
        OAUTH_REDIRECT
      )}&t=${Date.now()}`;

      try {
        const result = await WebBrowser.openAuthSessionAsync(startUrl, OAUTH_REDIRECT, {
          showInRecents: false,
        });

        if (result.type === 'success') {
          const cookie = cookieFromRedirect(result.url || '');
          if (!cookie) throw new Error('Sign-in did not return a session. Please try again.');

          await api.auth.setCookie(cookie);
          const user = await api.auth.current();
          if (!user) throw new Error('Could not verify the new session. Please try again.');

          navigation.goBack();
          return;
        }

        if (result.type === 'cancel' || result.type === 'dismiss') {
          setError('Sign-in was cancelled.');
        }
      } catch (e: any) {
        setError(e?.message || 'Sign-in could not complete. Please try again.');
      } finally {
        setOauthBusy(null);
      }
    },
    [available, oauthBusy, navigation]
  );

  const brandStyle = {
    opacity: brandAnim,
    transform: [{ translateY: brandAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };
  const socialStyle = {
    opacity: socialAnim,
    transform: [{ translateY: socialAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };
  const formStyle = {
    opacity: formAnim,
    transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Ambient orbs */}
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
        {/* Brand */}
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

        {/* Card */}
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

          {/* Email-first: the form is the primary path. Social buttons only
              render below it when the server actually has them configured. */}

          {/* Form */}
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

          {anySocial && (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textDim }]}>or continue with</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <Animated.View style={[styles.socialGroup, socialStyle]}>
                {available.google && (
                  <TouchableOpacity
                    style={[
                      styles.socialButton,
                      { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
                    ]}
                    onPress={() => openOAuth('google')}
                    activeOpacity={0.85}
                  >
                    <GoogleLogo size={20} />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </TouchableOpacity>
                )}

                {(available.github || available.discord) && (
                  <View style={styles.socialRow}>
                    {available.github && (
                      <TouchableOpacity
                        style={[
                          styles.socialMiniButton,
                          { backgroundColor: '#181c24', borderColor: '#30363d' },
                        ]}
                        onPress={() => openOAuth('github')}
                        activeOpacity={0.85}
                      >
                        <GitHubLogo size={18} color="#ffffff" />
                        <Text style={styles.miniButtonText}>GitHub</Text>
                      </TouchableOpacity>
                    )}

                    {available.discord && (
                      <TouchableOpacity
                        style={[
                          styles.socialMiniButton,
                          { backgroundColor: '#5865F2', borderColor: '#5865F2' },
                        ]}
                        onPress={() => openOAuth('discord')}
                        activeOpacity={0.85}
                      >
                        <DiscordLogo size={18} color="#ffffff" />
                        <Text style={styles.miniButtonText}>Discord</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Animated.View>
            </>
          )}
        </View>

        <Text style={[styles.secureNote, { color: colors.textDim }]}>
          🔒 Sign in securely with your ZyniVerse email and password
        </Text>
      </ScrollView>

      {/* OAuth runs in the system browser; this overlay just covers the wait. */}
      {oauthBusy && (
        <View style={styles.oauthOverlay}>
          <View style={[styles.oauthSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.oauthSheetIcons}>
              {oauthBusy === 'google' ? (
                <GoogleLogo size={26} />
              ) : oauthBusy === 'github' ? (
                <GitHubLogo size={26} color={colors.text} />
              ) : (
                <DiscordLogo size={26} color="#ffffff" />
              )}
            </View>
            <ActivityIndicator size="small" color={primaryAccent} />
            <Text style={[styles.oauthSheetTitle, { color: colors.text }]}>
              Finish signing in with{' '}
              {oauthBusy.charAt(0).toUpperCase() + oauthBusy.slice(1)}
            </Text>
            <Text style={[styles.oauthSheetHint, { color: colors.textMuted }]}>
              Complete the steps in the browser window, then come back here. We'll sign you in
              automatically.
            </Text>
            <TouchableOpacity
              style={[styles.oauthSheetCancel, { borderColor: colors.border }]}
              onPress={() => setOauthBusy(null)}
            >
              <Text style={[styles.oauthSheetCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  socialGroup: {
    gap: 10,
    marginBottom: 18,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    elevation: 2,
  },
  socialDisabled: {
    opacity: 0.55,
  },
  googleButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialMiniButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  miniButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  soonTag: {
    color: '#0b0b10',
    backgroundColor: '#fbbf24',
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  secureNote: {
    textAlign: 'center',
    fontSize: 10.5,
    marginTop: 18,
    letterSpacing: 0.3,
  },
  oauthOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 5, 10, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  oauthSheet: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderRadius: 22,
    borderWidth: 1,
  },
  oauthSheetIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthSheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  oauthSheetHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  oauthSheetCancel: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  oauthSheetCancelText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
