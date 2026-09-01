import { apiFetch, CommunityApiError } from "./api";

export type AnchorType = "course" | "event" | "workshop" | "article" | "tutor_profile" | "external_url";
export type ContentLevel = "complete_beginner" | "beginner" | "intermediate" | "advanced" | "all_levels";

export interface ThreadAuthor {
  name: string;
  avatar_url?: string | null;
  role?: string;
}

export interface ThreadSummary {
  id: string;
  title: string;
  body: string | null;
  anchor_type: AnchorType;
  anchor_id: string | null;
  anchor_url: string | null;
  anchor_title: string | null;
  anchor_domain: string | null;
  tags: string[];
  level: string | null;
  visibility: string;
  reply_permission: string;
  appreciated_count: number;
  reply_count: number;
  created_at: string;
  is_creator?: boolean;
  appreciated_by_me?: boolean;
}

export interface ThreadReply {
  id: string;
  parent_id: string | null;
  body: string;
  appreciated_count: number;
  created_at: string;
  depth: number;
  is_creator?: boolean;
  appreciated_by_me?: boolean;
  author: ThreadAuthor;
}

export interface ThreadDetail {
  thread: ThreadSummary & { author: ThreadAuthor; status: string };
  replies: ThreadReply[];
}

export interface CreateThreadInput {
  title: string;
  body?: string | null;
  anchorType: AnchorType;
  anchorId?: string | null;
  anchorUrl?: string | null;
  anchorTitle?: string | null;
  tags?: string[];
  level?: string | null;
  visibility?: "public" | "community";
  communityId?: string | null;
  replyPermission?: "everyone" | "community_members" | "disabled";
}

export async function createThread(input: CreateThreadInput) {
  return apiFetch<{ id: string; status: string }>("/api/v1/threads", {
    method: "POST",
    body: {
      title: input.title,
      body: input.body ?? null,
      anchorType: input.anchorType,
      anchorId: input.anchorId ?? null,
      anchorUrl: input.anchorUrl ?? null,
      anchorTitle: input.anchorTitle ?? null,
      tags: input.tags ?? [],
      level: input.level ?? null,
      visibility: input.visibility ?? "public",
      communityId: input.communityId ?? null,
      replyPermission: input.replyPermission ?? "everyone",
    },
  });
}

export async function listThreads(params: { cursor?: string | null; limit?: number; tag?: string | null; level?: string | null; anchorType?: string | null } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.tag) q.set("tag", params.tag);
  if (params.level) q.set("level", params.level);
  if (params.anchorType) q.set("anchorType", params.anchorType);
  const qs = q.toString();
  return apiFetch<{ threads: ThreadSummary[]; nextCursor: string | null }>(`/api/v1/threads${qs ? `?${qs}` : ""}`, { auth: false });
}

export async function getThread(id: string) {
  return apiFetch<ThreadDetail>(`/api/v1/threads/${id}`, { auth: false });
}

export async function replyToThread(threadId: string, body: string, parentId: string | null = null) {
  return apiFetch<{ id: string; depth: number; status: string }>(`/api/v1/threads/${threadId}/replies`, {
    method: "POST",
    body: { body, parentId },
  });
}

export async function appreciateThread(threadId: string) {
  return apiFetch<{ target_type: string; target_id: string; appreciated_count: number; appreciated_by_me: boolean }>(
    `/api/v1/threads/${threadId}/appreciate`, { method: "POST" },
  );
}

export async function unappreciateThread(threadId: string) {
  return apiFetch<{ target_type: string; target_id: string; appreciated_count: number; appreciated_by_me: boolean }>(
    `/api/v1/threads/${threadId}/appreciate`, { method: "DELETE" },
  );
}

export async function closeThread(threadId: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${threadId}/close`, { method: "PATCH" });
}

export async function reopenThread(threadId: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${threadId}/reopen`, { method: "PATCH" });
}

export async function deleteThread(threadId: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${threadId}`, { method: "DELETE" });
}

export async function deleteReply(replyId: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/replies/${replyId}`, { method: "DELETE" });
}

export async function reportThread(targetType: "thread" | "reply", targetId: string, reason: string) {
  return apiFetch<{ id: string; status: string }>("/api/v1/threads/report", {
    method: "POST",
    body: { targetType, targetId, reason },
  });
}

export function isCommunityApiError(error: unknown): error is CommunityApiError {
  return error instanceof CommunityApiError;
}
