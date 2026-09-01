export const dynamic = "force-dynamic";

import { requireServerSession } from "@/lib/auth/server-guard";
import MessagesClient from "./messages-client";

export default async function Page() {
  await requireServerSession();
  return <MessagesClient />;
}
