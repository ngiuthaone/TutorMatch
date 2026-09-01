import { apiFetch, CommunityApiError } from "./api";

export { CommunityApiError } from "./api";

export function isCommunityApiError(error: unknown): error is CommunityApiError {
  return error instanceof CommunityApiError;
}

export interface CommentAuthor {
  name: string;
  avatar_url?: string | null;
  role?: string;
}

export interface Comment {
  id: string;
  parent_id: string | null;
  body: string;
  appreciated_count: number;
  created_at: string;
  depth: number;
  is_creator?: boolean;
  appreciated_by_me?: boolean;
  author: CommentAuthor;
}

export async function listComments(ownerType: "thread" | "article", ownerId: string) {
  const q = new URLSearchParams({ ownerType, ownerId });
  return apiFetch<{ comments: Comment[] }>(`/api/v1/comments?${q.toString()}`, { auth: false });
}

export async function createComment(ownerType: "thread" | "article", ownerId: string, body: string, parentId: string | null = null) {
  return apiFetch<{ id: string; depth: number; status: string }>("/api/v1/comments", {
    method: "POST",
    body: { ownerType, ownerId, body, parentId },
  });
}

export async function deleteComment(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/comments/${id}`, { method: "DELETE" });
}

export async function appreciateComment(id: string) {
  return apiFetch<{ comment_id: string; appreciated_count: number; appreciated_by_me: boolean }>(
    `/api/v1/comments/${id}/appreciate`, { method: "POST" },
  );
}

export async function unappreciateComment(id: string) {
  return apiFetch<{ comment_id: string; appreciated_count: number; appreciated_by_me: boolean }>(
    `/api/v1/comments/${id}/appreciate`, { method: "DELETE" },
  );
}
