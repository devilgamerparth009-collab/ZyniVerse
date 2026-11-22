import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { apiLimiter } from "@/lib/rate-limiter";
import { validateUploadedFile } from "@/lib/file-validation";
import crypto from "crypto";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const validated = await validateUploadedFile(file, ALLOWED, MAX_SIZE, "Image");
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error === "Image is too large" ? "Image must be under 5MB" : validated.error },
      { status: 400 }
    );
  }

  const name = `${Date.now()}-${crypto.randomUUID()}.${validated.extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, name), buffer);

  return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
}
