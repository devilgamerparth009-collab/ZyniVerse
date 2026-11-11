import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  emoji?: string;
  right?: React.ReactNode;
  accent?: string;
}

/**
 * Shared header used by the Fun Zone stack screens. Keeps the back button,
 * title typography and spacing identical everywhere so the new screens feel
 * like a native part of the app rather than bolted-on pages.
 */
export default function ScreenHeader({ title, subtitle, emoji, right, accent }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();
  const tint = accent || (isDiwali ? '#f59e0b' : colors.primary);

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {emoji ? `${emoji} ` : ''}
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSlot}>{right}</View>
      </View>
      <View style={[styles.accentLine, { backgroundColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 26,
    lineHeight: 28,
    marginTop: -2,
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  rightSlot: {
    minWidth: 38,
    alignItems: 'flex-end',
  },
  accentLine: {
    height: 2,
    width: 46,
    borderRadius: 2,
    marginTop: spacing.sm,
    opacity: 0.9,
  },
});
