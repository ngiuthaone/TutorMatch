"use client";

import { getSessionAccessToken } from "./auth/session";
import { getSupabaseClient } from "./auth/supabase-client";
import { isLiveMode } from "./auth/config";

export type TutorMediaKind = "photo" | "intro_video" | "verification_doc";

export interface TutorMediaSubmission {
  id: string;
  kind: TutorMediaKind;
  status: "pending" | "approved" | "rejected" | "removed";
  objectPath: string;
  mime: string;
  sizeBytes: number;
  moderationNote: string | null;
}

export class TutorMediaError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.name = "TutorMediaError";
    this.code = code;
  }
}

export const TUTOR_MEDIA_BUCKET: Record<TutorMediaKind, string> = {
  photo: "avatars",
  intro_video: "intro-videos",
  verification_doc: "verification-docs",
};

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 1024;
export const PHOTO_COMPRESS_QUALITY = 0.82;

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function now(): number {
  return Date.now();
}

export function buildObjectPath(kind: TutorMediaKind, userId: string, extension: string): string {
  const safeExtension = /^[a-z0-9]{1,8}$/i.test(extension) ? extension.toLowerCase() : "bin";
  const directory = TUTOR_MEDIA_BUCKET[kind];
  return `${userId}/${directory}/${kind === "photo" ? "profile-photo" : "intro"}-${now()}.${safeExtension}`;
}

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  return "bin";
}

export interface CompressResult {
  blob: Blob;
  mime: string;
}

export async function compressPhotoToBlob(file: File): Promise<CompressResult> {
  if (!file.type || !ALLOWED_PHOTO_TYPES.has(file.type)) {
    throw new TutorMediaError("PHOTO_TYPE_NOT_ALLOWED", "Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new TutorMediaError("PHOTO_TOO_LARGE", "Choose an image under 5 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / bitmap.width, PHOTO_MAX_DIMENSION / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new TutorMediaError("PHOTO_COMPRESS_FAILED", "Your browser blocked image processing.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    return { blob, mime: blob.type || "image/jpeg" };
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new TutorMediaError("PHOTO_COMPRESS_FAILED"))), "image/webp", PHOTO_COMPRESS_QUALITY);
  });
}

export function validateVideo(file: File): void {
  if (!file.type || !ALLOWED_VIDEO_TYPES.has(file.type)) {
    throw new TutorMediaError("VIDEO_TYPE_NOT_ALLOWED", "Choose an MP4 (H.264) or WebM video.");
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new TutorMediaError("VIDEO_TOO_LARGE", "Choose a video under 50 MB. Compress it on your device first.");
  }
}

export async function getCurrentUserId(): Promise<string> {
  const client = getSupabaseClient();
  if (!client) throw new TutorMediaError("LIVE_MODE_REQUIRED", "Media uploads need the production backend.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new TutorMediaError("UNAUTHORIZED", "Sign in again to upload media.");
  return data.user.id;
}

export async function submitTutorPhoto(file: File, userId: string): Promise<TutorMediaSubmission> {
  const { blob, mime } = await compressPhotoToBlob(file);
  return uploadAndSubmit("photo", blob, buildObjectPath("photo", userId, extensionForMime(mime)), mime);
}

export async function submitTutorVideo(file: File, userId: string): Promise<TutorMediaSubmission> {
  validateVideo(file);
  return uploadAndSubmit("intro_video", file, buildObjectPath("intro_video", userId, extensionForMime(file.type)), file.type);
}

async function uploadAndSubmit(kind: TutorMediaKind, blob: Blob, objectPath: string, mime: string): Promise<TutorMediaSubmission> {
  const client = getSupabaseClient();
  if (!client) throw new TutorMediaError("LIVE_MODE_REQUIRED", "Media uploads need the production backend.");
  const token = getSessionAccessToken();
  if (!token) throw new TutorMediaError("UNAUTHORIZED", "Sign in again to upload media.");

  const { error: uploadError } = await client.storage
    .from(TUTOR_MEDIA_BUCKET[kind])
    .upload(objectPath, blob, { contentType: mime, cacheControl: "3600", upsert: false });
  if (uploadError) {
    if (uploadError.statusCode === "409" || String(uploadError.message).includes("already exists")) {
      throw new TutorMediaError("MEDIA_PATH_CONFLICT", "A file with this name already exists. Try again.");
    }
    throw new TutorMediaError("MEDIA_UPLOAD_FAILED", uploadError.message);
  }

  const { data, error } = await client.rpc("submit_tutor_media", {
    p_kind: kind === "intro_video" ? "intro_video" : "photo",
    p_object_path: objectPath,
    p_mime: mime,
    p_size_bytes: blob.size,
  });
  if (error) throw new TutorMediaError(error.message || "MEDIA_SUBMIT_FAILED", error.message);
  return data as TutorMediaSubmission;
}

export async function getMyTutorMedia(): Promise<TutorMediaSubmission[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("get_my_tutor_media");
  if (error) throw new TutorMediaError(error.message || "MEDIA_LIST_FAILED", error.message);
  return Array.isArray(data) ? (data as TutorMediaSubmission[]) : [];
}

export function canUploadMedia(): boolean {
  return isLiveMode();
}
