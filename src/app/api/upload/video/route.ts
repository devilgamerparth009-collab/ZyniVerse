import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isR2Configured, r2Put, r2PublicUrl } from "@/lib/r2";
import { validateUploadedFile } from "@/lib/file-validation";

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
];
const MAX_SIZE = 200 * 1024 * 1024; // 200MB
const BUCKET = "profiles";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const partyId = formData.get("partyId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const validated = await validateUploadedFile(file, ALLOWED_TYPES, MAX_SIZE, "Video");
    if (!validated.ok) {
      return NextResponse.json(
        {
          error:
            validated.error === "Video is too large"
              ? "File too large. Max 200MB."
              : `${validated.error}. Use MP4, WebM, OGG, AVI, or MOV.`,
        },
        { status: 400 }
      );
    }

    const id = partyId
      ? partyId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64)
      : session.user.id;
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 50);
    const path = `watch-party-videos/${id}-${timestamp}-${safeName}.${validated.extension}`;
    const videoType = validated.extension === "webm" ? "webm" : "mp4";

    if (isR2Configured()) {
      await r2Put(path, Buffer.from(await file.arrayBuffer()), validated.mimeType);
      return NextResponse.json({
        url: r2PublicUrl(path),
        videoType,
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
      console.error("[/api/upload/video] Supabase error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      url: data.publicUrl,
      videoType,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("[/api/upload/video] error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
