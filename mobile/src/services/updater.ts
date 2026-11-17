import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/**
 * In-app APK updater.
 *
 * Flow (Free Fire / big-platform style):
 *   1. app launch → check `/api/mobile/version` with the installed build number;
 *   2. if a newer build exists, download it quietly in the background;
 *   3. once the file is ready, show a one-tap "Install update" card/sheet;
 *   4. tapping it opens Android's own installer (no Play Store, no browser).
 *
 * Content that does not need native code (announcements, featured rows, copy)
 * is delivered separately by `/api/mobile/feed`, so those changes appear with
 * no download at all.
 */

const WEB_HOST = 'https://zyverse.in';
const APK_FILE = 'ZyniVerse-update.apk';
const META_KEY = 'zv_update_meta';
const SKIPPED_KEY = 'zv_update_skipped';

export interface UpdateRelease {
  latestVersionName: string;
  latestVersionCode: number;
  minSupportedVersionCode: number;
  updateAvailable: boolean;
  mandatory: boolean;
  apkUrl: string;
  sha256?: string | null;
  sizeBytes?: number | null;
  notes: string[];
  publishedAt: string;
  downloadPage?: string;
}

export interface DownloadedUpdate {
  release: UpdateRelease;
  uri: string;
  bytes: number;
  downloadedAt: number;
}

export type DownloadPhase = 'idle' | 'checking' | 'downloading' | 'ready' | 'installing' | 'error';

export interface DownloadState {
  phase: DownloadPhase;
  progress: number;
  bytes: number;
  totalBytes: number;
  error?: string;
}

/** Build number baked into the installed APK (e.g. 160000). */
export function currentVersionCode(): number {
  const raw = Application.nativeBuildVersion;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** Marketing version baked into the installed APK (e.g. "1.6.0"). */
export function currentVersionName(): string {
  return Application.nativeApplicationVersion || '1.7.0';
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* non-fatal */
  }
}

/** Ask the website which build is current. Never throws. */
export async function checkForUpdate(): Promise<UpdateRelease | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const code = currentVersionCode();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(
      `${WEB_HOST}/api/mobile/version?platform=android&versionCode=${code}`,
      { headers: { Accept: 'application/json' }, signal: controller.signal }
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const json = (await res.json()) as UpdateRelease;
    if (!json?.latestVersionCode || !json?.apkUrl) return null;
    // Guard against a bad deploy advertising an older build.
    return { ...json, updateAvailable: json.latestVersionCode > code };
  } catch {
    return null;
  }
}

export async function isSkipped(versionCode: number): Promise<boolean> {
  const skipped = await readJson<number>(SKIPPED_KEY);
  return skipped === versionCode;
}

export async function skipVersion(versionCode: number): Promise<void> {
  await writeJson(SKIPPED_KEY, versionCode);
}

export async function getReadyUpdate(): Promise<DownloadedUpdate | null> {
  const meta = await readJson<DownloadedUpdate>(META_KEY);
  if (!meta?.uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(meta.uri);
    if (!info.exists) return null;
  } catch {
    return null;
  }
  return meta;
}

export async function clearReadyUpdate(): Promise<void> {
  const meta = await readJson<DownloadedUpdate>(META_KEY);
  try {
    if (meta?.uri) await FileSystem.deleteAsync(meta.uri, { idempotent: true });
  } catch {
    /* ignore */
  }
  try {
    await AsyncStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Downloads the APK with progress. Safe to call twice: an existing partial
 * download is replaced so a corrupt file can never be installed.
 */
export async function downloadUpdate(
  release: UpdateRelease,
  onProgress?: (state: DownloadState) => void
): Promise<DownloadedUpdate> {
  if (Platform.OS !== 'android') throw new Error('Updates are only available on Android.');
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Storage is not available on this device.');

  const uri = base + APK_FILE;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }

  const total = release.sizeBytes || 0;
  onProgress?.({ phase: 'downloading', progress: 0, bytes: 0, totalBytes: total });

  const resumable = FileSystem.createDownloadResumable(
    release.apkUrl,
    uri,
    { headers: { Accept: 'application/vnd.android.package-archive,*/*' } },
    (data) => {
      const expected = data.totalBytesExpectedToWrite || total || 0;
      const progress = expected > 0 ? Math.min(0.99, data.totalBytesWritten / expected) : 0;
      onProgress?.({
        phase: 'downloading',
        progress,
        bytes: data.totalBytesWritten,
        totalBytes: expected,
      });
    }
  );

  const result = await resumable.downloadAsync();
  if (!result?.uri) throw new Error('Download failed. Please try again.');

  const info = await FileSystem.getInfoAsync(result.uri);
  const bytes = (info.exists && 'size' in info && info.size) || 0;
  if (bytes < 1024 * 1024) {
    // Anything under 1 MB is an error page, not an APK.
    try {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
    } catch {
      /* ignore */
    }
    throw new Error('The downloaded file looks incomplete. Please retry.');
  }

  // The server publishes the exact byte size. A dropped connection can leave a
  // truncated file that is still several MB, so check it before offering the
  // installer — a broken APK would only fail later with a cryptic parse error.
  const expectedSize = release.sizeBytes || 0;
  if (expectedSize > 0 && bytes !== expectedSize) {
    try {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
    } catch {
      /* ignore */
    }
    throw new Error(
      `The download stopped early (${Math.round(bytes / 1048576)} of ${Math.round(
        expectedSize / 1048576
      )} MB). Please retry on a stable connection.`
    );
  }

  const downloaded: DownloadedUpdate = {
    release,
    uri: result.uri,
    bytes,
    downloadedAt: Date.now(),
  };
  await writeJson(META_KEY, downloaded);
  onProgress?.({ phase: 'ready', progress: 1, bytes, totalBytes: bytes });
  return downloaded;
}

/**
 * Opens Android's package installer for a downloaded APK. Returns false when
 * the user must first allow "Install unknown apps" for ZyniVerse.
 */
export async function installUpdate(uri: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const contentUri = await FileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
    return true;
  } catch {
    return false;
  }
}

/** Opens the system screen where "Install unknown apps" is toggled. */
export async function openInstallPermissionSettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      { data: 'package:app.zyverse.mobile' }
    );
  } catch {
    try {
      await IntentLauncher.startActivityAsync('android.settings.SETTINGS');
    } catch {
      /* ignore */
    }
  }
}

/**
 * Launch-time helper: checks, then downloads silently. Never prompts on its
 * own; the caller decides when to show the install card.
 */
export async function autoPrepareUpdate(): Promise<UpdateRelease | null> {
  const ready = await getReadyUpdate();
  if (ready) return ready.release;

  const release = await checkForUpdate();
  if (!release?.updateAvailable) return null;
  if (!release.mandatory && (await isSkipped(release.latestVersionCode))) return null;

  try {
    await downloadUpdate(release);
    return release;
  } catch {
    // Wi-Fi may be off or the asset may not be published yet — the manual
    // update screen still shows the release notes and a retry button.
    return release;
  }
}
