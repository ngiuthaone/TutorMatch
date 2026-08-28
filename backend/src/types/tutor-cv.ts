export const PUBLIC_DISCLOSURE = "Tutoria has not verified this tutor’s identity, education, or experience. Information on this profile is provided by the tutor.";
export type ServiceResult<T> = { status: "ok"; data: T } | { status: "not_found" | "forbidden" | "conflict" | "invalid" | "incomplete" | "unavailable"; fields?: Record<string, string> };
export interface TutorCvService {
  getOwn(token: string): Promise<ServiceResult<unknown | null>>;
  saveOwn(token: string, profile: unknown, expectedVersion: number | null): Promise<ServiceResult<unknown>>;
  publishOwn(token: string, expectedVersion: number): Promise<ServiceResult<unknown>>;
  unpublishOwn(token: string, expectedVersion: number): Promise<ServiceResult<unknown>>;
  listPublic(filters: Record<string, unknown>): Promise<ServiceResult<unknown>>;
  getPublic(id: string): Promise<ServiceResult<unknown>>;
}
