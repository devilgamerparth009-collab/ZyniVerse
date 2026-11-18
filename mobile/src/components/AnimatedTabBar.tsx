import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export interface AnimatedTabItem<T extends string = string> {
  key: T;
  label: string;
  emoji?: string;
  badge?: string | number;
}

interface TabRect {
  x: number;
  width: number;
  height: number;
}

/** Keeps the active label readable on both light and dark accent colours. */
function readableTextColor(hex: string): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#ffffff';
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.48 ? '#080810' : '#ffffff';
}

interface Props<T extends string> {
  tabs: readonly AnimatedTabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  tint: string;
  surface: string;
  border: string;
  muted: string;
  /** Horizontal scrolling for long tab rows. */
  scroll?: boolean;
  /** Share the available width evenly (used by short, two-tab rows). */
  equal?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

function TabButton<T extends string>({
  item,
  active,
  tint,
  surface,
  border,
  muted,
  equal,
  onPress,
  onLayout,
}: {
  item: AnimatedTabItem<T>;
  active: boolean;
  tint: string;
  surface: string;
  border: string;
  muted: string;
  equal: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const press = (to: number) => {
    scale.value = withSpring(to, { damping: 18, stiffness: 320 });
  };

  const caption = [item.emoji, item.label].filter(Boolean).join(' ');
  const text = item.badge !== undefined && item.badge !== '' ? `${caption} · ${item.badge}` : caption;

  return (
    <Animated.View onLayout={onLayout} style={[equal && styles.equalTab, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.94)}
        onPressOut={() => press(1)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={[
          styles.button,
          {
            backgroundColor: active ? 'transparent' : surface,
            borderColor: active ? tint : border,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.label, { color: active ? readableTextColor(tint) : muted }]}
        >
          {text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Shared sliding-pill tab bar. The pill is measured from the real tab layouts,
 * so it stays aligned with labelled tabs of different widths and animates on
 * every switch. Uses Reanimated, which is already configured in this app.
 */
export default function AnimatedTabBar<T extends string>({
  tabs,
  active,
  onChange,
  tint,
  surface,
  border,
  muted,
  scroll = false,
  equal = false,
  contentContainerStyle,
}: Props<T>) {
  const [rects, setRects] = useState<Record<string, TabRect>>({});
  const translateX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillHeight = useSharedValue(0);

  useEffect(() => {
    const rect = rects[active];
    if (!rect) return;
    translateX.value = withSpring(Math.max(0, rect.x), { damping: 22, stiffness: 260 });
    pillWidth.value = withTiming(rect.width, { duration: 240 });
    pillHeight.value = withTiming(rect.height, { duration: 240 });
  }, [active, rects, translateX, pillWidth, pillHeight]);

  const pillStyle = useAnimatedStyle(() => ({
    width: pillWidth.value,
    height: pillHeight.value,
    transform: [{ translateX: translateX.value }],
  }));

  const handleLayout = useCallback(
    (key: string, event: LayoutChangeEvent) => {
      const { x, width, height } = event.nativeEvent.layout;
      setRects((prev) => {
        const current = prev[key];
        if (current && current.x === x && current.width === width && current.height === height) {
          return prev;
        }
        return { ...prev, [key]: { x, width, height } };
      });
    },
    []
  );

  const content = (
    <View style={[styles.content, contentContainerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          { backgroundColor: tint, opacity: rects[active] ? 1 : 0 },
          pillStyle,
        ]}
      />
      {tabs.map((item) => (
        <TabButton
          key={item.key}
          item={item}
          active={active === item.key}
          tint={tint}
          surface={surface}
          border={border}
          muted={muted}
          equal={equal}
          onPress={() => onChange(item.key)}
          onLayout={(event) => handleLayout(item.key, event)}
        />
      ))}
    </View>
  );

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  equalTab: {
    flex: 1,
  },
  button: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
