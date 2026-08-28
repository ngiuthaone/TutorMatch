export function createSessionManager({ client, apiClient }) {
  let state = Object.freeze({ status: "initializing", session: null, profile: null, safeErrorCode: null });
  let initialized = false, generation = 0, subscription = null; const listeners = new Set();
  const emit = (next) => { state = Object.freeze(next); listeners.forEach((listener) => listener(state)); };
  async function synchronize(session, attempt = 0) {
    const current = ++generation;
    if (!session?.access_token) { emit({ status: "anonymous", session: null, profile: null, safeErrorCode: null }); return state; }
    try {
      const profile = await apiClient.getMe(session.access_token);
      if (current !== generation) return state;
      emit({ status: "authenticated", session, profile, safeErrorCode: null }); return state;
    } catch (error) {
      if (current !== generation) return state;
      if (error.code === "UNAUTHORIZED" && attempt === 0) {
        try {
          const refreshed = await client.auth.refreshSession();
          if (refreshed.data?.session) return synchronize(refreshed.data.session, 1);
          await client.auth.signOut();
        } catch { /* Fail closed below without exposing provider details. */ }
      }
      const status = error.code === "SERVICE_UNAVAILABLE" || error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" ? "service_unavailable" : "error";
      emit({ status, session: null, profile: null, safeErrorCode: error.code || "INTERNAL_ERROR" }); return state;
    }
  }
  async function initialize() {
    if (initialized) return state; initialized = true;
    try {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") { generation++; emit({ status: "password_recovery", session, profile: null, safeErrorCode: null }); return; }
        queueMicrotask(() => void synchronize(session));
      });
      subscription = data.subscription;
      const result = await client.auth.getSession();
      if (result.error) throw new Error("SESSION_UNAVAILABLE");
      return synchronize(result.data?.session || null);
    } catch { emit({ status: "service_unavailable", session: null, profile: null, safeErrorCode: "SERVICE_UNAVAILABLE" }); return state; }
  }
  return Object.freeze({ initialize, synchronize, getState: () => state, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, invalidate() { generation++; emit({ status: "anonymous", session: null, profile: null, safeErrorCode: null }); }, destroy() { subscription?.unsubscribe(); listeners.clear(); initialized = false; } });
}
