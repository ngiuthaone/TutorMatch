import { apiFetch } from "./api";

export type BookmarkTarget = "post" | "article" | "thread";

export interface Bookmark {
  id: string;
  target_type: BookmarkTarget;
  target_id: string;
  created_at: string;
}

export async function addBookmark(targetType: BookmarkTarget, targetId: string) {
  return apiFetch<{ id: string; target_type: BookmarkTarget; target_id: string }>("/api/v1/bookmarks", { method: "POST", body: { targetType, targetId } });
}

export async function removeBookmark(targetType: BookmarkTarget, targetId: string) {
  return apiFetch<{ removed: boolean }>("/api/v1/bookmarks", { method: "DELETE", body: { targetType, targetId } });
}

export async function listBookmarks(params: { cursor?: string | null; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<{ bookmarks: Bookmark[]; nextCursor: string | null }>(`/api/v1/bookmarks${qs ? `?${qs}` : ""}`);
}

export type ReportTarget = "post" | "article";

export async function reportContent(targetType: ReportTarget, targetId: string, reason: string) {
  return apiFetch<{ id: string; status: string }>("/api/v1/reports", { method: "POST", body: { targetType, targetId, reason } });
}
