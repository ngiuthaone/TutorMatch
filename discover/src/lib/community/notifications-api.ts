import { apiFetch } from "./api";

export interface NotificationActor {
  name: string;
  avatar_url?: string | null;
  role?: string;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "reply" | "repost" | "follow";
  entity_type: "post" | "article" | "comment";
  entity_id: string;
  message: string;
  read: boolean;
  created_at: string;
  actor?: NotificationActor | null;
}

export async function listNotifications(cursor?: string | null, limit: number = 20) {
  const q = new URLSearchParams();
  if (cursor) q.set("cursor", cursor);
  if (limit) q.set("limit", String(limit));
  const qs = q.toString();
  return apiFetch<{ notifications: Notification[]; nextCursor: string | null }>(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
}

export async function getUnreadCount() {
  return apiFetch<{ count: number }>("/api/v1/notifications/unread-count");
}

export async function markNotificationRead(id: string) {
  return apiFetch<{ id: string; read: boolean }>(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  return apiFetch<{ success: boolean }>("/api/v1/notifications/read-all", { method: "POST" });
}
