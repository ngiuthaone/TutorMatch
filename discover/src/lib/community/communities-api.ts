import { apiFetch } from "./api";

export type CommunityVisibility = "public" | "private";
export type CommunityJoinPolicy = "open" | "request" | "invite";

export interface Community {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  visibility: CommunityVisibility;
  join_policy: CommunityJoinPolicy;
  member_count: number;
  post_count: number;
  thread_count: number;
  is_member?: boolean;
  is_moderator?: boolean;
  is_owner?: boolean;
  is_pending?: boolean;
  archived_at?: string | null;
  created_at: string;
}

export interface CommunityMember {
  user_id: string;
  role: "member" | "moderator" | "owner";
  status: "active" | "pending" | "banned";
  joined_at: string;
  name?: string;
  avatar_url?: string | null;
  user_role?: string;
}

export interface CommunityMembership {
  is_member: boolean;
  is_moderator: boolean;
  is_owner: boolean;
  is_pending: boolean;
  is_banned: boolean;
}

export async function listCommunities(params: { cursor?: string | null; limit?: number; q?: string | null } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.q) q.set("q", params.q);
  const qs = q.toString();
  return apiFetch<{ communities: Community[]; nextCursor: string | null }>(`/api/v1/communities${qs ? `?${qs}` : ""}`, { auth: false });
}

export async function getCommunity(slugOrId: string) {
  return apiFetch<Community & { membership: CommunityMembership }>(`/api/v1/communities/${encodeURIComponent(slugOrId)}`, { auth: false });
}

export async function listCommunityMembers(communityId: string, params: { cursor?: string | null; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<{ members: CommunityMember[]; nextCursor: string | null }>(`/api/v1/communities/${encodeURIComponent(communityId)}/members${qs ? `?${qs}` : ""}`);
}

export async function createCommunity(input: { slug: string; name: string; description?: string; visibility?: CommunityVisibility; joinPolicy?: CommunityJoinPolicy }) {
  return apiFetch<{ id: string; slug: string }>("/api/v1/communities", { method: "POST", body: input });
}

export async function updateCommunity(id: string, input: { name?: string; description?: string; visibility?: CommunityVisibility; joinPolicy?: CommunityJoinPolicy }) {
  return apiFetch<{ id: string; updated: boolean }>(`/api/v1/communities/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
}

export async function joinCommunity(id: string) {
  return apiFetch<{ community_id: string; status: "active" | "pending" }>(`/api/v1/communities/${encodeURIComponent(id)}/join`, { method: "POST" });
}

export async function leaveCommunity(id: string) {
  return apiFetch<{ community_id: string; left: boolean }>(`/api/v1/communities/${encodeURIComponent(id)}/members/me`, { method: "DELETE" });
}

export async function approveMember(communityId: string, userId: string) {
  return apiFetch<{ community_id: string; user_id: string; status: "active" }>(`/api/v1/communities/${encodeURIComponent(communityId)}/members/${encodeURIComponent(userId)}/approve`, { method: "POST" });
}

export async function banMember(communityId: string, userId: string, reason?: string) {
  return apiFetch<{ community_id: string; user_id: string; status: "banned" }>(`/api/v1/communities/${encodeURIComponent(communityId)}/members/${encodeURIComponent(userId)}/ban`, { method: "POST", body: { reason } });
}

export async function setMemberRole(communityId: string, userId: string, role: "member" | "moderator") {
  return apiFetch<{ community_id: string; user_id: string; role: string }>(`/api/v1/communities/${encodeURIComponent(communityId)}/members/${encodeURIComponent(userId)}/role`, { method: "PATCH", body: { role } });
}

export async function archiveCommunity(id: string) {
  return apiFetch<{ community_id: string; archived: boolean }>(`/api/v1/communities/${encodeURIComponent(id)}/archive`, { method: "POST" });
}
