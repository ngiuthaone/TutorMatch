export const dynamic = "force-dynamic";

import { requireServerSession } from "@/lib/auth/server-guard";
import Client from "./page-client";

interface PageProps {
  params: { id: string };
}

export default async function Page({ params }: PageProps) {
  await requireServerSession();
  return <Client {...params} />;
}
