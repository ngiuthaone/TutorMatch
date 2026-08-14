import { useSyncExternalStore } from "react";
import { generateId } from "./types";

export type NotificationType = "session" | "review" | "discussion" | "course";
export type NotificationMode = "demo" | "live";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

const KEY_PREFIX = "tutoria_notifications_";

const subscribers = new Set<() => void>();
const snapshotCache = new Map<string, NotificationItem[]>();

function emit(): void {
  for (const cb of subscribers) cb();
}

function storageKey(userId: string, mode: NotificationMode): string {
  return `${KEY_PREFIX}${mode}_${userId}`;
}

function readFromStorage(userId: string, mode: NotificationMode): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId, mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(userId: string, mode: NotificationMode, items: NotificationItem[]): void {
  try {
    window.localStorage.setItem(storageKey(userId, mode), JSON.stringify(items));
  } catch {}
}

export function notificationKey(userId: string, mode: NotificationMode = "demo"): string {
  return storageKey(userId, mode);
}

export function createNotification(
  type: NotificationType,
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: overrides.id ?? generateId(),
    type,
    title: overrides.title ?? "",
    body: overrides.body,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    read: overrides.read ?? false,
    href: overrides.href,
  };
}

const demoSeeds: Array<Omit<NotificationItem, "id" | "createdAt" | "read">> = [
  {
    type: "session",
    title: "Upcoming session in 2 days",
    body: "Your booking for the Pizza 4P's Pizza-Making Workshop is confirmed.",
    href: "/events",
  },
  {
    type: "discussion",
    title: "A new reply on your post",
    body: "Minh replied to \u201cHow do you stay consistent with daily practice?\u201d",
    href: "/discussions",
  },
  {
    type: "review",
    title: "You received a new review",
    body: "Lan rated your session 5 stars and left a comment.",
    href: "/people",
  },
  {
    type: "course",
    title: "Workshop update",
    body: "The schedule for the beginner pottery course has changed.",
    href: "/courses",
  },
];

export function hasNotifications(userId: string, mode: NotificationMode = "demo"): boolean {
  return readFromStorage(userId, mode).length > 0;
}

export function seedDemoNotifications(userId: string): void {
  if (hasNotifications(userId, "demo")) return;
  const now = Date.now();
  const items: NotificationItem[] = demoSeeds.map((seed, index) => ({
    ...seed,
    id: generateId(),
    createdAt: new Date(now - (index + 1) * 3_600_000).toISOString(),
    read: false,
  }));
  writeToStorage(userId, "demo", items);
  snapshotCache.delete(notificationKey(userId, "demo"));
  emit();
}

export function getNotifications(userId: string, mode: NotificationMode = "demo"): NotificationItem[] {
  const cacheKey = notificationKey(userId, mode);
  const cached = snapshotCache.get(cacheKey);
  if (cached) return cached;
  const items = [...readFromStorage(userId, mode)].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  snapshotCache.set(cacheKey, items);
  return items;
}

export function getUnreadCount(userId: string, mode: NotificationMode = "demo"): number {
  return getNotifications(userId, mode).filter((n) => !n.read).length;
}

export function markNotificationRead(userId: string, id: string, mode: NotificationMode = "demo"): void {
  const items = readFromStorage(userId, mode);
  const idx = items.findIndex((n) => n.id === id);
  if (idx < 0 || items[idx].read) return;
  items[idx] = { ...items[idx], read: true };
  writeToStorage(userId, mode, items);
  snapshotCache.delete(notificationKey(userId, mode));
  emit();
}

export function markAllNotificationsRead(userId: string, mode: NotificationMode = "demo"): void {
  const items = readFromStorage(userId, mode);
  if (!items.some((n) => !n.read)) return;
  writeToStorage(userId, mode, items.map((n) => ({ ...n, read: true })));
  snapshotCache.delete(notificationKey(userId, mode));
  emit();
}

export function subscribeNotifications(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange);
  return () => subscribers.delete(onStoreChange);
}

export function useNotifications(userId: string, mode: NotificationMode = "demo"): NotificationItem[] {
  return useSyncExternalStore(subscribeNotifications, () => getNotifications(userId, mode));
}

export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
