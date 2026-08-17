import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type NotificationsLib = typeof import("./notifications");

let lib: NotificationsLib;

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(async () => {
  vi.resetModules();
  lib = await import("./notifications");
  vi.stubGlobal("window", { localStorage: makeStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notifications store", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(lib.getNotifications("user-1")).toEqual([]);
    expect(lib.getUnreadCount("user-1")).toBe(0);
  });

  it("seeds demo notifications once, newest first", () => {
    lib.seedDemoNotifications("user-1");
    const items = lib.getNotifications("user-1");
    expect(items).toHaveLength(4);
    expect(items.every((n) => !n.read)).toBe(true);
    const times = items.map((n) => Date.parse(n.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("does not reseed when notifications already exist", () => {
    lib.seedDemoNotifications("user-1");
    lib.seedDemoNotifications("user-1");
    expect(lib.getNotifications("user-1")).toHaveLength(4);
  });

  it("keeps per-user keys separate", () => {
    lib.seedDemoNotifications("user-a");
    lib.seedDemoNotifications("user-b");
    expect(lib.getNotifications("user-a")).toHaveLength(4);
    expect(lib.getNotifications("user-b")).toHaveLength(4);
    lib.markAllNotificationsRead("user-a");
    expect(lib.getUnreadCount("user-a")).toBe(0);
    expect(lib.getUnreadCount("user-b")).toBe(4);
  });

  it("marks a single notification as read", () => {
    lib.seedDemoNotifications("user-1");
    const [first] = lib.getNotifications("user-1");
    lib.markNotificationRead("user-1", first.id);
    const after = lib.getNotifications("user-1");
    expect(after.find((n) => n.id === first.id)?.read).toBe(true);
    expect(lib.getUnreadCount("user-1")).toBe(3);
  });

  it("marks all notifications as read", () => {
    lib.seedDemoNotifications("user-1");
    lib.markAllNotificationsRead("user-1");
    expect(lib.getUnreadCount("user-1")).toBe(0);
    expect(lib.getNotifications("user-1").every((n) => n.read)).toBe(true);
  });

  it("persists changes to localStorage", () => {
    lib.seedDemoNotifications("user-1");
    const key = lib.notificationKey("user-1");
    const raw = (globalThis.window as unknown as { localStorage: Storage }).localStorage.getItem(key);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toHaveLength(4);
  });

  it("keeps demo notifications out of the live-mode namespace", () => {
    lib.seedDemoNotifications("user-1");
    expect(lib.getNotifications("user-1", "live")).toEqual([]);
    expect(lib.notificationKey("user-1", "demo")).not.toBe(lib.notificationKey("user-1", "live"));
  });

  it("notifies subscribers on state changes", () => {
    const seen: number[] = [];
    const unsubscribe = lib.subscribeNotifications(() => {
      seen.push(lib.getUnreadCount("user-1"));
    });
    lib.seedDemoNotifications("user-1");
    lib.markAllNotificationsRead("user-1");
    unsubscribe();
    lib.seedDemoNotifications("user-2");
    expect(seen).toEqual([4, 0]);
  });

  it("creates notifications with defaults and overrides", () => {
    const item = lib.createNotification("discussion", { title: "New reply", href: "/discussions" });
    expect(item.type).toBe("discussion");
    expect(item.title).toBe("New reply");
    expect(item.read).toBe(false);
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });
});

describe("formatNotificationTime", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("renders relative labels", () => {
    expect(lib.formatNotificationTime("2026-08-12T11:59:30Z", now)).toBe("just now");
    expect(lib.formatNotificationTime("2026-08-12T11:55:00Z", now)).toBe("5m ago");
    expect(lib.formatNotificationTime("2026-08-12T10:00:00Z", now)).toBe("2h ago");
    expect(lib.formatNotificationTime("2026-08-09T12:00:00Z", now)).toBe("3d ago");
  });

  it("falls back to a short date for older items", () => {
    expect(lib.formatNotificationTime("2026-07-01T12:00:00Z", now)).toBe("Jul 1");
  });

  it("returns empty string for invalid input", () => {
    expect(lib.formatNotificationTime("not-a-date", now)).toBe("");
  });
});
