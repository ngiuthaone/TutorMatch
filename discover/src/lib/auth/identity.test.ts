import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadIdentity() {
  return await import("./identity");
}

beforeEach(() => {
  vi.resetModules();
});

describe("live identity external store", () => {
  it("returns the same snapshot reference until the identity changes", async () => {
    const { getLiveIdentity, setLiveIdentity } = await loadIdentity();

    setLiveIdentity({ id: "learner-1", email: "learner@example.com", name: "Learner Name", role: "student" });

    const first = getLiveIdentity();
    const second = getLiveIdentity();
    expect(first).toBe(second);
    expect(first).toEqual({ id: "learner-1", email: "learner@example.com", name: "Learner Name", role: "student" });
  });

  it("does not notify subscribers for equivalent identity snapshots", async () => {
    const { setLiveIdentity, subscribeToIdentity } = await loadIdentity();
    const listener = vi.fn();
    subscribeToIdentity(listener);

    setLiveIdentity({ id: "learner-1", email: "learner@example.com", name: "Learner Name", role: "student" });
    setLiveIdentity({ id: "learner-1", email: "learner@example.com", name: "Learner Name", role: "student" });
    setLiveIdentity({ id: "learner-1", email: "learner@example.com", name: "Learner Name", role: "student", avatarUrl: undefined });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify subscribers for equivalent signed-out snapshots", async () => {
    const { setLiveIdentity, subscribeToIdentity } = await loadIdentity();
    const listener = vi.fn();
    subscribeToIdentity(listener);

    setLiveIdentity(null);
    setLiveIdentity(null);

    expect(listener).not.toHaveBeenCalled();
  });
});
