export interface UserIdentity {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
  roles?: string[];
  completed?: boolean;
}

export interface TutoriaConfig {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  authCallbackUrl: string;
  demoMode: boolean;
  environment: "development" | "test" | "staging" | "production";
  useBffAuth: boolean;
}

export type TutoriaEnvironment = "development" | "test" | "staging" | "production";

export interface ApiError {
  code: string;
  status: number;
  message: string;
}

export class TutoriaApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "TutoriaApiError";
    this.code = code;
    this.status = status;
  }
}
