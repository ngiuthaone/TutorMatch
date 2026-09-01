export const dynamic = "force-dynamic";

import { requireServerSession } from "@/lib/auth/server-guard";
import { ContentStubBanner } from "@/components/content-stubs/content-stub-banner";
import MessagesClient from "./messages-client";

export default async function Page() {
  await requireServerSession();
  return (
    <>
      <ContentStubBanner surface="messages" />
      <MessagesClient />
    </>
  );
}
