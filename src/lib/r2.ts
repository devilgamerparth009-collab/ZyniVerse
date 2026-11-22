import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const CACHE_IMMUTABLE = "max-age=31536000, immutable";

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE
  );
}

let _client: S3Client | null = null;

function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

export function r2PublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function r2Put(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: CACHE_IMMUTABLE,
    })
  );
}

export async function r2PresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: CACHE_IMMUTABLE,
    }),
    { expiresIn }
  );
}

/** Server-side metadata for a just-uploaded object (used for size checks). */
export async function r2Stat(key: string): Promise<{ size: number } | null> {
  try {
    const result = await client().send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
    );
    return { size: result.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

/** Read only the leading bytes needed for magic-number validation. */
export async function r2ReadPrefix(
  key: string,
  bytes = 16
): Promise<Uint8Array | null> {
  try {
    const result = await client().send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      })
    );
    if (!result.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array | Buffer>) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  } catch {
    return null;
  }
}

/** Publish a validated upload under its final key without re-downloading it. */
export async function r2Copy(
  sourceKey: string,
  destinationKey: string,
  contentType: string
): Promise<void> {
  await client().send(
    new CopyObjectCommand({
      Bucket: process.env.R2_BUCKET,
      CopySource: encodeURIComponent(`${process.env.R2_BUCKET}/${sourceKey}`),
      Key: destinationKey,
      ContentType: contentType,
      CacheControl: CACHE_IMMUTABLE,
      MetadataDirective: "REPLACE",
    })
  );
}

export async function r2Delete(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
  );
}
