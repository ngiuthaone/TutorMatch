import { describe, expect, it } from "vitest";

import { validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("accepts a strong, matching password", () => {
    expect(validateNewPassword("correct-horse-battery", "correct-horse-battery")).toBeNull();
  });

  it("rejects passwords shorter than 12 characters", () => {
    expect(validateNewPassword("short123", "short123")).toMatch(/at least 12 characters/);
  });

  it("rejects mismatched confirmation", () => {
    expect(validateNewPassword("correct-horse-battery", "different-password")).toMatch(/do not match/);
  });
});
