import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const browseHtml = readFileSync(new URL("../../public/browse-tutors.html", import.meta.url), "utf8");
const discoverHome = readFileSync(new URL("../components/discover/discover-home.tsx", import.meta.url), "utf8");
const fixtureScript = readFileSync(new URL("../../../backend/scripts/seed-local-core-fixtures.ts", import.meta.url), "utf8");

function quotedNames(source: string): string[] {
  return [...source.matchAll(/name:\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

describe("local Tutor route catalog", () => {
  it("backs every active local Tutor card with a deterministic public fixture", () => {
    const visibleNames = [...new Set([...quotedNames(browseHtml), ...quotedNames(discoverHome)])];
    const fixtureNames = new Set(quotedNames(fixtureScript));

    expect(visibleNames.length).toBeGreaterThan(2);
    expect(visibleNames.filter((name) => !fixtureNames.has(name))).toEqual([]);
  });
});
