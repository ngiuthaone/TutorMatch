import { apiFetch } from "./api";

export interface FollowUser {
  name: string;
  avatar_url?: string | null;
  role?: string;
  is_following?: boolean;
}

export async function followUser(name: string) {
  return apiFetch<{ followee: string; following: boolean }>(`/api/v1/users/${encodeURIComponent(name)}/follow`, { method: "POST" });
}

export async function unfollowUser(name: string) {
  return apiFetch<{ followee: string; following: boolean }>(`/api/v1/users/${encodeURIComponent(name)}/follow`, { method: "DELETE" });
}

export async function isFollowing(name: string) {
  return apiFetch<{ following: boolean }>(`/api/v1/users/${encodeURIComponent(name)}/following`, { auth: false });
}

export async function listFollowers(name: string) {
  return apiFetch<{ followers: FollowUser[] }>(`/api/v1/users/${encodeURIComponent(name)}/followers`, { auth: false });
}

export async function listFollowing(name: string) {
  return apiFetch<{ following: FollowUser[] }>(`/api/v1/users/${encodeURIComponent(name)}/following-list`, { auth: false });
}
