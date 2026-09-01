import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const courseCreatorHtml = readFileSync(resolve(process.cwd(), "public/course-creator-reference.html"), "utf8");
const courseNewPage = readFileSync(resolve(process.cwd(), "src/app/courses/new/page.tsx"), "utf8");

describe("Course creator iframe ?apiBaseUrl= bootstrap", () => {
  it("appends ?apiBaseUrl=<encoded> when live mode is active", () => {
    expect(courseNewPage).toContain("isLiveMode()");
    expect(courseNewPage).toContain("getApiBaseUrl()");
    expect(courseNewPage).toContain("apiBaseUrl=${encodeURIComponent(apiBase)}");
  });

  it("preserves any existing query string before the apiBaseUrl parameter", () => {
    expect(courseNewPage).toContain("window.location.search");
    expect(courseNewPage).toContain("existingSearch ? `&${apiBaseParam}` : `?${apiBaseParam}`");
  });

  it("falls back to the bare path with no apiBaseUrl in demo mode", () => {
    expect(courseNewPage).toContain("return \"/course-creator-reference.html\"");
    expect(courseNewPage).toContain("const apiBaseParam = apiBase ? `apiBaseUrl=${encodeURIComponent(apiBase)}` : \"\"");
  });

  it("mirrors the event-creator-reference.html bootstrap shape (reads apiBaseUrl from window.location.search)", () => {
    expect(courseCreatorHtml).toContain("params.get('apiBaseUrl')");
    // Live mode branch in the iframe must check both the URL hint and the parent frame, in that order.
    expect(courseCreatorHtml).toContain("apiBase&&window.parent&&window.parent!==window");
  });

  it("uses window.location.origin as the parent reply targetOrigin (stricter than the event-side '*')", () => {
    // Parent bridge replies stay same-origin; the event-side '*' pattern is not copied.
    expect(courseNewPage).toContain("postMessage({ type: \"tutoria-course-parent-ready\" }, window.location.origin)");
    expect(courseNewPage).toContain("postMessage({ type: \"tutoria-course-published\", requestId, item }, window.location.origin)");
    expect(courseNewPage).toContain("postMessage({ type: \"tutoria-course-publish-error\", requestId, code: apiError.code, message: apiError.message }, window.location.origin)");
    // Negative: never post '*' from this bridge.
    expect(courseNewPage).not.toContain("postMessage(..., \"*\")");
  });

  it("SSR-safe: returns the bare path when window is undefined", () => {
    expect(courseNewPage).toContain("if (typeof window === \"undefined\") return \"/course-creator-reference.html\"");
  });

  it("derives frameSrc from useState initializer (not inside useEffect), avoiding cascading renders", () => {
    // The bootstrap is computed once on first render, not re-set inside the message effect.
    expect(courseNewPage).toContain("useState<string>(() => {");
    expect(courseNewPage).not.toContain("setFrameSrc((prev) =>");
  });
});