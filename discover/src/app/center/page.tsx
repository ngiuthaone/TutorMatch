export const dynamic = "force-dynamic";

import { requireServerSession } from "@/lib/auth/server-guard";
import Client from "./page-client";

export default async function Page(props: any) {
  await requireServerSession();
  return <Client {...props} />;
}
