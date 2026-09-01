export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/get-server-session";
import ModerationQueue from "./moderation-queue";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?return=%2Fadmin%2Fmoderation");
  if (session.user.role !== "admin") {
    return (
      <main className="min-h-[100dvh] bg-[#101011] px-5 py-16 text-[#e8e6df] sm:px-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/40">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Admin access required</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
            The moderation queue is restricted to admin accounts. Sign in with an admin account or contact the workspace owner.
          </p>
        </div>
      </main>
    );
  }
  const params = await searchParams;
  const valid = ["pending", "approved", "rejected", "removed", "all"] as const;
  const requested = params.status ?? "pending";
  const status = (valid as readonly string[]).includes(requested) ? requested : "pending";
  return <ModerationQueue initialStatus={status} adminEmail={session.user.email} />;
}
