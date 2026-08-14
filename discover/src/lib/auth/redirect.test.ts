import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("keeps internal absolute paths", () => {
    expect(safeRedirectPath("/discover")).toBe("/discover");
    expect(safeRedirectPath("/learning/schedule")).toBe("/learning/schedule");
    expect(safeRedirectPath("/auth/sign-in?next=%2Fmessages")).toBe("/auth/sign-in?next=%2Fmessages");
  });

  it("falls back for missing or malformed values", () => {
    expect(safeRedirectPath(undefined)).toBe("/discover");
    expect(safeRedirectPath(null)).toBe("/discover");
    expect(safeRedirectPath("")).toBe("/discover");
  });

  it("rejects open-redirect vectors", () => {
    expect(safeRedirectPath("https://evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("http://evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("//evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("/\\evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/discover");
    expect(safeRedirectPath("javascript%3Aalert(1)")).toBe("/discover");
  });

  it("rejects control characters that URL parsers strip into //host", () => {
    expect(safeRedirectPath("/\n//evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("/\r//evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("/\t//evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("/\u0001//evil.example.com")).toBe("/discover");
    expect(safeRedirectPath("/\u007f//evil.example.com")).toBe("/discover");
  });

  it("uses the first element of an array value", () => {
    expect(safeRedirectPath(["/learning", "/discover"])).toBe("/learning");
    expect(safeRedirectPath([], "/auth/sign-in")).toBe("/auth/sign-in");
  });

  it("honors an explicit fallback", () => {
    expect(safeRedirectPath("https://evil.example.com", "/auth/sign-in")).toBe("/auth/sign-in");
  });
});
