import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type ResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';

interface Props {
  /** Tried in order: direct upstream first, cached site proxy second. */
  sources: string[];
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
  blurRadius?: number;
  /** Called after every candidate has failed or timed out. */
  onGiveUp?: () => void;
  /** Milliseconds before a silent/hanging source is treated as failed. */
  timeoutMs?: number;
  fadeDuration?: number;
  accessibilityLabel?: string;
}

const DEFAULT_TIMEOUT = 4000;

/**
 * Image that always advances to the next candidate.
 *
 * A proxy that hangs (Vercel protection, cold start, upstream stall) used to
 * leave tiles blank forever because `onError` never fired. Here a silent
 * source is abandoned after a short timeout, so the direct URL gets a chance.
 */
export default function ImageWithFallback({
  sources,
  style,
  resizeMode = 'cover',
  blurRadius,
  onGiveUp,
  timeoutMs = DEFAULT_TIMEOUT,
  fadeDuration = 220,
  accessibilityLabel,
}: Props) {
  const uniqueSources = useMemo(
    () => sources.filter((s, i, arr) => !!s && arr.indexOf(s) === i),
    [sources]
  );
  const [idx, setIdx] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(0);
  const loadedRef = useRef(false);
  const giveUpRef = useRef(onGiveUp);
  giveUpRef.current = onGiveUp;

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    activeRef.current = 0;
    loadedRef.current = false;
    setIdx(0);
    opacity.setValue(0);
    return clearTimer;
  }, [uniqueSources.join('|'), opacity]);

  const advance = () => {
    if (loadedRef.current) return;
    clearTimer();
    const next = activeRef.current + 1;
    if (next >= uniqueSources.length) {
      opacity.setValue(0);
      giveUpRef.current?.();
      return;
    }
    activeRef.current = next;
    loadedRef.current = false;
    opacity.setValue(0);
    setIdx(next);
  };

  const armTimer = () => {
    clearTimer();
    if (loadedRef.current) return;
    timer.current = setTimeout(advance, timeoutMs);
  };

  useEffect(() => {
    armTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, timeoutMs]);

  const source = uniqueSources[idx];
  if (!source) return null;

  return (
    <Animated.Image
      source={{ uri: source }}
      style={[style, { opacity }]}
      resizeMode={resizeMode}
      blurRadius={blurRadius}
      accessibilityLabel={accessibilityLabel}
      onLoad={() => {
        if (activeRef.current !== idx) return;
        loadedRef.current = true;
        clearTimer();
        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }}
      onError={advance}
    />
  );
}
