export const dynamic = "force-dynamic";

import { requireServerSession } from "@/lib/auth/server-guard";

export default async function Page() {
  await requireServerSession();
  return (
    <iframe
      src="/learning-schedule-exact.html"
      title="Tutoria Full Schedule"
      style={{ width: "100%", height: "100dvh", border: 0, display: "block" }}
    />
  );
}
