import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  isR2Configured,
  r2Copy,
  r2Delete,
  r2PublicUrl,
  r2ReadPrefix,
  r2Stat,
} from "@/lib/r2";
import {
  detectUploadedMimeType,
  extensionForMimeType,
} from "@/lib/file-validation";

const BUCKET = "reels";
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_THUMB_SIZE = 5 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const THUMB_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StorageMode = "r2" | "supabase";

interface UploadBytes {
  bytes: Uint8Array;
  size: number;
  blob?: Blob;
}

function tempPaths(userId: string, uploadId: string) {
  return {
    video: `tmp/${userId}/${uploadId}/video.bin`,
    thumb: `tmp/${userId}/${uploadId}/thumb.bin`,
  };
}

function safeName(fileName: string): string {
  return (
    fileName
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/\.[a-zA-Z0-9]+$/, "")
      .slice(0, 50) || "reel"
  );
}

async function readUpload(
  path: string,
  mode: StorageMode,
  supabase: ReturnType<typeof getSupabaseAdmin> | null
): Promise<UploadBytes | null> {
  if (mode === "r2") {
    const [stat, prefix] = await Promise.all([r2Stat(path), r2ReadPrefix(path)]);
    if (!stat || !prefix) return null;
    return { bytes: prefix, size: stat.size };
  }

  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return {
    bytes: new Uint8Array(await data.slice(0, 16).arrayBuffer()),
    size: data.size,
    blob: data,
  };
}

async function removeObjects(
  paths: string[],
  mode: StorageMode,
  supabase: ReturnType<typeof getSupabaseAdmin> | null
) {
  try {
    if (mode === "r2") {
      await Promise.all(paths.map((key) => r2Delete(key).catch(() => undefined)));
    } else if (supabase) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch {
    // Cleanup is best-effort; never turn a cleanup failure into a 500.
  }
}

async function publishUpload(
  source: string,
  destination: string,
  contentType: string,
  upload: UploadBytes,
  mode: StorageMode,
  supabase: ReturnType<typeof getSupabaseAdmin> | null
): Promise<string> {
  if (mode === "r2") {
    await r2Copy(source, destination, contentType);
    return r2PublicUrl(destination);
  }

  if (!supabase || !upload.blob) throw new Error("Missing upload data");
  const { error } = await supabase.storage.from(BUCKET).upload(destination, upload.blob, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(destination).data.publicUrl;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const uploadId = body.uploadId;
    const fileName = typeof body.fileName === "string" ? body.fileName : "reel";
    const needThumbnail = body.needThumbnail === true;

    if (typeof uploadId !== "string" || !UPLOAD_ID.test(uploadId)) {
      return NextResponse.json({ error: "Invalid upload id" }, { status: 400 });
    }

    const mode: StorageMode = isR2Configured() ? "r2" : "supabase";
    const supabase = mode === "supabase" ? getSupabaseAdmin() : null;
    const temp = tempPaths(session.user.id, uploadId);

    const video = await readUpload(temp.video, mode, supabase);
    const videoType = video ? detectUploadedMimeType(video.bytes) : null;
    if (!video || !videoType || !VIDEO_TYPES.includes(videoType) || video.size === 0 || video.size > MAX_VIDEO_SIZE) {
      await removeObjects([temp.video, ...(needThumbnail ? [temp.thumb] : [])], mode, supabase);
      return NextResponse.json({ error: "Uploaded video is not a valid supported video" }, { status: 400 });
    }

    let thumb: UploadBytes | null = null;
    let thumbType: string | null = null;
    if (needThumbnail) {
      thumb = await readUpload(temp.thumb, mode, supabase);
      thumbType = thumb ? detectUploadedMimeType(thumb.bytes) : null;
      if (!thumb || !thumbType || !THUMB_TYPES.includes(thumbType) || thumb.size === 0 || thumb.size > MAX_THUMB_SIZE) {
        await removeObjects([temp.video, temp.thumb], mode, supabase);
        return NextResponse.json({ error: "Uploaded thumbnail is not a valid image" }, { status: 400 });
      }
    }

    const videoExt = extensionForMimeType(videoType)!;
    const finalVideoPath = `${session.user.id}/${uploadId}-${safeName(fileName)}.${videoExt}`;
    const finalThumbPath = thumbType
      ? `${session.user.id}/${uploadId}-thumb.${extensionForMimeType(thumbType)}`
      : null;

    try {
      const publicUrl = await publishUpload(
        temp.video,
        finalVideoPath,
        videoType,
        video,
        mode,
        supabase
      );

      let thumbResult: { path: string; publicUrl: string } | null = null;
      if (thumb && thumbType && finalThumbPath) {
        const thumbUrl = await publishUpload(
          temp.thumb,
          finalThumbPath,
          thumbType,
          thumb,
          mode,
          supabase
        );
        thumbResult = { path: finalThumbPath, publicUrl: thumbUrl };
      }

      return NextResponse.json({
        mode,
        path: finalVideoPath,
        publicUrl,
        thumb: thumbResult,
      });
    } catch (error) {
      console.error("[/api/upload/reel/verify] publish error:", error);
      await removeObjects(
        [finalVideoPath, ...(finalThumbPath ? [finalThumbPath] : [])],
        mode,
        supabase
      );
      return NextResponse.json({ error: "Could not publish upload" }, { status: 500 });
    } finally {
      await removeObjects(
        [temp.video, ...(needThumbnail ? [temp.thumb] : [])],
        mode,
        supabase
      );
    }
  } catch (error) {
    console.error("[/api/upload/reel/verify] error:", error);
    return NextResponse.json({ error: "Upload verification failed" }, { status: 500 });
  }
}
