import { apiFetch } from "./api";

export async function pinPost(id: string) {
  return apiFetch<{ id: string; is_pinned: boolean }>(`/api/v1/posts/${encodeURIComponent(id)}/pin`, { method: "POST" });
}

export async function unpinPost(id: string) {
  return apiFetch<{ id: string; is_pinned: boolean }>(`/api/v1/posts/${encodeURIComponent(id)}/pin`, { method: "DELETE" });
}

export async function lockPost(id: string) {
  return apiFetch<{ id: string; is_locked: boolean }>(`/api/v1/posts/${encodeURIComponent(id)}/lock`, { method: "POST" });
}

export async function unlockPost(id: string) {
  return apiFetch<{ id: string; is_locked: boolean }>(`/api/v1/posts/${encodeURIComponent(id)}/lock`, { method: "DELETE" });
}

export async function removePost(id: string, reason?: string) {
  return apiFetch<{ id: string; is_removed: boolean }>(`/api/v1/posts/${encodeURIComponent(id)}/remove`, { method: "POST", body: { reason } });
}

export async function restorePost(id: string) {
  return apiFetch<{ id: string; is_removed: boolean }>(`/api/v1/posts/${encodeURIComponent(id)}/restore`, { method: "POST" });
}

export async function pinThread(id: string) {
  return apiFetch<{ id: string; is_pinned: boolean }>(`/api/v1/threads/${encodeURIComponent(id)}/pin`, { method: "POST" });
}

export async function unpinThread(id: string) {
  return apiFetch<{ id: string; is_pinned: boolean }>(`/api/v1/threads/${encodeURIComponent(id)}/pin`, { method: "DELETE" });
}

export async function lockThread(id: string) {
  return apiFetch<{ id: string; is_locked: boolean; status: string }>(`/api/v1/threads/${encodeURIComponent(id)}/lock`, { method: "POST" });
}

export async function unlockThread(id: string) {
  return apiFetch<{ id: string; is_locked: boolean; status: string }>(`/api/v1/threads/${encodeURIComponent(id)}/lock`, { method: "DELETE" });
}

export async function removeThread(id: string, reason?: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${encodeURIComponent(id)}/remove`, { method: "POST", body: { reason } });
}

export async function restoreThread(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/threads/${encodeURIComponent(id)}/restore`, { method: "POST" });
}
