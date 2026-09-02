import { redirect } from "next/navigation";
import { getRuntimeConfig } from "./config";
import { getServerSession, type ServerSession } from "./get-server-session";

/**
 * Server-side gate for private pages.
 *
 * Cookie sessions only exist when BFF auth is enabled. The live deployment uses
 * localStorage-based Supabase auth (`useBffAuth=false`), so no cookie session
 * is ever visible to the server; an unconditional redirect would bounce every
 * signed-in user to a sign-in page. In that mode we defer to the page's own
 * client-side auth gate, which is authoritative for the session it restored.
 */
export async function requireServerSession(returnTo?: string): Promise<ServerSession | null> {
  if (!getRuntimeConfig().useBffAuth) {
    return null;
  }
  const session = await getServerSession();
  if (!session) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/auth/sign-in${next}`);
  }
  return session;
}
