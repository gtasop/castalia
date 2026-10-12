import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Files are addressed by key, e.g. "tracks/<id>/lossless.flac".
// Local driver for development, S3-compatible (Cloudflare R2) for production.

const LOCAL_ROOT = path.resolve("storage");
const driver = process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";

let s3: S3Client | null = null;
function client() {
  s3 ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  return s3;
}

function localPath(key: string) {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("invalid storage key");
  return p;
}

export async function putFile(key: string, filePath: string, contentType: string) {
  if (driver === "s3") {
    const { size } = await stat(filePath);
    await client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: size,
        ContentType: contentType,
      }),
    );
    return;
  }
  const dest = localPath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(createReadStream(filePath), createWriteStream(dest));
}

/** For S3: a short-lived signed URL the browser fetches directly. `disposition` is a full Content-Disposition value. */
export async function signedUrl(key: string, disposition?: string): Promise<string | null> {
  if (driver !== "s3") return null;
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: 300 },
  );
}

/** Reads a file as a Node stream, optionally a byte range. */
export async function readFile(key: string, range?: { start: number; end: number }): Promise<Readable> {
  if (driver === "s3") {
    const res = await client().send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    return res.Body as Readable;
  }
  return createReadStream(localPath(key), range);
}

export function usesSignedUrls() {
  return driver === "s3";
}

export async function deleteFile(key: string) {
  if (driver === "s3") {
    await client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    return;
  }
  await rm(localPath(key), { force: true });
}

/** Deletes every file under a prefix such as "tracks/<id>/". */
export async function deletePrefix(prefix: string) {
  if (!prefix.endsWith("/")) throw new Error("prefix must end with /");
  if (driver === "s3") {
    const listed = await client().send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, Prefix: prefix }));
    const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length) await client().send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET, Delete: { Objects: keys } }));
    return;
  }
  await rm(localPath(prefix), { recursive: true, force: true });
}
