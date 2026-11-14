import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_SIZE_BYTES,
  safeVideoExtension,
  videoUploadSchema
} from "./validation";

describe("video upload validation", () => {
  it("accepts supported video MIME types and files up to 2 GB", () => {
    expect(videoUploadSchema.safeParse({
      fileName: "stream.mp4",
      contentType: "video/mp4",
      size: MAX_VIDEO_SIZE_BYTES
    }).success).toBe(true);
  });

  it("rejects unsupported MIME types, empty names and oversized files", () => {
    expect(videoUploadSchema.safeParse({
      fileName: "payload.exe",
      contentType: "application/octet-stream",
      size: 100
    }).success).toBe(false);
    expect(videoUploadSchema.safeParse({
      fileName: " ",
      contentType: "video/mp4",
      size: 100
    }).success).toBe(false);
    expect(videoUploadSchema.safeParse({
      fileName: "large.mp4",
      contentType: "video/mp4",
      size: MAX_VIDEO_SIZE_BYTES + 1
    }).success).toBe(false);
  });

  it("normalizes only known file extensions", () => {
    expect(safeVideoExtension("LIVE.MOV")).toBe("mov");
    expect(safeVideoExtension("clip.webm")).toBe("webm");
    expect(safeVideoExtension("malware.exe")).toBe("mp4");
  });
});
