import { readRuntimeConfig } from "./config.js";
import { getSupabaseClient } from "./supabase-client.js";
import { createApiClient } from "./api-client.js";
import { createAuthService } from "./auth-service.js";
import { callbackCode, routeForRole } from "./redirect-policy.js";
import { guardRoute } from "./route-guard.js";
import { createSessionManager } from "./session-manager.js";
import { createAuthUI } from "../auth-ui/auth-ui.js";
import { createTutorCvUI } from "../tutor-cv-ui.js";

let facade;
try {
  const config = readRuntimeConfig(window);
  if (config.demoMode) {
    facade = Object.freeze({ isDemoMode: true, initialize: async () => ({ status: "anonymous" }), getState: () => ({ status: "anonymous", profile: null }), subscribe: () => () => {}, ownsRoute: () => false, renderRoute: () => {}, getProfile: () => null, isAuthenticated: () => false, canAccessRoute: () => true, signOut: async () => {}, getAccessToken: () => null });
  } else {
    const client = getSupabaseClient(config), apiClient = createApiClient({ apiBaseUrl: config.apiBaseUrl }), manager = createSessionManager({ client, apiClient });
    const callbackUrl = config.authCallbackUrl, service = createAuthService({ client, callbackUrl });
    const ui = createAuthUI({ authService: service, manager, navigate: (hash) => { location.hash = hash; } });
    async function initialize() {
      if (location.pathname === "/auth/callback") {
        await manager.initialize();
        try {
          const code = callbackCode(location, callbackUrl); const result = await service.exchangeCode(code);
          history.replaceState({}, "", "/#/auth/sign-in");
          if (result.error) throw new Error("INVALID_CALLBACK");
          await new Promise((resolve) => setTimeout(resolve, 0));
          const callbackState = manager.getState().status === "password_recovery" ? manager.getState() : await manager.synchronize(result.data?.session || null);
          location.hash = callbackState.status === "password_recovery" ? "#/auth/update-password" : callbackState.status === "authenticated" ? routeForRole(callbackState.profile.role) : "#/auth/sign-in";
          return callbackState;
        } catch { history.replaceState({}, "", "/#/auth/sign-in"); return manager.getState(); }
      }
      const state = await manager.initialize();
      return state;
    }
    const publicState = () => { const state = manager.getState(); return Object.freeze({ status: state.status, profile: state.profile, safeErrorCode: state.safeErrorCode }); };
    facade = Object.freeze({ isDemoMode: false, initialize, getState: publicState, subscribe(listener) { return manager.subscribe(() => listener(publicState())); },
      ownsRoute: (hash) => manager.getState().status === "initializing" || /^#\/auth\//.test(hash), renderRoute: (container, hash) => ui.render(container, hash, manager.getState()),
      getProfile: () => manager.getState().profile, isAuthenticated: () => manager.getState().status === "authenticated",
      canAccessRoute: (hash) => guardRoute(hash, manager.getState()),
      async signOut() { manager.invalidate(); await service.signOut(); location.hash = "#/auth/sign-in"; },
      getAccessToken: () => manager.getState().session?.access_token || null,
      refreshProfile: () => manager.synchronize(manager.getState().session)
    });
  }
} catch {
  const state = Object.freeze({ status: "configuration_error", profile: null, safeErrorCode: "CONFIGURATION_ERROR" });
  facade = Object.freeze({ isDemoMode: false, initialize: async () => state, getState: () => state, subscribe: () => () => {}, ownsRoute: () => true,
    renderRoute(container) { container.replaceChildren(); const main = document.createElement("main"), heading = document.createElement("h1"), text = document.createElement("p"); main.className = "auth-page"; heading.textContent = "Tutoria is temporarily unavailable"; text.textContent = "Authentication configuration could not be loaded safely."; main.append(heading, text); container.append(main); },
    getProfile: () => null, isAuthenticated: () => false, canAccessRoute: () => ({ allowed: false, reason: "configuration_error" }), signOut: async () => {}, getAccessToken: () => null });
}
Object.defineProperty(window, "TutoriaAuth", { value: facade, writable: false, configurable: false });
Object.defineProperty(window, "TutoriaTutorCv", { value: createTutorCvUI(), writable: false, configurable: false });
