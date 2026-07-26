import { describe, expect, it } from "vitest"; import { guardRoute } from "../../src/auth/route-guard.js";
const anonymous = { status: "anonymous", profile: null }, student = { status: "authenticated", profile: { role: "student" } }, tutor = { status: "authenticated", profile: { role: "tutor" } }, admin = { status: "authenticated", profile: { role: "admin" } };
describe("route guard", () => {
  it.each(["#/student", "#/tutor", "#/admin"])("redirects anonymous %s", (hash) => expect(guardRoute(hash, anonymous)).toMatchObject({ allowed: false, redirect: "#/auth/sign-in" }));
  it("blocks private content while initializing", () => expect(guardRoute("#/student", { status: "initializing" }).reason).toBe("initializing"));
  it.each([["#/tutor", student], ["#/admin", student], ["#/student", tutor], ["#/admin", tutor]])("denies role mismatch %s", (hash, state) => expect(guardRoute(hash, state).reason).toBe("forbidden"));
  it.each([["#/student", student], ["#/tutor/profile", tutor], ["#/admin", admin]])("allows verified role %s", (hash, state) => expect(guardRoute(hash, state).allowed).toBe(true));
  it("does not consult browser storage", () => { Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("storage must not be read"); } }); expect(guardRoute("#/admin", student).allowed).toBe(false); delete globalThis.localStorage; });
  it("keeps public routes public", () => expect(guardRoute("#/auth/sign-in", anonymous).allowed).toBe(true));
});
