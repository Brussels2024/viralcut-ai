import { z } from "zod";

export const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska"
] as const;

export const videoUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(ALLOWED_VIDEO_TYPES),
  size: z.number().int().positive().max(MAX_VIDEO_SIZE_BYTES)
});

export type VideoUploadInput = z.infer<typeof videoUploadSchema>;

export function safeVideoExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const allowed = new Set(["mp4", "mov", "webm", "mkv"]);
  return allowed.has(extension) ? extension : "mp4";
}