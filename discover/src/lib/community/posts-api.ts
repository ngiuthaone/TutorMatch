import { apiFetch, CommunityApiError } from "./api";

export interface PostAuthor {
  name: string;
  avatar_url?: string | null;
  role?: string;
}

export interface Post {
  id: string;
  body: string;
  tags: string[];
  level?: string | null;
  post_type?: string | null;
  reply_permission: string;
  like_count: number;
  repost_count: number;
  comment_count: number;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  is_author?: boolean;
  is_following?: boolean;
  liked_by_me?: boolean;
  reposted_by_me?: boolean;
  author: PostAuthor;
}

export interface CreatePostInput {
  body: string;
  tags?: string[];
  level?: string | null;
  postType?: string | null;
  replyPermission?: string | null;
  communityId?: string | null;
  imageUrl?: string | null;
}

export async function createPost(input: CreatePostInput) {
  return apiFetch<{ id: string; status: string }>("/api/v1/posts", {
    method: "POST",
    body: {
      body: input.body,
      tags: input.tags ?? [],
      level: input.level ?? null,
      postType: input.postType ?? null,
      replyPermission: input.replyPermission ?? "everyone",
      communityId: input.communityId ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
}

export async function updatePost(id: string, input: Partial<CreatePostInput>) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/posts/${id}`, {
    method: "PATCH",
    body: {
      body: input.body,
      tags: input.tags,
      level: input.level,
      postType: input.postType,
      replyPermission: input.replyPermission,
      imageUrl: input.imageUrl,
    },
  });
}

export async function deletePost(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/posts/${id}`, { method: "DELETE" });
}

export async function getPost(id: string) {
  return apiFetch<Post>(`/api/v1/posts/${encodeURIComponent(id)}`, { auth: false });
}

export async function listPosts(params: { cursor?: string | null; limit?: number; tag?: string | null; postType?: string | null; authorName?: string | null } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.tag) q.set("tag", params.tag);
  if (params.postType) q.set("postType", params.postType);
  if (params.authorName) q.set("authorName", params.authorName);
  const qs = q.toString();
  return apiFetch<{ posts: Post[]; nextCursor: string | null }>(`/api/v1/posts${qs ? `?${qs}` : ""}`, { auth: false });
}

export async function listMyPosts() {
  return apiFetch<{ posts: Post[] }>("/api/v1/posts/mine");
}

export async function repostPost(id: string) {
  return apiFetch<{ post_id: string; repost_count: number; reposted_by_me: boolean }>(`/api/v1/posts/${id}/repost`, { method: "POST" });
}

export async function unrepostPost(id: string) {
  return apiFetch<{ post_id: string; repost_count: number; reposted_by_me: boolean }>(`/api/v1/posts/${id}/repost`, { method: "DELETE" });
}

export async function likePost(id: string) {
  return apiFetch<{ post_id: string; like_count: number; liked_by_me: boolean }>(`/api/v1/posts/${id}/like`, { method: "POST" });
}

export async function unlikePost(id: string) {
  return apiFetch<{ post_id: string; like_count: number; liked_by_me: boolean }>(`/api/v1/posts/${id}/like`, { method: "DELETE" });
}

export function isCommunityApiError(error: unknown): error is CommunityApiError {
  return error instanceof CommunityApiError;
}
