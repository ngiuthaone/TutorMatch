import { redirect } from "next/navigation";
import { getServerSession, type ServerSession } from "./get-server-session";

export async function requireServerSession(returnTo?: string): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) {
    const ret = returnTo ? `?return=${encodeURIComponent(returnTo)}` : "";
    redirect(`/sign-in${ret}`);
  }
  return session;
}
