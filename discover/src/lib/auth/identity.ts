export interface LiveIdentity {
  id: string;
  email: string | null;
  name: string;
  role?: string;
  avatarUrl?: string;
}

let identity: LiveIdentity | null = null;
const listeners = new Set<() => void>();

function identitiesMatch(left: LiveIdentity | null, right: LiveIdentity | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.id === right.id
    && left.email === right.email
    && left.name === right.name
    && left.role === right.role
    && left.avatarUrl === right.avatarUrl;
}

export function setLiveIdentity(next: LiveIdentity | null): void {
  if (identitiesMatch(identity, next)) return;
  identity = next ? Object.freeze({ ...next }) : null;
  listeners.forEach((listener) => listener());
}

export function getLiveIdentity(): LiveIdentity | null {
  return identity;
}

export function subscribeToIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
