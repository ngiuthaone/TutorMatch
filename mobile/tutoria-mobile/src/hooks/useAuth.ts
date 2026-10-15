import { useAuthStore } from "../store/authStore";
import { useEffect } from "react";

export function useAuth() {
  const { user, accessToken, isAuthenticated, setAuth, clearAuth, setAccessToken, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = async (email: string, password: string) => {
    // TODO: Implement actual login API call
    // const response = await fetch(...);
    // const { user, accessToken, refreshToken } = await response.json();
    // setAuth(user, accessToken, refreshToken);
  };

  const logout = () => {
    clearAuth();
  };

  return { user, accessToken, isAuthenticated, login, logout, setAccessToken };
}
