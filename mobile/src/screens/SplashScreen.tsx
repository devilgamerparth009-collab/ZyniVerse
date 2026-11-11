import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';

const { width, height } = Dimensions.get('window');
const WORDMARK = 'ZyniVerse'.split('');

function Particle({ delay, x, y, color }: { delay: number; x: number; y: number; color: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.85, duration: 900, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -70, duration: 2200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: x, top: y, backgroundColor: color, opacity, transform: [{ translateY }, { scale }] },
      ]}
    />
  );
}

function DriftOrb({
  size,
  color,
  from,
  to,
  duration,
  delay,
  opacity,
}: {
  size: number;
  color: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  duration: number;
  delay: number;
  opacity: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
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
        opacity,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) },
        ],
      }}
    />
  );
}

const PARTICLE_COLORS = ['#00ffe0', '#7000ff', '#ff00e6', '#f59e0b', '#38bdf8'];
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  x: (Math.sin(i * 1.3) * 0.5 + 0.5) * width,
  y: (Math.cos(i * 0.9) * 0.5 + 0.5) * height,
  delay: (i * 240) % 2600,
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
}));

export default function SplashScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();
  const accent = isDiwali ? '#f59e0b' : '#00ffe0';
  const accentAlt = isDiwali ? '#ea580c' : '#ff00e6';

  const contentScale = useRef(new Animated.Value(0.94)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  const logoScale = useRef(new Animated.Value(0.2)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(-14)).current;

  const glowScale = useRef(new Animated.Value(0.5)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const ringSpin = useRef(new Animated.Value(0)).current;
  const ringSpinBack = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  // Sonar-style pulses: thin, soft rings that keep expanding from the logo.
  const pulses = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  const letterAnims = useRef(WORDMARK.map(() => new Animated.Value(0))).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(12)).current;
  const chipsOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(contentScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();

    // Sonar pulses — each ring fades in, expands and dissolves before the next
    // one starts. Staggered by a third of the duration so the rhythm is steady.
    const PULSE_MS = 2400;
    pulses.forEach((value, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * (PULSE_MS / pulses.length)),
          Animated.timing(value, {
            toValue: 1,
            duration: PULSE_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay((pulses.length - 1 - i) * (PULSE_MS / pulses.length)),
        ])
      ).start();
    });

    // Two orbit rings spinning in opposite directions carry the visible motion.
    Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    Animated.loop(
      Animated.timing(ringSpinBack, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.timing(ringOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    // Logo pop
    Animated.sequence([
      Animated.delay(360),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 75, friction: 6 }),
        Animated.spring(logoRotate, { toValue: 0, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]),
    ]).start();

    // Glow breathing
    Animated.sequence([
      Animated.delay(520),
      Animated.parallel([
        Animated.spring(glowScale, { toValue: 1.15, useNativeDriver: true, tension: 45, friction: 8 }),
        Animated.timing(glowOpacity, { toValue: 0.55, duration: 520, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(glowScale, { toValue: 1.28, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.12, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Letter-by-letter wordmark
    Animated.stagger(
      55,
      letterAnims.map((v) =>
        Animated.sequence([
          Animated.delay(680),
          Animated.spring(v, { toValue: 1, useNativeDriver: true, tension: 90, friction: 7 }),
        ])
      )
    ).start();

    Animated.sequence([
      Animated.delay(1150),
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.spring(subtitleY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(chipsOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();

    // Progress
    Animated.timing(progress, {
      toValue: 1,
      duration: 2500,
      delay: 400,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(shimmerX, { toValue: -1, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(exitScale, { toValue: 1.08, duration: 420, useNativeDriver: true }),
      ]).start(() => {
        navigation.replace('MainTabs');
      });
    }, 3050);

    return () => clearTimeout(timer);
  }, []);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-140, 140],
  });
  const haloOuterOpacity = glowOpacity.interpolate({
    inputRange: [0, 0.55],
    outputRange: [0, 0.09],
    extrapolate: 'clamp',
  });
  const haloMidOpacity = glowOpacity.interpolate({
    inputRange: [0, 0.55],
    outputRange: [0, 0.15],
    extrapolate: 'clamp',
  });
  const haloCoreOpacity = glowOpacity.interpolate({
    inputRange: [0, 0.55],
    outputRange: [0, 0.24],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          opacity: exitOpacity,
          transform: [{ scale: exitScale }],
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} translucent />

      <DriftOrb size={280} color={accent} from={{ x: -140, y: -80 }} to={{ x: 30, y: 40 }} duration={6500} delay={0} opacity={0.14} />
      <DriftOrb size={240} color={accentAlt} from={{ x: 220, y: 90 }} to={{ x: 90, y: -50 }} duration={8200} delay={200} opacity={0.13} />
      <DriftOrb size={200} color="#38bdf8" from={{ x: -40, y: height - 320 }} to={{ x: 170, y: height - 460 }} duration={7600} delay={450} opacity={0.1} />

      {PARTICLES.map((p) => (
        <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} color={p.color} />
      ))}

      <Animated.View
        style={[
          styles.content,
          { opacity: contentOpacity, transform: [{ scale: contentScale }] },
        ]}
      >
        {/* Sonar pulses */}
        {pulses.map((value, i) => (
          <Animated.View
            key={`pulse-${i}`}
            pointerEvents="none"
            style={[
              styles.pulse,
              {
                borderColor: i % 2 === 0 ? accent : accentAlt,
                opacity: value.interpolate({
                  inputRange: [0, 0.12, 1],
                  outputRange: [0, 0.5, 0],
                }),
                transform: [
                  {
                    scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.86, 2.15] }),
                  },
                ],
              },
            ]}
          />
        ))}

        {/* Soft halo: three faint circles read as a gradient, not a blob. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            styles.haloOuter,
            { backgroundColor: accent, opacity: haloOuterOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            styles.haloMid,
            { backgroundColor: accent, opacity: haloMidOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            styles.haloCore,
            { backgroundColor: accent, opacity: haloCoreOpacity, transform: [{ scale: glowScale }] },
          ]}
        />

        {/* Orbit rings — solid hairlines (Android renders dashed+radius badly)
            with a single glowing dot each so the rotation is readable. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.orbitRing,
            styles.orbitOuter,
            { borderColor: `${accentAlt}33`, opacity: ringOpacity, transform: [{ rotate: ringSpinBack.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) }] },
          ]}
        >
          <View style={[styles.orbitDot, { backgroundColor: accentAlt, shadowColor: accentAlt }]} />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.orbitRing,
            styles.orbitInner,
            { borderColor: `${accent}40`, opacity: ringOpacity, transform: [{ rotate: ringSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
          ]}
        >
          <View style={[styles.orbitDotSmall, { backgroundColor: accent, shadowColor: accent }]} />
        </Animated.View>

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              borderColor: accent,
              shadowColor: accent,
              opacity: logoOpacity,
              transform: [
                { scale: logoScale },
                {
                  rotate: logoRotate.interpolate({
                    inputRange: [-14, 0],
                    outputRange: ['-14deg', '0deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Image source={require('../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              { backgroundColor: '#ffffff', transform: [{ translateX: shimmerTranslate }, { rotate: '18deg' }] },
            ]}
          />
        </Animated.View>

        {/* Wordmark */}
        <View style={styles.wordmark}>
          {WORDMARK.map((letter, i) => (
            <Animated.Text
              key={`${letter}-${i}`}
              style={[
                styles.brandLetter,
                {
                  color: i < 4 ? colors.text : accent,
                  opacity: letterAnims[i],
                  transform: [
                    {
                      translateY: letterAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                    {
                      scale: letterAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>

        <Animated.View
          style={[
            styles.subtitleWrap,
            { opacity: subtitleOpacity, transform: [{ translateY: subtitleY }] },
          ]}
        >
          <Text style={[styles.brandSubtitle, { color: accent }]}>YOUR ANIME UNIVERSE</Text>
        </Animated.View>

        <Animated.View style={[styles.chips, { opacity: chipsOpacity }]}>
          {['TV Guide', 'Regional Dubs', 'Reels', 'Arena'].map((chip) => (
            <View key={chip} style={[styles.chip, { borderColor: `${accent}55` }]}>
              <Text style={[styles.chipText, { color: colors.textMuted }]}>{chip}</Text>
            </View>
          ))}
        </Animated.View>
      </Animated.View>

      {/* Loading bar */}
      <View style={styles.loadingWrap}>
        <View style={[styles.loadingTrack, { backgroundColor: `${accent}22` }]}>
          <Animated.View style={[styles.loadingFill, { width: barWidth, backgroundColor: accent }]} />
        </View>
        <Animated.Text style={[styles.loadingText, { color: colors.textDim, opacity: subtitleOpacity }]}>
          Waking up your universe…
        </Animated.Text>
      </View>

      <Animated.Text style={[styles.versionTag, { color: colors.textDim, opacity: subtitleOpacity }]}>
        ZyniVerse • v1.3.0
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
  },
  halo: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloOuter: { width: 360, height: 360, borderRadius: 180 },
  haloMid: { width: 250, height: 250, borderRadius: 125 },
  haloCore: { width: 168, height: 168, borderRadius: 84 },
  orbitRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  orbitOuter: { width: 258, height: 258, borderRadius: 129 },
  orbitInner: { width: 196, height: 196, borderRadius: 98 },
  orbitDot: {
    position: 'absolute',
    top: -4,
    left: 122,
    width: 8,
    height: 8,
    borderRadius: 4,
    elevation: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  orbitDotSmall: {
    position: 'absolute',
    top: -3,
    left: 91,
    width: 6,
    height: 6,
    borderRadius: 3,
    elevation: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  logoContainer: {
    width: 104,
    height: 104,
    borderRadius: 30,
    backgroundColor: '#121422',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    overflow: 'hidden',
  },
  logoImage: {
    width: 78,
    height: 78,
    borderRadius: 20,
  },
  shimmer: {
    position: 'absolute',
    top: -40,
    width: 26,
    height: 190,
    opacity: 0.22,
  },
  wordmark: {
    flexDirection: 'row',
    marginTop: 26,
  },
  brandLetter: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitleWrap: {
    marginTop: 8,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 30,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  loadingWrap: {
    position: 'absolute',
    bottom: 78,
    width: '58%',
    alignItems: 'center',
  },
  loadingTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingFill: {
    height: 3,
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 10,
  },
  versionTag: {
    position: 'absolute',
    bottom: 40,
    fontSize: 10,
    letterSpacing: 1.2,
  },
});
