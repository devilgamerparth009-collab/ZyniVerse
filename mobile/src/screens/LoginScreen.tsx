import React, { useState, useRef, useEffect } from 'react';
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
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';

type Mode = 'login' | 'signup';

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === 'login' || username.trim().length >= 3);

  /**
   * Everything happens in-app. The dedicated mobile endpoint verifies the
   * password on the server and returns an Auth.js-compatible session token,
   * which the API client stores and sends on every authenticated request.
   * No Custom Tab, no external browser, no OAuth redirect is involved.
   */
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

  const brandStyle = {
    opacity: brandAnim,
    transform: [{ translateY: brandAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
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
        </View>

        <Text style={[styles.secureNote, { color: colors.textDim }]}>
          🔒 Sign in securely with your ZyniVerse email and password — right here in the app.
        </Text>
      </ScrollView>
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
});
