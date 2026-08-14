import { describe, expect, it } from "vitest";

import { isRichHtml } from "@/lib/post-body";
import { sanitizeRichHtml } from "@/lib/sanitize";

describe("isRichHtml", () => {
  it("detects HTML bodies", () => {
    expect(isRichHtml("<p>Hello <strong>world</strong></p>")).toBe(true);
    expect(isRichHtml("<ul><li>item</li></ul>")).toBe(true);
  });

  it("treats plain text as not HTML", () => {
    expect(isRichHtml("Golden hour at West Lake today.")).toBe(false);
    expect(isRichHtml("a < b and c > d")).toBe(false);
    expect(isRichHtml("")).toBe(false);
  });
});

describe("post body sanitization integration", () => {
  it("strips script content from rich post bodies", () => {
    expect(
      sanitizeRichHtml("<p>Hello</p><script>alert(1)</script><p>World</p>"),
    ).toBe("<p>Hello</p><p>World</p>");
  });

  it("preserves the allowed TipTap post node set", () => {
    expect(
      sanitizeRichHtml(
        "<h2>Tip</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>one</li></ul><blockquote>quote</blockquote><pre><code>code()</code></pre>",
      ),
    ).toBe(
      "<h2>Tip</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>one</li></ul><blockquote>quote</blockquote><pre><code>code()</code></pre>",
    );
  });

  it("strips javascript: links", () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>').toLowerCase()).not.toContain(
      "javascript:",
    );
  });
});
