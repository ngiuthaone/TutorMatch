import { describe, expect, it } from "vitest";

import {
  buildObjectPath,
  TUTOR_MEDIA_BUCKET,
  validateVideo,
  TutorMediaError,
} from "@/lib/tutor-media-api";

describe("buildObjectPath", () => {
  it("places photo uploads under the user directory in the avatars bucket", () => {
    const path = buildObjectPath("photo", "11111111-2222-3333-4444-555555555555", "jpg");
    expect(path.startsWith("11111111-2222-3333-4444-555555555555/avatars/profile-photo-")).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
  });

  it("places intro videos under the user directory in the intro-videos bucket", () => {
    const user = "11111111-2222-3333-4444-555555555555";
    const path = buildObjectPath("intro_video", user, "mp4");
    expect(path.startsWith(`${user}/intro-videos/intro-`)).toBe(true);
    expect(path.endsWith(".mp4")).toBe(true);
  });

  it("sanitizes unexpected extensions to bin", () => {
    const path = buildObjectPath("photo", "u", "../../evil");
    expect(path.endsWith(".bin")).toBe(true);
    expect(path).not.toContain("..");
  });

  it("normalizes uppercase extensions to lowercase", () => {
    expect(buildObjectPath("photo", "u", "JPG").endsWith(".jpg")).toBe(true);
  });
});

describe("bucket map", () => {
  it("maps media kinds to the backend bucket names", () => {
    expect(TUTOR_MEDIA_BUCKET.photo).toBe("avatars");
    expect(TUTOR_MEDIA_BUCKET.intro_video).toBe("intro-videos");
    expect(TUTOR_MEDIA_BUCKET.verification_doc).toBe("verification-docs");
  });
});

describe("validateVideo", () => {
  it("accepts mp4 and webm under 50 MB", () => {
    expect(() => validateVideo({ type: "video/mp4", size: 1024 } as File)).not.toThrow();
    expect(() => validateVideo({ type: "video/webm", size: 49 * 1024 * 1024 } as File)).not.toThrow();
  });

  it("rejects unsupported video types", () => {
    expect(() => validateVideo({ type: "video/quicktime", size: 10 } as File)).toThrow(TutorMediaError);
  });

  it("rejects videos over 50 MB", () => {
    expect(() => validateVideo({ type: "video/mp4", size: 60 * 1024 * 1024 } as File)).toThrow(/50 MB/);
  });
});
