import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  InMemoryRateLimiter,
  isSafeHttpUrl,
  maxLength,
  sanitizeHtmlText,
  sanitizeTree,
} from "@/lib/api-security";

describe("sanitizeHtmlText", () => {
  it("strips script, iframe, and other dangerous tags", () => {
    expect(sanitizeHtmlText('hello <script>alert(1)</script> <iframe src="x"></iframe> world')).toBe(
      "hello   world",
    );
  });

  it("removes event handler attributes", () => {
    expect(sanitizeHtmlText('<img src="x" onerror="alert(1)" onload=evil()>')).toBe('<img src="x">');
  });

  it("removes dangerous URL protocols", () => {
    expect(sanitizeHtmlText('click <a href="javascript:alert(1)">here</a> now')).toBe(
      'click <a href="alert(1)">here</a> now',
    );
  });

  it("caps input length at 100k characters", () => {
    const long = "a".repeat(150_000);
    expect(sanitizeHtmlText(long).length).toBe(100_000);
  });

  it("keeps normal prose intact", () => {
    expect(sanitizeHtmlText("  Just <strong>plain</strong> content.  ")).toBe(
      "Just <strong>plain</strong> content.",
    );
  });
});

describe("sanitizeTree", () => {
  it("sanitizes all string leaves in a nested tree", () => {
    const tree = {
      name: '<script>x</script>ok',
      list: ["<img onerror=bad>"],
      nested: { about: 'a <iframe></iframe> b' },
      count: 7,
    };
    expect(sanitizeTree(tree)).toEqual({
      name: "ok",
      list: ["<img>"],
      nested: { about: "a  b" },
      count: 7,
    });
  });
});

describe("isSafeHttpUrl", () => {
  it("allows https URLs", () => {
    expect(isSafeHttpUrl("https://example.com/a.png")).toBe(true);
  });

  it("rejects http, javascript, and data URLs", () => {
    expect(isSafeHttpUrl("http://example.com")).toBe(false);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,x")).toBe(false);
  });

  it("allows same-origin relative paths but rejects protocol-relative ones", () => {
    expect(isSafeHttpUrl("/assets/a.png")).toBe(true);
    expect(isSafeHttpUrl("./a.png")).toBe(true);
    expect(isSafeHttpUrl("../a.png")).toBe(true);
    expect(isSafeHttpUrl("//evil.com/x")).toBe(false);
  });

  it("rejects malformed strings and empty values are allowed", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(true);
  });
});

describe("maxLength", () => {
  it("checks plain length", () => {
    expect(maxLength("abc", 3)).toBe(true);
    expect(maxLength("abcd", 3)).toBe(false);
  });
});

describe("InMemoryRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the max within a window then refuses", () => {
    const limiter = new InMemoryRateLimiter(3, 10_000);
    expect(limiter.isAllowed("user-1")).toBe(true);
    expect(limiter.isAllowed("user-1")).toBe(true);
    expect(limiter.isAllowed("user-1")).toBe(true);
    expect(limiter.isAllowed("user-1")).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = new InMemoryRateLimiter(1, 10_000);
    expect(limiter.isAllowed("a")).toBe(true);
    expect(limiter.isAllowed("b")).toBe(true);
    expect(limiter.isAllowed("a")).toBe(false);
  });

  it("resets after the window elapses", () => {
    const limiter = new InMemoryRateLimiter(1, 10_000);
    expect(limiter.isAllowed("user-1")).toBe(true);
    expect(limiter.isAllowed("user-1")).toBe(false);
    vi.advanceTimersByTime(10_001);
    expect(limiter.isAllowed("user-1")).toBe(true);
  });
});
