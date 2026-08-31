import { getRuntimeConfig } from './config';

const API_BASE = typeof window !== 'undefined' 
  ? (getRuntimeConfig().apiBaseUrl ?? window.location.origin) 
  : '';

export async function bffSignIn(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function bffRefresh() {
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

export async function bffSignOut() {
  const res = await fetch(`${API_BASE}/api/v1/auth/sign-out`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}
