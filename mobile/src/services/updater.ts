import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { base64ToBytes, createSha256, normaliseSha256 } from './sha256';

/**
 * In-app APK updater.
 *
 * Flow (Free Fire / big-platform style):
 *   1. app launch → check the public GitHub release manifest;
 *   2. if a newer build exists, download it quietly in the background;
 *   3. once the file is ready, show a one-tap "Install update" card/sheet;
 *   4. tapping it opens Android's own installer (no Play Store, no browser).
 *
 * Both the manifest and the APK are hosted on GitHub Releases. The website is
 * no longer on the update path, so a site outage/billing block cannot stop
 * existing installs from receiving a new build. `latest/download` keeps
 * working across releases without an APK rebuild.
 *
 * Content that does not need native code (announcements, featured rows, copy)
 * is bundled with the app, so it needs no network call at all.
 */

export const GITHUB_RELEASES_URL =
  'https://github.com/devilgamerparth009-collab/ZyniVerse/releases';
const MIRROR_MANIFEST_URL = `${GITHUB_RELEASES_URL}/latest/download/version.json`;
const APK_FILE = 'ZyniVerse-update.apk';
const META_KEY = 'zv_update_meta';
const SKIPPED_KEY = 'zv_update_skipped';
/** "Remind me later" state. Separate from the permanent Skip choice. */
const PROMPT_KEY = 'zv_update_prompt';
const REMIND_LATER_MS = 24 * 60 * 60 * 1000;

export interface UpdateRelease {
  latestVersionName: string;
  latestVersionCode: number;
  minSupportedVersionCode: number;
  updateAvailable: boolean;
  /** Server explicitly asks newer interim builds to move back to this stable release. */
  rollback?: boolean;
  mandatory: boolean;
  apkUrl: string;
  sha256?: string | null;
  sizeBytes?: number | null;
  notes: string[];
  publishedAt: string;
  downloadPage?: string;
  upToDate?: boolean;
}

export interface DownloadedUpdate {
  release: UpdateRelease;
  uri: string;
  bytes: number;
  downloadedAt: number;
}

export type DownloadPhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'installing'
  | 'error';

export interface DownloadState {
  phase: DownloadPhase;
  progress: number;
  bytes: number;
  totalBytes: number;
  error?: string;
}

/** Build number baked into the installed APK (e.g. 140100). */
export function currentVersionCode(): number {
  const raw = Application.nativeBuildVersion;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** Marketing version baked into the installed APK (e.g. "1.4.1"). */
export function currentVersionName(): string {
  return Application.nativeApplicationVersion || '1.4.5';
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

function isCachedReleaseUsable(
  meta: DownloadedUpdate,
  expected?: UpdateRelease | null
): boolean {
  const cachedCode = meta.release?.latestVersionCode || 0;
  const installedCode = currentVersionCode();
  if (!cachedCode || cachedCode <= installedCode) return false;

  if (expected?.latestVersionCode && cachedCode !== expected.latestVersionCode) return false;
  if (
    expected?.latestVersionName &&
    meta.release?.latestVersionName &&
    meta.release.latestVersionName !== expected.latestVersionName
  ) {
    return false;
  }
  if (expected?.sha256 && normaliseSha256(meta.release?.sha256) !== normaliseSha256(expected.sha256)) {
    return false;
  }
  if (expected?.sizeBytes && meta.bytes && meta.bytes !== expected.sizeBytes) return false;
  return true;
}

/** Drop a cached APK that belongs to an older, replaced or already-installed release. */
async function discardStaleCachedUpdate(expected?: UpdateRelease | null): Promise<void> {
  const meta = await readJson<DownloadedUpdate>(META_KEY);
  if (meta && !isCachedReleaseUsable(meta, expected)) await clearReadyUpdate();
}

async function fetchReleaseManifest(
  url: string,
  headers: Record<string, string>
): Promise<UpdateRelease | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as UpdateRelease;
    if (!json?.latestVersionCode || typeof json?.apkUrl !== 'string' || !json.apkUrl) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the independent GitHub release mirror. Never throws: a dead host simply
 * means "no update right now", never a broken app. The website is deliberately
 * not consulted, so updater availability no longer depends on zyverse.in.
 */
export async function checkForUpdate(): Promise<UpdateRelease | null> {
  if (Platform.OS !== 'android') return null;
  const code = currentVersionCode();
  const json = await fetchReleaseManifest(MIRROR_MANIFEST_URL, {});
  if (!json) return null;

  // Only accept an older build when the server explicitly marks it as a
  // rollback. This still guards against a misconfigured deploy.
  const rollback = json.rollback === true && json.latestVersionCode < code;
  const release: UpdateRelease = {
    ...json,
    rollback,
    updateAvailable: json.latestVersionCode > code || rollback,
  };
  // A downloaded APK left by a previous release must not keep offering a
  // stale Install button after the mirror has moved on (or after the same
  // build was installed from another source).
  await discardStaleCachedUpdate(release);
  await clearUpdatePrompt(release.latestVersionCode);
  return release;
}

export async function isSkipped(versionCode: number): Promise<boolean> {
  const skipped = await readJson<number>(SKIPPED_KEY);
  return skipped === versionCode;
}

export async function skipVersion(versionCode: number): Promise<void> {
  await writeJson(SKIPPED_KEY, versionCode);
  await writeJson(PROMPT_KEY, { code: versionCode, dismissedAt: Date.now(), forever: true });
}

/**
 * "Remind me tomorrow" — the update card stays hidden for 24 hours but the
 * version is not skipped forever. Mandatory releases ignore this cooldown.
 */
export async function remindLater(versionCode: number): Promise<void> {
  await writeJson(PROMPT_KEY, { code: versionCode, dismissedAt: Date.now(), forever: false });
}

/** One central decision point so no screen can nag on every cold start. */
export async function shouldPromptUpdate(release: UpdateRelease | null): Promise<boolean> {
  if (!release?.updateAvailable || !release.latestVersionCode) return false;
  if (release.latestVersionCode <= currentVersionCode() && !release.rollback) return false;
  if (await isSkipped(release.latestVersionCode)) return false;
  if (release.mandatory) return true;

  const prompt = await readJson<{ code?: number; dismissedAt?: number; forever?: boolean }>(
    PROMPT_KEY
  );
  if (!prompt || prompt.code !== release.latestVersionCode || !prompt.dismissedAt) return true;
  if (prompt.forever) return false;
  return Date.now() - prompt.dismissedAt >= REMIND_LATER_MS;
}

/** Clear stale prompt state when a new release arrives or after an install. */
export async function clearUpdatePrompt(versionCode?: number): Promise<void> {
  const prompt = await readJson<{ code?: number }>(PROMPT_KEY);
  if (!versionCode || !prompt?.code || prompt.code !== versionCode) {
    await AsyncStorage.removeItem(PROMPT_KEY).catch(() => {});
  }
  const skipped = await readJson<number>(SKIPPED_KEY);
  if (skipped && skipped !== versionCode && versionCode) {
    await AsyncStorage.removeItem(SKIPPED_KEY).catch(() => {});
  }
}

/**
 * Bytes per read when hashing the APK. A multiple of 3 means base64 chunks
 * have no padding except the final one, and ~3 MB keeps memory flat on
 * low-end devices.
 */
const HASH_CHUNK_BYTES = 3 * 1024 * 1024;

/** Stream the file through SHA-256 and compare with the server-published hash. */
async function verifyApkSha256(
  uri: string,
  expectedHex: string,
  totalBytes: number,
  onProgress?: (fraction: number) => void
): Promise<boolean> {
  const hasher = createSha256();
  let offset = 0;
  while (offset < totalBytes) {
    const length = Math.min(HASH_CHUNK_BYTES, totalBytes - offset);
    const chunk = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    });
    if (!chunk) throw new Error('The downloaded file could not be read.');
    hasher.update(base64ToBytes(chunk));
    offset += length;
    onProgress?.(Math.min(1, offset / Math.max(1, totalBytes)));
  }
  return hasher.digest() === expectedHex;
}

/** Delete a rejected download so it can never be offered to the installer. */
async function rejectDownload(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}

export async function getReadyUpdate(
  expected?: UpdateRelease | null
): Promise<DownloadedUpdate | null> {
  const meta = await readJson<DownloadedUpdate>(META_KEY);
  if (!meta?.uri || !isCachedReleaseUsable(meta, expected)) {
    if (meta) await clearReadyUpdate();
    return null;
  }
  let actualSize = 0;
  try {
    const info = await FileSystem.getInfoAsync(meta.uri);
    if (!info.exists) {
      await clearReadyUpdate();
      return null;
    }
    actualSize = 'size' in info ? info.size || 0 : 0;
  } catch {
    await clearReadyUpdate();
    return null;
  }

  // Files cached by an older build were only size-checked. Re-verify them
  // before showing an Install button; a corrupt/tampered APK must never be
  // installed from the cached slot.
  try {
    const expectedSize = expected?.sizeBytes || meta.release?.sizeBytes || meta.bytes || 0;
    if (expectedSize > 0 && actualSize > 0 && actualSize !== expectedSize) {
      await clearReadyUpdate();
      return null;
    }
    const expectedHash = normaliseSha256(expected?.sha256 || meta.release?.sha256);
    if (expectedHash && !(await verifyApkSha256(meta.uri, expectedHash, actualSize || meta.bytes))) {
      await clearReadyUpdate();
      return null;
    }
  } catch {
    await clearReadyUpdate();
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
  if (release.latestVersionCode <= currentVersionCode() && !release.rollback) {
    await clearReadyUpdate();
    throw new Error('This version is already installed.');
  }
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

  // Security check: the website publishes the exact SHA-256 of this APK.
  // Size alone cannot detect a corrupted or substituted file, so the app now
  // verifies the hash before it ever offers the Install button.
  const expectedHash = normaliseSha256(release.sha256);
  if (release.sha256 && !expectedHash) {
    await rejectDownload(result.uri);
    throw new Error('This release has an invalid checksum. Please use the download page instead.');
  }
  if (expectedHash) {
    onProgress?.({ phase: 'verifying', progress: 1, bytes, totalBytes: bytes });
    let verified = false;
    try {
      verified = await verifyApkSha256(result.uri, expectedHash, bytes);
    } catch {
      verified = false;
    }
    if (!verified) {
      await rejectDownload(result.uri);
      throw new Error(
        'The download failed SHA-256 verification and was discarded. Please retry on a stable connection.'
      );
    }
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
      { data: 'package:app.zyniverse.mobile' }
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
  const release = await checkForUpdate();
  const ready = await getReadyUpdate(release);
  if (ready) return ready.release;

  if (!release?.updateAvailable) return null;
  // Respect both "Skip" and "Remind me later" before spending mobile data on
  // a 40 MB download the user already declined.
  if (!(await shouldPromptUpdate(release))) return null;

  try {
    await downloadUpdate(release);
    return release;
  } catch {
    // Wi-Fi may be off or the asset may not be published yet — the manual
    // update screen still shows the release notes and a retry button.
    return release;
  }
}
