import { apiFetch } from "./api";

export type AnchorType = "course" | "event" | "workshop" | "article" | "tutor_profile" | "external_url";
export type ThreadVisibility = "public" | "community";
export type ReplyPermission = "everyone" | "community_members" | "disabled";
export type ThreadLevel = "complete_beginner" | "beginner" | "intermediate" | "advanced" | "all_levels";

export interface ThreadAuthor {
  name: string;
  avatar_url?: string | null;
  role?: string;
}

export interface ReferenceThread {
  id: string;
  title: string;
  body?: string | null;
  anchor_type: AnchorType;
  anchor_id?: string | null;
  anchor_url?: string | null;
  anchor_title?: string | null;
  anchor_domain?: string | null;
  tags: string[];
  level?: ThreadLevel | null;
  visibility: ThreadVisibility;
  reply_permission: ReplyPermission;
  community_id?: string | null;
  is_pinned?: boolean;
  is_locked?: boolean;
  appreciated_count: number;
  reply_count: number;
  status: "published" | "closed" | "deleted" | "removed";
  is_creator?: boolean;
  appreciated_by_me?: boolean;
  creator: ThreadAuthor;
  created_at: string;
  updated_at: string;
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

export interface CreateThreadInput {
  title: string;
  body?: string;
  anchorType: AnchorType;
  anchorId?: string;
  anchorUrl?: string;
  anchorTitle?: string;
  anchorDomain?: string;
  tags?: string[];
  level?: ThreadLevel;
  visibility?: ThreadVisibility;
  communityId?: string;
  replyPermission?: ReplyPermission;
}

export async function listThreads(params: { cursor?: string | null; limit?: number; tag?: string | null; level?: string | null; anchorType?: string | null; communityId?: string | null } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.tag) q.set("tag", params.tag);
  if (params.level) q.set("level", params.level);
  if (params.anchorType) q.set("anchorType", params.anchorType);
  if (params.communityId) q.set("communityId", params.communityId);
  const qs = q.toString();
  return apiFetch<{ threads: ReferenceThread[]; nextCursor: string | null }>(`/api/v1/threads${qs ? `?${qs}` : ""}`, { auth: false });
}

export async function getThread(id: string) {
  return apiFetch<ReferenceThread>(`/api/v1/threads/${encodeURIComponent(id)}`, { auth: false });
}

export async function getThreadReplies(id: string) {
  return apiFetch<{ replies: ThreadReply[] }>(`/api/v1/threads/${encodeURIComponent(id)}/replies`, { auth: false });
}

export async function createThread(input: CreateThreadInput) {
  return apiFetch<{ id: string; status: string }>("/api/v1/threads", {
    method: "POST",
    body: input,
  });
}

export async function replyToThread(threadId: string, body: string, parentId?: string | null) {
  return apiFetch<{ id: string; depth: number; status: string }>(`/api/v1/threads/${encodeURIComponent(threadId)}/replies`, {
    method: "POST",
    body: { body, parentId },
  });
}

export async function appreciateReference(targetType: "thread" | "reply", targetId: string) {
  return apiFetch<{ target_type: string; target_id: string; appreciated_count: number; appreciated_by_me: boolean }>(
    "/api/v1/threads/appreciate",
    { method: "POST", body: { targetType, targetId } },
  );
}

export async function unappreciateReference(targetType: "thread" | "reply", targetId: string) {
  return apiFetch<{ target_type: string; target_id: string; appreciated_count: number; appreciated_by_me: boolean }>(
    "/api/v1/threads/appreciate",
    { method: "DELETE", body: { targetType, targetId } },
  );
}

export async function closeThread(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${encodeURIComponent(id)}/close`, { method: "PATCH" });
}

export async function reopenThread(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${encodeURIComponent(id)}/reopen`, { method: "PATCH" });
}

export async function deleteThread(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deleteThreadReply(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/replies/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function reportReferenceContent(targetType: "thread" | "reply" | "comment", targetId: string, reason: string) {
  return apiFetch<{ id: string; status: string }>("/api/v1/threads/report", {
    method: "POST",
    body: { targetType, targetId, reason },
  });
}
