import { redirect } from "next/navigation";
import { getServerSession, type ServerSession } from "./get-server-session";

export async function requireServerSession(returnTo?: string): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) {
    const ret = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/auth/sign-in${ret}`);
  }
  return session;
}
