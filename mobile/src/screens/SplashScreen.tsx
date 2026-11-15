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
import appConfig from '../../app.json';

const { width, height } = Dimensions.get('window');
const WORDMARK = 'ZyniVerse'.split('');
const APP_VERSION = appConfig?.expo?.version ?? '1.5.0';

/* ------------------------------------------------------------------ */
/* Manga speed lines                                                   */
/* ------------------------------------------------------------------ */

const SPEED_LINES = Array.from({ length: 22 }, (_, i) => ({
  angle: (360 / 22) * i + (i % 3) * 1.6,
  length: 96 + ((i * 37) % 120),
  width: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1,
  opacity: i % 5 === 0 ? 0.85 : i % 2 === 0 ? 0.5 : 0.3,
}));

function SpeedLines({ burst, color, colorAlt }: { burst: Animated.Value; color: string; colorAlt: string }) {
  return (
    <View pointerEvents="none" style={styles.speedLayer}>
      {SPEED_LINES.map((line, i) => (
        <Animated.View
          key={`sl-${i}`}
          style={{
            position: 'absolute',
            width: line.width,
            height: line.length,
            borderRadius: line.width,
            backgroundColor: i % 3 === 0 ? colorAlt : color,
            opacity: burst.interpolate({
              inputRange: [0, 0.12, 0.55, 1],
              outputRange: [0, line.opacity, line.opacity * 0.45, 0],
            }),
            transform: [
              { rotate: `${line.angle}deg` },
              {
                translateY: burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-70 - (i % 4) * 14, -250 - (i % 5) * 40],
                }),
              },
              {
                scaleY: burst.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.25, 1, 1.35] }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Katana slash wipe                                                   */
/* ------------------------------------------------------------------ */

function SlashBar({
  progress,
  color,
  fromLeft,
  thickness,
  offset,
}: {
  progress: Animated.Value;
  color: string;
  fromLeft: boolean;
  thickness: number;
  offset: number;
}) {
  const distance = width * 1.9;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: height * 0.34 + offset,
        left: -width * 0.5,
        width: distance,
        height: thickness,
        backgroundColor: color,
        borderRadius: thickness,
        transform: [
          { rotate: '-19deg' },
          {
            translateX: progress.interpolate({
              inputRange: [0, 0.45, 1],
              outputRange: [fromLeft ? -distance : distance, 0, fromLeft ? distance : -distance],
            }),
          },
          {
            scaleY: progress.interpolate({ inputRange: [0, 0.2, 0.5, 1], outputRange: [0.2, 1, 1, 0.2] }),
          },
        ],
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Sakura / ember sparks                                               */
/* ------------------------------------------------------------------ */

const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: ((Math.sin(i * 2.1) * 0.5 + 0.5) * 0.9 + 0.05) * width,
  y: ((Math.cos(i * 1.4) * 0.5 + 0.5) * 0.85 + 0.05) * height,
  size: 3 + (i % 4),
  delay: (i * 190) % 2200,
  drift: (i % 2 === 0 ? 1 : -1) * (18 + (i % 5) * 9),
  duration: 2600 + (i % 5) * 420,
}));

function Spark({
  spark,
  color,
  colorAlt,
}: {
  spark: (typeof SPARKS)[number];
  color: string;
  colorAlt: string;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spark.delay),
        Animated.timing(t, { toValue: 1, duration: spark.duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, spark.delay, spark.duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: spark.x,
        top: spark.y,
        width: spark.size,
        height: spark.size,
        borderRadius: spark.id % 3 === 0 ? 1 : spark.size / 2,
        backgroundColor: spark.id % 3 === 0 ? colorAlt : color,
        opacity: t.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.9, 0.5, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, spark.drift] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -120 - spark.size * 8] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] }) },
        ],
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Manga halftone texture                                              */
/* ------------------------------------------------------------------ */

const HALFTONE = Array.from({ length: 30 }, (_, i) => ({
  row: Math.floor(i / 6),
  col: i % 6,
}));

function Halftone({ opacity, color }: { opacity: Animated.Value; color: string }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.halftone, { opacity }]}>
      {HALFTONE.map((dot, i) => (
        <View
          key={`ht-${i}`}
          style={{
            position: 'absolute',
            left: dot.col * 15,
            top: dot.row * 15,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: 0.55 - (dot.row + dot.col) * 0.03,
          }}
        />
      ))}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function SplashScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDiwali, isChristmas } = useTheme();
  const accent = isDiwali ? '#f59e0b' : isChristmas ? '#7dd3fc' : '#00ffe0';
  const accentAlt = isDiwali ? '#ea580c' : isChristmas ? '#f472b6' : '#ff00e6';

  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  const burst = useRef(new Animated.Value(0)).current;
  const slash = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  const logoScale = useRef(new Animated.Value(1.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const glint = useRef(new Animated.Value(-1)).current;

  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  const letterAnims = useRef(WORDMARK.map(() => new Animated.Value(0))).current;
  const episodeTag = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleRise = useRef(new Animated.Value(0)).current;
  const chipsOpacity = useRef(new Animated.Value(0)).current;
  const halftoneOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Opening slash — two blades cross the frame and leave a white flash.
    Animated.sequence([
      Animated.delay(120),
      Animated.timing(slash, { toValue: 1, duration: 780, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(380),
      Animated.timing(flash, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();

    // 2. Manga speed-line burst behind the logo.
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // 3. Impact frame: the logo overshoots, settles, then breathes.
    Animated.sequence([
      Animated.delay(420),
      Animated.timing(logoOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(430),
      Animated.timing(logoGlow, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(520),
      Animated.parallel([
        Animated.timing(ringOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 2.4, duration: 780, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(ringOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();

    // 4. Logo glint sweep, repeated while the screen is up.
    Animated.loop(
      Animated.sequence([
        Animated.delay(1150),
        Animated.timing(glint, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(glint, { toValue: -1, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    // 5. Wordmark: each letter snaps in like a title card.
    Animated.stagger(
      48,
      letterAnims.map((v) =>
        Animated.sequence([
          Animated.delay(760),
          Animated.spring(v, { toValue: 1, tension: 110, friction: 8, useNativeDriver: true }),
        ])
      )
    ).start();

    // 6. Episode tag + subtitle + chips.
    Animated.sequence([
      Animated.delay(820),
      Animated.spring(episodeTag, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(1080),
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 460, useNativeDriver: true }),
        Animated.timing(subtitleRise, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(1320),
      Animated.parallel([
        Animated.timing(chipsOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.timing(halftoneOpacity, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    ]).start();

    // 7. Loader.
    Animated.timing(progress, {
      toValue: 1,
      duration: 2500,
      delay: 380,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 8. Exit: content punches in and dissolves.
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(exitScale, { toValue: 1.06, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => navigation.replace('MainTabs'));
    }, 3050);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const glintX = glint.interpolate({ inputRange: [-1, 1], outputRange: [-190, 190] });
  const subtitleShift = subtitleRise.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const flashOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: '#05060d', opacity: exitOpacity, transform: [{ scale: exitScale }] },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#05060d" translucent />

      {/* Ambient wash */}
      <View pointerEvents="none" style={[styles.ambient, { backgroundColor: accent, top: -height * 0.22, left: -width * 0.35 }]} />
      <View pointerEvents="none" style={[styles.ambient, { backgroundColor: accentAlt, bottom: -height * 0.18, right: -width * 0.4, opacity: 0.1 }]} />

      <SpeedLines burst={burst} color={accent} colorAlt={accentAlt} />

      {SPARKS.map((spark) => (
        <Spark key={`sp-${spark.id}`} spark={spark} color={accent} colorAlt={accentAlt} />
      ))}

      <Halftone opacity={halftoneOpacity} color={accent} />

      {/* Impact flash */}
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]} />

      <SlashBar progress={slash} color={accent} fromLeft thickness={44} offset={-26} />
      <SlashBar progress={slash} color={accentAlt} fromLeft={false} thickness={20} offset={30} />

      {/* Title card */}
      <View style={styles.content}>
        <Animated.View style={{ opacity: logoGlow, transform: [{ scale: logoGlow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <View style={[styles.halo, { backgroundColor: accent, width: 260, height: 260, borderRadius: 130, opacity: 0.06 }]} />
          <View style={[styles.halo, { backgroundColor: accent, width: 170, height: 170, borderRadius: 85, opacity: 0.09 }]} />
        </Animated.View>

        {/* Impact ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.impactRing,
            {
              borderColor: accent,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.logoFrame,
            {
              borderColor: accent,
              shadowColor: accent,
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image source={require('../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glint,
              { backgroundColor: '#ffffff', transform: [{ translateX: glintX }, { rotate: '20deg' }] },
            ]}
          />
          <View pointerEvents="none" style={[styles.frameCorner, styles.cornerTL, { borderColor: accent }]} />
          <View pointerEvents="none" style={[styles.frameCorner, styles.cornerBR, { borderColor: accentAlt }]} />
        </Animated.View>

        {/* Episode tag */}
        <Animated.View
          style={[
            styles.episodeTag,
            {
              borderColor: `${accent}66`,
              opacity: episodeTag,
              transform: [{ translateY: episodeTag.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          <View style={[styles.episodeDot, { backgroundColor: accent }]} />
          <Text style={[styles.episodeText, { color: accent }]}>EP. 01 · ORIGIN</Text>
        </Animated.View>

        {/* Wordmark with chromatic echo */}
        <View style={styles.wordmarkWrap}>
          <View pointerEvents="none" style={styles.echoRow}>
            {WORDMARK.map((letter, i) => (
              <Animated.Text
                key={`echo-a-${i}`}
                style={[
                  styles.brandLetter,
                  styles.echoLetter,
                  {
                    color: accentAlt,
                    opacity: letterAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
                    transform: [
                      { translateX: -2.5 },
                      { translateY: letterAnims[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                    ],
                  },
                ]}
              >
                {letter}
              </Animated.Text>
            ))}
          </View>

          <View style={styles.wordmark}>
            {WORDMARK.map((letter, i) => (
              <Animated.Text
                key={`${letter}-${i}`}
                style={[
                  styles.brandLetter,
                  {
                    color: '#ffffff',
                    textShadowColor: accent,
                    opacity: letterAnims[i],
                    transform: [
                      {
                        translateY: letterAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [22, 0],
                        }),
                      },
                      {
                        scale: letterAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.35, 1],
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
        </View>

        <Animated.Text
          style={[
            styles.brandSubtitle,
            {
              color: accent,
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleShift }],
            },
          ]}
        >
          YOUR ANIME UNIVERSE
        </Animated.Text>

        <Animated.View style={[styles.chips, { opacity: chipsOpacity }]}>
          {['TV Guide', 'Dubs', 'Reels', 'Arena'].map((chip) => (
            <View key={chip} style={[styles.chip, { borderColor: `${accent}55` }]}>
              <Text style={[styles.chipText, { color: colors.textMuted }]}>{chip}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Loader */}
      <View style={styles.loadingWrap}>
        <View style={[styles.loadingTrack, { backgroundColor: `${accent}22` }]}>
          <Animated.View style={[styles.loadingFill, { width: barWidth, backgroundColor: accent }]} />
        </View>
        <Animated.Text style={[styles.loadingText, { color: colors.textDim, opacity: subtitleOpacity }]}>
          Summoning your universe…
        </Animated.Text>
      </View>

      <Animated.Text style={[styles.versionTag, { color: colors.textDim, opacity: subtitleOpacity }]}>
        ZyniVerse • v{APP_VERSION}
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
  ambient: {
    position: 'absolute',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    opacity: 0.16,
  },
  speedLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
  },
  halftone: {
    position: 'absolute',
    right: 18,
    bottom: 120,
    width: 90,
    height: 80,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    alignSelf: 'center',
    top: -50,
    left: -50,
  },
  impactRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
  },
  logoFrame: {
    width: 108,
    height: 108,
    borderRadius: 28,
    backgroundColor: '#0c0e18',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 26,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 26,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  glint: {
    position: 'absolute',
    top: -50,
    width: 22,
    height: 220,
    opacity: 0.28,
  },
  frameCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
  },
  cornerTL: {
    top: 6,
    left: 6,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    bottom: 6,
    right: 6,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  episodeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 22,
  },
  episodeDot: { width: 4, height: 4, borderRadius: 2 },
  episodeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  wordmarkWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  echoRow: {
    position: 'absolute',
    flexDirection: 'row',
    top: 2,
  },
  wordmark: {
    flexDirection: 'row',
  },
  brandLetter: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 0.6,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  echoLetter: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 10,
    letterSpacing: 3.2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
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
