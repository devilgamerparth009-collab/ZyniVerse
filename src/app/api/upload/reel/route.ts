import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isR2Configured, r2Put, r2PublicUrl } from "@/lib/r2";
import { validateUploadedFile } from "@/lib/file-validation";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const THUMB_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB — Supabase free plan storage limit
const MAX_THUMB_SIZE = 5 * 1024 * 1024;
const BUCKET = "reels";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const thumbnail = formData.get("thumbnail") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const validated = await validateUploadedFile(file, ALLOWED_TYPES, MAX_SIZE, "Video");
    if (!validated.ok) {
      return NextResponse.json(
        {
          error:
            validated.error === "Video is too large"
              ? "File too large. Max 50MB."
              : `${validated.error}. Use MP4, WebM, or MOV.`,
        },
        { status: 400 }
      );
    }
    const thumbnailValidation = thumbnail
      ? await validateUploadedFile(thumbnail, THUMB_TYPES, MAX_THUMB_SIZE, "Thumbnail")
      : null;
    if (thumbnail && (!thumbnailValidation || !thumbnailValidation.ok)) {
      return NextResponse.json(
        { error: thumbnailValidation?.error ?? "Invalid thumbnail" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const safeName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/\.[a-zA-Z0-9]+$/, "")
      .slice(0, 50);
    const path = `${session.user.id}/${timestamp}-${safeName}.${validated.extension}`;

    if (isR2Configured()) {
      await r2Put(path, Buffer.from(await file.arrayBuffer()), validated.mimeType);
      let thumbnailUrl: string | null = null;
      if (thumbnail && thumbnailValidation?.ok) {
        const thumbPath = `${session.user.id}/${timestamp}-thumb.${thumbnailValidation.extension}`;
        await r2Put(
          thumbPath,
          Buffer.from(await thumbnail.arrayBuffer()),
          thumbnailValidation.mimeType
        );
        thumbnailUrl = r2PublicUrl(thumbPath);
      }
      return NextResponse.json({
        url: r2PublicUrl(path),
        thumbnailUrl,
        fileName: file.name,
        fileSize: file.size,
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: validated.mimeType, cacheControl: '31536000' });

    if (uploadError) {
      console.error("[/api/upload/reel] Supabase error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: video } = supabase.storage.from(BUCKET).getPublicUrl(path);

    let thumbnailUrl: string | null = null;
    if (thumbnail && thumbnailValidation?.ok) {
      const thumbPath = `${session.user.id}/${timestamp}-thumb.${thumbnailValidation.extension}`;
      const { error: thumbError } = await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, thumbnail, { upsert: false, contentType: thumbnailValidation.mimeType, cacheControl: '31536000' });
      if (!thumbError) {
        const { data: t } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
        thumbnailUrl = t.publicUrl;
      }
    }

    return NextResponse.json({
      url: video.publicUrl,
      thumbnailUrl,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("[/api/upload/reel] error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
