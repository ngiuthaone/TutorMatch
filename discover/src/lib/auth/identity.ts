export interface LiveIdentity {
  id: string;
  email: string | null;
  name: string;
  role?: string;
  avatarUrl?: string;
}

let identity: LiveIdentity | null = null;
const listeners = new Set<() => void>();

export function setLiveIdentity(next: LiveIdentity | null): void {
  identity = next ? { ...next } : null;
  listeners.forEach((listener) => listener());
}

export function getLiveIdentity(): LiveIdentity | null {
  return identity ? { ...identity } : null;
}

export function subscribeToIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
