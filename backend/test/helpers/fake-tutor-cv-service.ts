import type { ServiceResult, TutorCvService } from "../../src/types/tutor-cv.js";
export class FakeTutorCvService implements TutorCvService {
  calls: Array<{ method: string; args: unknown[] }> = []; result: ServiceResult<unknown> = { status: "ok", data: null };
  private call(method: string, ...args: unknown[]) { this.calls.push({ method, args }); return Promise.resolve(this.result); }
  getOwn(token: string) { return this.call("getOwn", token); } saveOwn(token: string, profile: unknown, version: number | null) { return this.call("saveOwn", token, profile, version); }
  publishOwn(token: string, version: number) { return this.call("publishOwn", token, version); } unpublishOwn(token: string, version: number) { return this.call("unpublishOwn", token, version); }
  listPublic(filters: Record<string, unknown>) { return this.call("listPublic", filters); } getPublic(id: string) { return this.call("getPublic", id); }
}
