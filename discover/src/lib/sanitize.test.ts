import { describe, expect, it } from "vitest";

import { sanitizePlainHtml, sanitizeRichHtml } from "@/lib/sanitize";

describe("sanitizeRichHtml (SSR regex fallback)", () => {
  it("strips script blocks with their content", () => {
    expect(sanitizeRichHtml("<p>ok</p><script>alert(1)</script><p>after</p>")).toBe(
      "<p>ok</p><p>after</p>",
    );
  });

  it("strips event handlers", () => {
    expect(sanitizeRichHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
  });

  it("strips javascript: and data: URLs on href/src", () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">click</a>').toLowerCase()).not.toContain(
      "javascript:",
    );
    expect(sanitizeRichHtml('<img src="data:text/html,x">')).not.toContain("data:");
  });

  it("preserves ordinary allowed markup", () => {
    expect(sanitizeRichHtml("<h2>Title</h2><p>Body <strong>bold</strong></p>")).toBe(
      "<h2>Title</h2><p>Body <strong>bold</strong></p>",
    );
  });

  it("returns empty string for blank input", () => {
    expect(sanitizeRichHtml("   ")).toBe("");
    expect(sanitizeRichHtml("")).toBe("");
  });
});

describe("sanitizePlainHtml", () => {
  it("keeps only plain text, paragraphs and breaks", () => {
    expect(sanitizePlainHtml("<p>Hello <strong>world</strong></p>")).not.toContain("strong");
    expect(sanitizePlainHtml("a<br>b")).toContain(" ");
  });
});