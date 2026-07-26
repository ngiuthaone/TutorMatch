import type { Profile } from "../schemas/profile.js";

export type AuthenticatedUser = { id: string; email: string | null };
export type AuthenticationResult =
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "invalid" }
  | { status: "unavailable" };
export type ProfileResult =
  | { status: "found"; profile: Profile }
  | { status: "not_found" }
  | { status: "invalid_data" }
  | { status: "unavailable" };
export interface AuthService {
  validateAccessToken(token: string): Promise<AuthenticationResult>;
  getOwnProfile(token: string, userId: string): Promise<ProfileResult>;
}
