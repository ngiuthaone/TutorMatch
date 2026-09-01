import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());
const refreshSessionMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const resendMock = vi.hoisted(() => vi.fn());
const onAuthStateChangeMock = vi.hoisted(() => vi.fn());
const getMeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/supabase-client", () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      getSession: getSessionMock,
      refreshSession: refreshSessionMock,
      signOut: signOutMock,
      resend: resendMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  }),
}));

vi.mock("@/lib/auth/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/api-client")>();
  return { ...actual, getApiClient: () => ({ getMe: getMeMock }) };
});

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: "access-token-1",
    refresh_token: "refresh-token-1",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      email: "learner@example.com",
      aud: "authenticated",
      app_metadata: {},
      user_metadata: { display_name: "Learner Name" },
      created_at: "2026-08-01T00:00:00Z",
    },
    ...overrides,
  };
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    email: "learner@example.com",
    role: "student",
    name: "Learner Name",
    phone: null,
    avatarUrl: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

async function loadSession() {
  return await import("./session");
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk_test_123");
  vi.stubEnv("NEXT_PUBLIC_TUTORIA_API_BASE_URL", "https://api.tutoria.example.com");
  vi.stubEnv("NEXT_PUBLIC_TUTORIA_DEMO_MODE", "false");
  vi.stubEnv("NEXT_PUBLIC_TUTORIA_AUTH_CALLBACK_URL", "http://127.0.0.1:3456/auth/callback");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session error mapping", () => {
  it("maps common Supabase auth errors to safe user-facing codes", async () => {
    const { mapAuthError } = await loadSession();
    expect(mapAuthError({ message: "Invalid login credentials", status: "400" })).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Incorrect email or password.",
    });
    expect(mapAuthError({ code: "email_not_confirmed", message: "provider wording changed", status: 400 })).toMatchObject({ code: "EMAIL_NOT_CONFIRMED" });
    expect(mapAuthError({ message: "User already registered", status: "400" })).toMatchObject({ code: "EMAIL_TAKEN" });
    expect(mapAuthError({ message: "Password should be at least 6 characters", status: "400" })).toMatchObject({
      code: "WEAK_PASSWORD",
    });
    expect(mapAuthError({ message: "Request rate limit reached", status: "429" })).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("never leaks raw provider error details to the user", async () => {
    const { mapAuthError } = await loadSession();
    const mapped = mapAuthError({ message: "jwt expired supabase internal detail: xyz", status: "401" });
    expect(mapped.code).toBe("401");
    expect(mapped.message).toBe("Authentication failed. Try again.");
    expect(mapped.message).not.toContain("jwt");
    expect(mapped.message).not.toContain("supabase");
    expect(mapAuthError({ message: "unrecognized failure" }).code).toBe("AUTH_ERROR");
  });
});

describe("signInWithPassword", () => {
  it("signs in and emits an authenticated state using the verified profile", async () => {
    const { signInWithPassword, getSessionSnapshot } = await loadSession();
    signInWithPasswordMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getSessionMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getMeMock.mockResolvedValue(makeProfile({ role: "tutor", name: "Tutor Name" }));

    await signInWithPassword("learner@example.com", "secret");

    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "learner@example.com", password: "secret" });
    const snapshot = getSessionSnapshot();
    expect(snapshot.status).toBe("authenticated");
    if (snapshot.status === "authenticated") {
      expect(snapshot.user.role).toBe("tutor");
      expect(snapshot.user.name).toBe("Tutor Name");
    }
  });

  it("rejects with a safe mapped error for invalid credentials", async () => {
    const { signInWithPassword } = await loadSession();
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials", status: "400" },
    });

    await expect(signInWithPassword("learner@example.com", "wrong")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Incorrect email or password.",
    });
  });

  it("does not mark the session authenticated when sign-in fails", async () => {
    const { signInWithPassword, getSessionSnapshot } = await loadSession();
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials", status: "400" },
    });

    await expect(signInWithPassword("learner@example.com", "wrong")).rejects.toBeDefined();
    expect(getSessionSnapshot().status).toBe("initializing");
  });

  it("maps Supabase's stable unconfirmed-email code without creating a session", async () => {
    const { signInWithPassword, getSessionSnapshot } = await loadSession();
    signInWithPasswordMock.mockResolvedValue({ data: { session: null }, error: { name: "AuthApiError", status: 400, code: "email_not_confirmed", message: "Email not confirmed" } });
    await expect(signInWithPassword("unverified@example.com", "secret")).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIRMED" });
    expect(getSessionSnapshot().status).toBe("initializing");
  });
});

describe("email verification", () => {
  it("resends confirmation through Supabase with a safe booking return path", async () => {
    const { resendSignupConfirmation, ensureSession } = await loadSession();
    getSessionMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    onAuthStateChangeMock.mockImplementation(() => ({ data: { subscription: { unsubscribe: () => {} } } }));
    getMeMock.mockResolvedValue(makeProfile());
    resendMock.mockResolvedValue({ data: {}, error: null });
    await ensureSession();
    await resendSignupConfirmation("/tutor/Thu%20Ha?bookingSessionId=11111111-1111-4111-8111-111111111111&bookingStep=review");
    expect(resendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "signup",
      email: "learner@example.com",
      options: { emailRedirectTo: expect.stringContaining("next=%2Ftutor%2FThu%2520Ha") },
    }));
  });
});

describe("ensureSession", () => {
  it("restores an anonymous state when no session exists", async () => {
    const { ensureSession, getSessionSnapshot } = await loadSession();
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    onAuthStateChangeMock.mockImplementation(() => ({ data: { subscription: { unsubscribe: () => {} } } }));

    await ensureSession();

    expect(getSessionSnapshot().status).toBe("anonymous");
  });

  it("restores an authenticated state from a persisted session and profile", async () => {
    const { ensureSession, getSessionSnapshot } = await loadSession();
    getSessionMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    onAuthStateChangeMock.mockImplementation(() => ({ data: { subscription: { unsubscribe: () => {} } } }));
    getMeMock.mockResolvedValue(makeProfile());

    await ensureSession();

    const snapshot = getSessionSnapshot();
    expect(snapshot.status).toBe("authenticated");
    if (snapshot.status === "authenticated") {
      expect(snapshot.user.email).toBe("learner@example.com");
      expect(snapshot.profileErrorCode).toBeNull();
    }
  });

  it("keeps the live identity snapshot stable across equivalent auth notifications", async () => {
    const { ensureSession } = await loadSession();
    const { getLiveIdentity, subscribeToIdentity } = await import("./identity");
    let authCallback: (event: string, session: Session | null) => void = () => {
      throw new Error("auth state listener was not registered");
    };
    const session = makeSession();
    const listener = vi.fn();

    getSessionMock.mockResolvedValue({ data: { session }, error: null });
    onAuthStateChangeMock.mockImplementation((callback: (event: string, session: Session | null) => void) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: () => {} } } };
    });
    getMeMock.mockResolvedValue(makeProfile());
    subscribeToIdentity(listener);

    await ensureSession();

    const first = getLiveIdentity();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(first).not.toBeNull();

    authCallback("SIGNED_IN", makeSession());
    await flushPromises();

    expect(getMeMock).toHaveBeenCalledTimes(2);
    expect(getLiveIdentity()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("refreshes the session once and re-synchronizes when profile verification is unauthorized", async () => {
    const { ensureSession, getSessionSnapshot } = await loadSession();
    const session = makeSession();
    const refreshed = makeSession({ access_token: "access-token-2" });
    const { ApiClientError } = await import("@/lib/auth/api-client");
    getSessionMock.mockResolvedValue({ data: { session }, error: null });
    onAuthStateChangeMock.mockImplementation(() => ({ data: { subscription: { unsubscribe: () => {} } } }));
    refreshSessionMock.mockResolvedValue({ data: { session: refreshed }, error: null });
    getMeMock
      .mockRejectedValueOnce(new ApiClientError("UNAUTHORIZED", 401))
      .mockResolvedValueOnce(makeProfile());

    await ensureSession();

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    const snapshot = getSessionSnapshot();
    expect(snapshot.status).toBe("authenticated");
    if (snapshot.status === "authenticated") {
      expect(snapshot.session.access_token).toBe("access-token-2");
    }
  });
});

describe("signUpWithPassword", () => {
  it("writes compatible name + display_name sign-up metadata (no role) and reports email confirmation", async () => {
    const { signUpWithPassword, getSessionSnapshot } = await loadSession();
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });

    const result = await signUpWithPassword("new@example.com", "password-123", "New User");

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        password: "password-123",
        options: expect.objectContaining({
          data: { name: "New User", display_name: "New User" },
        }),
      }),
    );
    // Neither metadata field may carry role/authorization authority.
    const metadata = signUpMock.mock.calls[0][0].options.data;
    expect(metadata.name).toBe("New User");
    expect(metadata.display_name).toBe("New User");
    expect(metadata).not.toHaveProperty("role");
    expect(result.needsConfirmation).toBe(true);
    expect(getSessionSnapshot().status).toBe("initializing");
  });

  it("trims whitespace into both name keys; empty input stays empty (frozen trigger falls back to email local-part)", async () => {
    const { signUpWithPassword } = await loadSession();
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });

    await signUpWithPassword("new@example.com", "password-123", "  Ada Nguyen  ");
    expect(signUpMock.mock.calls[0][0].options.data).toEqual({ name: "Ada Nguyen", display_name: "Ada Nguyen" });

    signUpMock.mockClear();
    await signUpWithPassword("new@example.com", "password-123", "   ");
    expect(signUpMock.mock.calls[0][0].options.data).toEqual({ name: "", display_name: "" });
  });

  it("synchronizes immediately when sign-up returns a session", async () => {
    const { signUpWithPassword, getSessionSnapshot } = await loadSession();
    signUpMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getSessionMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getMeMock.mockResolvedValue(makeProfile());

    const result = await signUpWithPassword("new@example.com", "password-123", "New User");

    expect(result.needsConfirmation).toBe(false);
    expect(getSessionSnapshot().status).toBe("authenticated");
  });
});

describe("identity derivation", () => {
  it("derives a trimmed display name from user metadata before the profile loads", async () => {
    const { userFromSessionForTests } = await loadSession();
    const session = makeSession({
      user: { ...makeSession().user, user_metadata: { display_name: "  Custom Name  " } },
    });
    expect(userFromSessionForTests(session).name).toBe("Custom Name");
    expect(userFromSessionForTests(session).role).toBe("student");
  });
});

describe("signOutLive", () => {
  it("signs out and clears the live session state", async () => {
    const { signInWithPassword, signOutLive, getSessionSnapshot } = await loadSession();
    signInWithPasswordMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getSessionMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getMeMock.mockResolvedValue(makeProfile());
    signOutMock.mockResolvedValue({ error: null });

    await signInWithPassword("learner@example.com", "secret");
    expect(getSessionSnapshot().status).toBe("authenticated");

    await signOutLive();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(getSessionSnapshot().status).toBe("anonymous");
  });

  it("does not emit duplicate live identity notifications for repeated sign-out", async () => {
    const { signInWithPassword, signOutLive } = await loadSession();
    const { subscribeToIdentity } = await import("./identity");
    const listener = vi.fn();
    signInWithPasswordMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getSessionMock.mockResolvedValue({ data: { session: makeSession() }, error: null });
    getMeMock.mockResolvedValue(makeProfile());
    signOutMock.mockResolvedValue({ error: null });
    subscribeToIdentity(listener);

    await signInWithPassword("learner@example.com", "secret");
    await signOutLive();
    await signOutLive();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });
});
