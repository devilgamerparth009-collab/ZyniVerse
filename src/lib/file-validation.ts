/**
 * Upload validation based on file signatures, not the client-provided MIME
 * type. A browser can label any payload `image/png`; without this check that
 * payload is persisted into a public bucket with a safe-looking extension.
 */

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/x-png": "image/png",
  "video/x-m4v": "video/mp4",
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
};

// ISO-BMFF (MP4) and QuickTime use the same container signature. Accepting
// either declared type for that signature avoids rejecting valid mobile video
// recordings while still blocking a renamed image or executable.
const ISO_BMFF = new Set(["video/mp4", "video/quicktime"]);

export function normalizeMimeType(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase().split(";")[0];
  return MIME_ALIASES[normalized] ?? normalized;
}

export function extensionForMimeType(value: unknown): string | null {
  return EXTENSIONS[normalizeMimeType(value)] ?? null;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let result = "";
  for (let i = 0; i < length; i += 1) result += String.fromCharCode(bytes[offset + i] ?? 0);
  return result;
}

export function detectUploadedMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") {
    return "video/ogg";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "AVI ") {
    return "video/x-msvideo";
  }
  if (bytes.length >= 8 && ascii(bytes, 4, 4) === "ftyp") {
    return "video/mp4";
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "moov") {
    return "video/quicktime";
  }
  return null;
}

export type ValidatedUpload =
  | { ok: true; mimeType: string; extension: string }
  | { ok: false; error: string };

/**
 * Validate size, declared type and actual bytes. The returned extension and
 * MIME type must be used for storage — never `file.name` or `file.type`.
 */
export async function validateUploadedFile(
  file: File,
  allowedMimeTypes: readonly string[],
  maxSizeBytes: number,
  label = "File"
): Promise<ValidatedUpload> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    return { ok: false, error: `No ${label.toLowerCase()} provided` };
  }
  if (file.size > maxSizeBytes) {
    return { ok: false, error: `${label} is too large` };
  }

  const declared = normalizeMimeType(file.type);
  const allowed = allowedMimeTypes.map(normalizeMimeType);
  if (!declared || !allowed.includes(declared)) {
    return { ok: false, error: `Invalid ${label.toLowerCase()} type` };
  }

  let detected: string | null;
  try {
    detected = detectUploadedMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  } catch {
    return { ok: false, error: `Could not read ${label.toLowerCase()}` };
  }

  if (!detected) {
    return { ok: false, error: `${label} contents are not a recognized file type` };
  }

  const compatible =
    detected === declared ||
    (ISO_BMFF.has(detected) && ISO_BMFF.has(declared));
  if (!compatible) {
    return { ok: false, error: `${label} contents do not match its type` };
  }

  const extension = EXTENSIONS[declared];
  if (!extension) {
    return { ok: false, error: `Invalid ${label.toLowerCase()} type` };
  }
  return { ok: true, mimeType: declared, extension };
}
