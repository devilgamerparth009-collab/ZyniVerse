import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { directImageUrl, unproxyImageUrl } from '../lib/avatar-src';
import { ProfileResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';
import SantaHat from '../components/SantaHat';

/**
 * Real AniList character artwork. Every URL was fetched and returned HTTP 200
 * on 2026-11-11 — the previous list was entirely 404s, which is why the
 * preset avatars showed as blank circles.
 */
const ANIME_AVATAR_PRESETS = [
  { name: 'Gojo', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png' },
  { name: 'Levi', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png' },
  { name: 'Luffy', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png' },
  { name: 'Killua', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg' },
  { name: 'Eren', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg' },
  { name: 'Zoro', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png' },
  { name: 'Lelouch', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b417-gVLmIJu9phcK.png' },
  { name: 'Emilia', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b88572-IzTwXEHSobRs.jpg' },
  { name: 'L', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b71-1W4panC53vfs.png' },
  { name: 'Kaneki', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b87275-mb13EWZBdbh3.png' },
  { name: 'Mikasa', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png' },
  { name: 'Reigen', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b89334-OPj1hCzvrt7X.png' },
  { name: 'Guts', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b422-XTaiTuvRohsV.png' },
  { name: 'Maomao', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b126824-MqsCncTO1qpv.png' },
  { name: 'Frieren', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b176754-PCnpqIOkjhFk.png' },
  { name: 'Kurisu', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b34470-Jw2LXZBL5R8i.png' },
  { name: 'Thorfinn', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b10138-zOPrka0ddZOR.png' },
  { name: 'Makima', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b137080-UHcynYNjb5ZU.png' },
  { name: 'Itachi', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png' },
  { name: 'Kakashi', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png' },
  { name: 'Okabe', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b35252-DY9TW6pusqeh.png' },
  { name: 'Yuuji', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127212-FVm2tD0erQ5B.png' },
  { name: 'Mai', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b127222-Jh5hhP7vZ7s1.png' },
  { name: 'Denji', url: 'https://s4.anilist.co/file/anilistcdn/character/large/b130102-FO1VHNnEnLlB.png' },
];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Absolute avatar/preset URL, using the original artwork host first.
 * Uploaded relative paths are anchored to the website origin.
 */
function avatarImageUrl(raw: string): string {
  if (!raw) return '';
  if (/^data:|^blob:/i.test(raw)) return raw;
  return directImageUrl(unproxyImageUrl(raw)) || raw;
}

/** Deterministic initials for users who never uploaded a picture. */
function initialsFor(username?: string): string {
  const name = (username || 'ZyniVerse').trim() || 'ZyniVerse';
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Stable background colour per username so the fallback never flickers. */
function initialsColor(username?: string): string {
  const palette = ['#7c3aed', '#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const key = (username || 'ZyniVerse').trim() || 'ZyniVerse';
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isChristmas } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A broken avatar URL must not leave an empty circle: fall back to initials.
  const [previewFailed, setPreviewFailed] = useState(false);

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [signature, setSignature] = useState('');
  const [avatar, setAvatar] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => {
    setPreviewFailed(false);
  }, [avatar]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Eye toggle state for passwords
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const user = await getCurrentUser();
      if (!user) {
        navigation.navigate('Login');
        return;
      }
      const profile: ProfileResponse = await api.profile.get();
      setUsername(profile.user.username);
      setBio(profile.user.bio || '');
      setSignature(profile.user.signature || '');
      setAvatar(profile.user.avatar || '');
      setBanner(profile.user.banner || '');
    } catch (e: any) {
      setError(e?.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pickImage = useCallback(
    async (source: 'library' | 'camera', target: 'avatar' | 'banner' = 'avatar') => {
      const busy = target === 'banner' ? uploadingBanner : uploading;
      if (busy) return;
      try {
        if (source === 'camera') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              'Camera permission needed',
              perm.canAskAgain
                ? 'Allow camera access to take a photo.'
                : 'Camera permission is blocked. Enable it in Android app settings, then try again.',
            );
            return;
          }
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              'Photo permission needed',
              perm.canAskAgain
                ? 'Allow photo access to choose an image.'
                : 'Photo permission is blocked. Enable it in Android app settings, then try again.',
            );
            return;
          }
        }

        const isBanner = target === 'banner';
        const pickerOpts: ImagePicker.ImagePickerOptions = {
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: isBanner ? [16, 9] : [1, 1],
          quality: 0.82,
          exif: false,
        };

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({
                ...pickerOpts,
                cameraType: isBanner ? ImagePicker.CameraType.back : ImagePicker.CameraType.front,
              })
            : await ImagePicker.launchImageLibraryAsync(pickerOpts);

        if (result.canceled) return;
        const asset = result.assets?.[0];
        if (!asset?.uri) {
          Alert.alert('No image selected', 'Please try selecting the image again.');
          return;
        }

        if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
          Alert.alert('Image too large', 'Please pick an image under 5 MB.');
          return;
        }

        const name =
          asset.fileName ||
          `${target}-${Date.now()}.${(asset.mimeType || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'}`;
        const type = asset.mimeType || (name.toLowerCase().endsWith('.png') ? 'image/png' : name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg');

        if (isBanner) setUploadingBanner(true); else setUploading(true);
        const url = await api.profile.uploadImage({ uri: asset.uri, name, type });
        if (isBanner) setBanner(url); else setAvatar(url);
        Alert.alert(isBanner ? 'Banner ready' : 'Photo ready', `Your new ${isBanner ? 'banner' : 'picture'} is set. Tap “Save Changes” to publish it.`);
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message || 'Could not upload that image. Try another one.');
      } finally {
        setUploading(false);
        setUploadingBanner(false);
      }
    },
    [uploading, uploadingBanner]
  );

  const save = async () => {
    if (saving) return;
    if (username.trim().length < 3) {
      Alert.alert('Invalid username', 'Username must be at least 3 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.profile.update({
        username: username.trim(),
        bio: bio.trim(),
        signature: signature.trim(),
        avatar: avatar.trim() || undefined,
        banner: banner.trim() || undefined,
      });
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (changingPassword) return;
    if (!currentPassword || newPassword.length < 8) {
      Alert.alert(
        'Check your passwords',
        'Enter your current password and a new password of at least 8 characters.'
      );
      return;
    }
    setChangingPassword(true);
    try {
      await api.profile.update({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Password updated', 'Use your new password next time you sign in.');
    } catch (e: any) {
      Alert.alert('Could not change password', e?.message || 'Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 108 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={0} style={styles.previewRow}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarPreview, { borderColor: themeColors.primary }]}>
              {avatar && !previewFailed ? (
                <Image
                  source={{ uri: avatarImageUrl(avatar) }}
                  style={[
                    { width: 64, height: 64, borderRadius: 32 },
                    { backgroundColor: themeColors.surface },
                  ]}
                  onError={() => setPreviewFailed(true)}
                  alt={username || 'ZyniVerse'}
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { width: 64, height: 64, borderRadius: 32, backgroundColor: initialsColor(username) },
                  ]}
                >
                  <Text style={[styles.avatarFallbackText, { color: '#fff', fontSize: 24 }]}>
                    {initialsFor(username)}
                  </Text>
                </View>
              )}
              {uploading && (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            {isChristmas && <SantaHat size={30} style={styles.previewSantaHat} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewName, { color: themeColors.text }]}>
              {username || 'Your username'}
            </Text>
            <Text style={[styles.previewHint, { color: themeColors.textDim }]}>
              Upload a photo, pick an anime avatar, or paste a URL.
            </Text>
          </View>
        </FadeInView>

        {/* Upload actions */}
        <FadeInView delay={60} style={styles.uploadRow}>
          <TouchableOpacity
            style={[styles.uploadBtn, { backgroundColor: themeColors.primary }]}
            onPress={() => pickImage('library')}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator color="#0a0a0f" />
            ) : (
              <Text style={styles.uploadBtnText}>🖼️ Gallery</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.uploadBtnOutline, { borderColor: themeColors.border }]}
            onPress={() => pickImage('camera')}
            disabled={uploading}
            activeOpacity={0.85}
          >
            <Text style={[styles.uploadBtnOutlineText, { color: themeColors.text }]}>📷 Camera</Text>
          </TouchableOpacity>
          {!!avatar && (
            <TouchableOpacity
              style={[styles.uploadBtnOutline, { borderColor: themeColors.border }]}
              onPress={() => setAvatar('')}
              activeOpacity={0.85}
            >
              <Text style={[styles.uploadBtnOutlineText, { color: themeColors.textMuted }]}>✕ Remove</Text>
            </TouchableOpacity>
          )}
        </FadeInView>

        <FadeInView delay={110}>
          <Text style={[styles.label, { color: themeColors.textMuted }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={themeColors.textDim}
            autoCapitalize="none"
            maxLength={30}
          />
        </FadeInView>

        <FadeInView delay={160}>
          <Text style={[styles.label, { color: themeColors.textMuted }]}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell the community about yourself"
            placeholderTextColor={themeColors.textDim}
            multiline
            textAlignVertical="top"
            maxLength={300}
          />
        </FadeInView>

        <FadeInView delay={200}>
          <Text style={[styles.label, { color: themeColors.textMuted }]}>Forum Signature</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
            value={signature}
            onChangeText={setSignature}
            placeholder="Shown under your forum posts"
            placeholderTextColor={themeColors.textDim}
            maxLength={200}
          />
        </FadeInView>

        <FadeInView delay={240}>
          <Text style={[styles.label, { marginTop: 14, color: themeColors.textMuted }]}>
            Choose an Anime Avatar
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
          >
            {ANIME_AVATAR_PRESETS.map((p) => {
              const isSelected = avatar === p.url;
              return (
                <TouchableOpacity
                  key={p.name}
                  onPress={() => setAvatar(p.url)}
                  activeOpacity={0.8}
                  style={{
                    alignItems: 'center',
                    padding: 4,
                    borderRadius: 30,
                    borderWidth: 2,
                    borderColor: isSelected ? themeColors.primary : 'transparent',
                  }}
                >
                  <Image
                    source={{ uri: avatarImageUrl(p.url) }}
                    style={[
                      { width: 50, height: 50, borderRadius: 25 },
                      { backgroundColor: themeColors.surface },
                    ]}
                    alt={p.name}
                  />
                  {isChristmas && isSelected && (
                    <SantaHat size={20} style={styles.presetSantaHat} />
                  )}
                  <Text
                    style={{
                      color: isSelected ? themeColors.primary : themeColors.textMuted,
                      fontSize: 10,
                      fontWeight: '700',
                      marginTop: 4,
                    }}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </FadeInView>

        <FadeInView delay={280}>
          <Text style={[styles.label, { color: themeColors.textMuted }]}>Or Paste Custom Avatar URL</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
            value={avatar}
            onChangeText={setAvatar}
            placeholder="https://…"
            placeholderTextColor={themeColors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FadeInView>

        <FadeInView delay={320}>
          <Text style={[styles.label, { color: themeColors.textMuted }]}>Banner Image</Text>
          <View style={styles.uploadRow}>
            <TouchableOpacity
              style={[styles.uploadBtn, { backgroundColor: themeColors.primary }]}
              onPress={() => pickImage('library', 'banner')}
              disabled={uploadingBanner}
              activeOpacity={0.85}
            >
              {uploadingBanner ? <ActivityIndicator color="#0a0a0f" /> : <Text style={styles.uploadBtnText}>🖼️ Gallery</Text>}
            </TouchableOpacity>
            {!!banner && (
              <TouchableOpacity
                style={[styles.uploadBtnOutline, { borderColor: themeColors.border }]}
                onPress={() => setBanner('')}
                activeOpacity={0.85}
              >
                <Text style={[styles.uploadBtnOutlineText, { color: themeColors.textMuted }]}>✕ Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
            value={banner}
            onChangeText={setBanner}
            placeholder="Or paste banner image URL (https://…)"
            placeholderTextColor={themeColors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FadeInView>

        <FadeInView delay={360}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: themeColors.primary }, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0a0a0f" />
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </FadeInView>

        <FadeInView delay={400}>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Change Password</Text>
          <Text style={[styles.sectionHint, { color: themeColors.textDim }]}>
            Leave this alone unless you want to update your password.
          </Text>

          <Text style={[styles.label, { color: themeColors.textMuted }]}>Current Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={themeColors.textDim}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              <Text style={[styles.eyeIcon, { color: themeColors.textDim }]}>
                {showCurrentPassword ? '🙈' : '👁️'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: themeColors.textMuted }]}>New Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={themeColors.textDim}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <Text style={[styles.eyeIcon, { color: themeColors.textDim }]}>
                {showNewPassword ? '🙈' : '👁️'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.passwordButton,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              changingPassword && { opacity: 0.6 },
            ]}
            onPress={changePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator color={themeColors.text} />
            ) : (
              <Text style={[styles.passwordText, { color: themeColors.text }]}>Update Password</Text>
            )}
          </TouchableOpacity>
        </FadeInView>
      </ScrollView>

      {/* Sticky action bar: Save is always on screen, even after scrolling
          through the long form or the password section. */}
      <View
        style={[
          styles.stickyBar,
          {
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: themeColors.background,
            borderTopColor: themeColors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.stickySave,
            { backgroundColor: themeColors.primary },
            saving && { opacity: 0.6 },
          ]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#0a0a0f" />
          ) : (
            <Text style={styles.saveText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    marginRight: spacing.md,
    overflow: 'visible',
  },
  previewSantaHat: {
    position: 'absolute',
    top: -13,
    right: -9,
    transform: [{ rotate: '14deg' }],
  },
  presetSantaHat: {
    position: 'absolute',
    top: -7,
    right: 0,
    transform: [{ rotate: '14deg' }],
  },
  avatarPreview: {
    width: 68,
    height: 68,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  avatarFallback: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: colors.primary,
    fontWeight: '900',
  },
  previewName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  previewHint: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  uploadBtn: {
    flex: 1,
    minWidth: 104,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    color: '#0a0a0f',
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  uploadBtnOutline: {
    flex: 1,
    minWidth: 104,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnOutlineText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.sm,
  },
  textarea: {
    minHeight: 100,
  },
  passwordInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
  },
  stickySave: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveText: {
    color: '#0a0a0f',
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eyeButton: {
    padding: 4,
    marginLeft: spacing.sm,
  },
  eyeIcon: {
    color: colors.textDim,
    fontSize: 18,
  },
  passwordButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  passwordText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
}));
