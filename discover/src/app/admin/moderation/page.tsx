export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/get-server-session";
import ModerationQueue from "./moderation-queue";
import ConversationReportsQueue from "./conversation-reports-queue";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; reportStatus?: string; tab?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/auth/sign-in?next=%2Fadmin%2Fmoderation");
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
  const validMediaStatus = ["pending", "approved", "rejected", "removed", "all"] as const;
  const validReportStatus = ["pending", "resolved", "dismissed", "all"] as const;
  const mediaStatus = (validMediaStatus as readonly string[]).includes(params.status ?? "") ? params.status! : "pending";
  const reportStatus = (validReportStatus as readonly string[]).includes(params.reportStatus ?? "") ? params.reportStatus! : "pending";
  const activeTab = params.tab ?? "media";

  const mediaHref = `/admin/moderation?tab=media&status=${mediaStatus}&reportStatus=${reportStatus}`;
  const reportsHref = `/admin/moderation?tab=conversation-reports&status=${mediaStatus}&reportStatus=${reportStatus}`;

  return (
    <main className="min-h-[100dvh] bg-[#101011] px-5 py-16 text-[#e8e6df] sm:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/40">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Moderation</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
          Review and moderate user-generated content.
        </p>
        <nav className="mt-8 flex gap-2 text-sm" aria-label="Moderation type">
          <button
            type="button"
            onClick={() => window.location.href = mediaHref}
            className={`rounded-full border px-3 py-1 text-sm ${activeTab === "media" ? "border-white/70 bg-white text-[#101011]" : "border-white/15 bg-transparent text-white/70 hover:border-white/40"}`}
          >
            Media
          </button>
          <button
            type="button"
            onClick={() => window.location.href = reportsHref}
            className={`rounded-full border px-3 py-1 text-sm ${activeTab === "conversation-reports" ? "border-white/70 bg-white text-[#101011]" : "border-white/15 bg-transparent text-white/70 hover:border-white/40"}`}
          >
            Conversation Reports
          </button>
        </nav>
        {activeTab === "media" ? (
          <ModerationQueue initialStatus={mediaStatus} adminEmail={session.user.email} />
        ) : (
          <ConversationReportsQueue initialStatus={reportStatus} />
        )}
      </div>
    </main>
  );
}
