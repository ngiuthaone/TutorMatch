import type { AuthService, AuthenticationResult, ProfileResult } from "../../src/services/auth-service.js";

export class FakeAuthService implements AuthService {
  authCalls = 0; profileCalls = 0;
  authentication: AuthenticationResult = { status: "invalid" };
  profile: ProfileResult = { status: "not_found" };
  async validateAccessToken(): Promise<AuthenticationResult> { this.authCalls++; return this.authentication; }
  async getOwnProfile(): Promise<ProfileResult> { this.profileCalls++; return this.profile; }
}
