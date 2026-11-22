import { describe, it, expect } from "vitest";
import {
  detectUploadedMimeType,
  validateUploadedFile,
} from "@/lib/file-validation";

function upload(bytes: number[], type: string): File {
  return new Blob([new Uint8Array(bytes)], { type }) as unknown as File;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const MP4 = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];

const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEOS = ["video/mp4", "video/webm", "video/quicktime"];

describe("validateUploadedFile", () => {
  it("accepts a real PNG and derives a safe extension", async () => {
    const result = await validateUploadedFile(upload(PNG, "image/png"), IMAGES, 1024);
    expect(result).toEqual({ ok: true, mimeType: "image/png", extension: "png" });
  });

  it("rejects an image whose declared type does not match its bytes", async () => {
    const result = await validateUploadedFile(upload(PNG, "image/jpeg"), IMAGES, 1024);
    expect(result.ok).toBe(false);
  });

  it("rejects arbitrary text disguised as an image", async () => {
    const result = await validateUploadedFile(upload([60, 115, 99, 114, 105, 112, 116], "image/png"), IMAGES, 1024);
    expect(result.ok).toBe(false);
  });

  it("accepts an ISO-BMFF video", async () => {
    const result = await validateUploadedFile(upload(MP4, "video/mp4"), VIDEOS, 1024);
    expect(result).toEqual({ ok: true, mimeType: "video/mp4", extension: "mp4" });
  });

  it("does not trust the client filename or a JPEG labelled as video", async () => {
    const jpeg = upload(JPEG, "video/mp4");
    Object.defineProperty(jpeg, "name", { value: "almost-safe.html" });
    const result = await validateUploadedFile(jpeg, VIDEOS, 1024);
    expect(result.ok).toBe(false);
  });

  it("detects signatures for post-upload verification", () => {
    expect(detectUploadedMimeType(new Uint8Array(PNG))).toBe("image/png");
    expect(detectUploadedMimeType(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(detectUploadedMimeType(new Uint8Array(MP4))).toBe("video/mp4");
    expect(detectUploadedMimeType(new Uint8Array([60, 115, 99, 114, 105, 112, 116]))).toBeNull();
  });
});
