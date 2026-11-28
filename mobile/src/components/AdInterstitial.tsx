import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/navigationRef';
import AdBanner from './AdBanner';

const LAST_SHOWN_KEY = 'zv_ad_interstitial_last';
const COOLDOWN_MS = 10 * 60 * 1000;
const NAVIGATIONS_BETWEEN_ADS = 5;
const CLOSE_DELAY_MS = 4000;
const AUTO_CLOSE_MS = 30000;

/** Screens where a full-screen ad would interrupt playback or a form. */
const BLOCKED_ROUTES = new Set([
  'Splash',
  'Update',
  'Login',
  'Web',
  'WatchPartyRoom',
  'ThreadDetail',
  'Chat',
]);

/**
 * Frequency-capped interstitial. It appears only after several real screen
 * changes, never on splash/video/login, and can be closed after a short delay.
 * This keeps the extra ad inventory from turning into a bad UX.
 */
export default function AdInterstitial() {
  const [visible, setVisible] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CLOSE_DELAY_MS / 1000);
  const transitions = useRef(0);
  const visibleRef = useRef(false);
  const lastRouteRef = useRef<string | null>(null);

  const closeAd = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
  }, []);

  // The navigation 'state' event also fires for non-navigation state changes.
  // Count a transition only when the actual route changes.
  useEffect(() => {
    let alive = true;

    const maybeShow = async () => {
      if (!alive || visibleRef.current) return;
      const route = navigationRef.getCurrentRoute();
      if (!route) return;
      const routeKey = `${route.name}:${String((route as any).key || '')}`;
      if (lastRouteRef.current === routeKey) return;
      lastRouteRef.current = routeKey;
      if (BLOCKED_ROUTES.has(route.name)) return;

      transitions.current += 1;
      if (transitions.current < NAVIGATIONS_BETWEEN_ADS) return;

      const lastRaw = await AsyncStorage.getItem(LAST_SHOWN_KEY).catch(() => null);
      const last = lastRaw ? Number(lastRaw) : 0;
      if (Date.now() - last < COOLDOWN_MS) return;

      transitions.current = 0;
      await AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now())).catch(() => {});
      if (!alive) return;
      visibleRef.current = true;
      setVisible(true);
    };

    const unsubscribe = navigationRef.addListener('state', maybeShow);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Timers live in their own effect: re-registering the navigation listener on
  // `visible` used to cancel them the instant the modal opened.
  useEffect(() => {
    if (!visible) return;
    setCanClose(false);
    setSecondsLeft(Math.ceil(CLOSE_DELAY_MS / 1000));
    const closeTimer = setTimeout(() => setCanClose(true), CLOSE_DELAY_MS);
    const autoTimer = setTimeout(closeAd, AUTO_CLOSE_MS);
    const countdown = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      clearTimeout(closeTimer);
      clearTimeout(autoTimer);
      clearInterval(countdown);
    };
  }, [visible, closeAd]);

  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      if (!canClose) return true;
      closeAd();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [visible, canClose, closeAd]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={() => canClose && closeAd()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.label}>SPONSORED</Text>
            <TouchableOpacity
              onPress={closeAd}
              disabled={!canClose}
              style={[styles.close, !canClose && styles.closeDisabled]}
              accessibilityLabel="Close advertisement"
            >
              <Text style={styles.closeText}>{canClose ? '✕' : '…'}</Text>
            </TouchableOpacity>
          </View>
          <AdBanner placement="sidebar" size="medium" lazy={false} onFailure={closeAd} />
          <TouchableOpacity
            onPress={closeAd}
            disabled={!canClose}
            style={[styles.continueButton, !canClose && styles.continueDisabled]}
          >
            <Text style={styles.continueText}>
              {canClose ? 'Continue to ZyniVerse' : `Please wait ${secondsLeft}s`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 4, 12, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: '#10101a',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#8b8ba7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#23233a',
  },
  closeDisabled: { opacity: 0.45 },
  closeText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  continueButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
  },
  continueDisabled: { backgroundColor: '#2d2d44' },
  continueText: { color: '#fff', fontWeight: '900', fontSize: 13 },
});
