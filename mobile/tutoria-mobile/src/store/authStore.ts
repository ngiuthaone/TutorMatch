import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { setAuthTokenGetter, setApiBaseUrlGetter } from "../../shared/api/client";

interface AuthState {
  user: { id: string; name: string; email: string; avatarUrl?: string; role?: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthState["user"], accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
  hydrate: () => Promise<void>;
}

const secureStorage = {
  getItem: async (name: string) => await SecureStore.getItemAsync(name),
  setItem: async (name: string, value: string) => await SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => await SecureStore.deleteItemAsync(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
        setAuthTokenGetter(() => Promise.resolve(accessToken));
      },
      clearAuth: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        setAuthTokenGetter(() => Promise.resolve(null));
      },
      setAccessToken: (accessToken) => {
        set({ accessToken, isAuthenticated: true });
        setAuthTokenGetter(() => Promise.resolve(accessToken));
      },
      hydrate: async () => {
        // Already hydrated by persist middleware
      },
    }),
    {
      name: "tutoria-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          setAuthTokenGetter(() => Promise.resolve(state.accessToken));
        }
      },
    }
  )
);

// Initialize API base URL
import { setApiBaseUrlGetter } from "../../shared/api/client";
setApiBaseUrlGetter(() => Promise.resolve(process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.tutoria.dev"));
