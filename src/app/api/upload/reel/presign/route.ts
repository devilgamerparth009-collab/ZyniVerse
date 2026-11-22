import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isR2Configured, r2PresignedPutUrl } from "@/lib/r2";
import { normalizeMimeType } from "@/lib/file-validation";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const BUCKET = "reels";

/**
 * Uploads land in a temporary prefix first. Only /api/upload/reel/verify may
 * promote them to a public key, after checking the actual file signatures.
 */
function buildTempPaths(userId: string, uploadId: string) {
  return {
    videoPath: `tmp/${userId}/${uploadId}/video.bin`,
    thumbPath: `tmp/${userId}/${uploadId}/thumb.bin`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileType = normalizeMimeType(body.fileType);
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
    const needThumbnail = body.needThumbnail === true;

    if (!fileName) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid file type. Use MP4, WebM, or MOV." },
        { status: 400 }
      );
    }
    if (fileSize > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 50MB." }, { status: 400 });
    }

    const uploadId = crypto.randomUUID();
    const { videoPath, thumbPath } = buildTempPaths(session.user.id, uploadId);

    if (isR2Configured()) {
      const signedUrl = await r2PresignedPutUrl(videoPath, fileType);
      const thumb = needThumbnail
        ? {
            path: thumbPath,
            signedUrl: await r2PresignedPutUrl(thumbPath, "image/jpeg"),
          }
        : null;
      return NextResponse.json({
        mode: "r2",
        uploadId,
        path: videoPath,
        signedUrl,
        thumb,
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(videoPath);

    if (error || !data) {
      console.error("[/api/upload/reel/presign] sign error:", error);
      return NextResponse.json({ error: "Failed to create upload link" }, { status: 500 });
    }

    let thumb: { path: string; token: string } | null = null;
    if (needThumbnail) {
      const { data: thumbData, error: thumbError } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(thumbPath);
      if (!thumbError && thumbData) {
        thumb = { path: thumbData.path, token: thumbData.token };
      }
    }

    return NextResponse.json({
      mode: "supabase",
      uploadId,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      thumb,
    });
  } catch (error) {
    console.error("[/api/upload/reel/presign] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
