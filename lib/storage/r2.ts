import { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { VideoUploadInput } from "@/lib/media/validation";
import { safeVideoExtension } from "@/lib/media/validation";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createR2Client() {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY")
    }
  });
}

/**
 * Creates a short-lived, single-object upload URL.
 * Call this only from an authenticated server route after authorization checks.
 */
export async function createVideoUploadUrl(input: VideoUploadInput) {
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const objectKey = `originals/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${safeVideoExtension(input.fileName)}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: input.contentType,
    ContentLength: input.size
  });

  const uploadUrl = await getSignedUrl(createR2Client(), command, {
    expiresIn: 600
  });

  return {
    objectKey,
    uploadUrl,
    expiresIn: 600,
    requiredHeaders: { "Content-Type": input.contentType }
  };
}