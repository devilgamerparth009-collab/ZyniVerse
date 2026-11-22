import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isR2Configured, r2Put, r2PublicUrl } from "@/lib/r2";
import { validateUploadedFile } from "@/lib/file-validation";
import crypto from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    const validated = await validateUploadedFile(file, ALLOWED_TYPES, MAX_SIZE, "Image");
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error === "Image is too large" ? "File too large. Max 5MB." : validated.error },
        { status: 400 }
      );
    }

    const uniqueId = Date.now().toString(36) + crypto.randomUUID();
    const path = `blog/${session.user.id}/${uniqueId}.${validated.extension}`;

    if (isR2Configured()) {
      await r2Put(path, Buffer.from(await file.arrayBuffer()), validated.mimeType);
      return NextResponse.json({ url: r2PublicUrl(path) });
    }

    const supabase = getSupabaseAdmin();
    const BUCKET = "profiles";

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: validated.mimeType, cacheControl: '31536000' });

    if (uploadError) {
      console.error("[/api/upload/blog] Supabase error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("[/api/upload/blog] error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
