import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { borderRadius, fontSize, spacing } from '../../theme';
import { absoluteAvatarUrl } from '../../utils/helpers';

/** Friendly sign-in prompt shared by every native social screen. */
export function SignedOutCard({ message }: { message?: string }) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={styles.bigEmoji}>🔒</Text>
      <Text style={[styles.centerTitle, { color: colors.text }]}>Sign in to continue</Text>
      <Text style={[styles.centerText, { color: colors.textMuted }]}>
        {message || 'Sign in to meet people, follow channels and share stories.'}
      </Text>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('Login')}
        accessibilityLabel="Sign in"
      >
        <Text style={styles.primaryBtnText}>Sign In / Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.centerText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={styles.bigEmoji}>📡</Text>
      <Text style={[styles.centerTitle, { color: colors.text }]}>Could not load this</Text>
      <Text style={[styles.centerText, { color: colors.textMuted }]}>{message}</Text>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={onRetry}
        accessibilityLabel="Retry"
      >
        <Text style={styles.primaryBtnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export function EmptyBlock({
  emoji = '✨',
  title,
  message,
  actionLabel,
  onAction,
}: {
  emoji?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={styles.bigEmoji}>{emoji}</Text>
      <Text style={[styles.centerTitle, { color: colors.text }]}>{title}</Text>
      {!!message && (
        <Text style={[styles.centerText, { color: colors.textMuted }]}>{message}</Text>
      )}
      {!!actionLabel && !!onAction && (
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onAction}
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.primaryBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SocialAvatar({
  name,
  uri,
  size = 46,
  ring,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  /** Ring colour used by story rows; omit for a plain avatar. */
  ring?: string;
}) {
  const { colors } = useTheme();
  const source = uri ? absoluteAvatarUrl(uri) : null;
  return (
    <View
      style={[
        styles.avatarWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ring || colors.border,
          borderWidth: ring ? 2 : 1,
        },
      ]}
    >
      {source ? (
        <Image source={{ uri: source }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }} />
      ) : (
        <View
          style={{
            width: size - 4,
            height: size - 4,
            borderRadius: (size - 4) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${colors.primary}22`,
          }}
        >
          <Text style={[styles.avatarLetter, { color: colors.primary, fontSize: size / 2.6 }]}>
            {(name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  small = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'subtle';
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        small && styles.pillSmall,
        isPrimary
          ? { backgroundColor: colors.primary }
          : { borderWidth: 1, borderColor: variant === 'outline' ? colors.primary : colors.border },
        (busy || disabled) && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isPrimary ? '#0a0a0f' : colors.text} />
      ) : (
        <Text
          style={[
            styles.pillText,
            small && styles.pillTextSmall,
            { color: isPrimary ? '#0a0a0f' : variant === 'outline' ? colors.primary : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  bigEmoji: { fontSize: 42, marginBottom: spacing.sm },
  centerTitle: { fontSize: fontSize.md, fontWeight: '800', textAlign: 'center' },
  centerText: { fontSize: fontSize.xs, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  primaryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  primaryBtnText: { color: '#0a0a0f', fontSize: fontSize.sm, fontWeight: '900' },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLetter: { fontWeight: '900' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 62,
  },
  pillSmall: { paddingHorizontal: 10, paddingVertical: 5, minWidth: 0 },
  pillText: { fontSize: fontSize.xs, fontWeight: '800' },
  pillTextSmall: { fontSize: 10 },
});
