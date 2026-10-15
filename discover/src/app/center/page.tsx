export const dynamic = "force-dynamic";

import { isLiveMode } from "@/lib/auth/config";
import { requireServerSession } from "@/lib/auth/server-guard";
import Client from "./page-client";

export default async function Page() {
  if (!isLiveMode()) {
    return <Client />;
  }
  await requireServerSession();
  return <Client />;
}
