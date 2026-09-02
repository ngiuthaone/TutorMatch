// discover/src/app/messages/my-reports/page.tsx
//
// User-facing list of conversation reports the caller has submitted.
// Shows status (pending/resolved/dismissed) so users can see whether
// moderation acted on their report.

import { getSupabaseClient } from "@/lib/auth/supabase-client";

export const dynamic = "force-dynamic";

type Report = {
  id: string;
  reporter_id: string;
  conversation_id: string;
  message_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export default async function MyReportsPage() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return (
      <main className="min-h-[100dvh] bg-[#080809] p-6 text-[#f4f4f2]">
        <h1 className="text-lg font-medium">My reports</h1>
        <p className="mt-4 text-sm text-[#f4a8a8]">Sign in to view your reports.</p>
      </main>
    );
  }
  // RLS-scoped to caller (reporter_id = auth.uid()) on conversation_reports.
  const { data, error } = await supabase
    .from("conversation_reports")
    .select("id, reporter_id, conversation_id, message_id, reason, details, status, resolved_by, resolved_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-[#080809] p-6 text-[#f4f4f2]">
        <h1 className="text-lg font-medium">My reports</h1>
        <p className="mt-4 text-sm text-[#f4a8a8]">Could not load reports: {error.message}</p>
      </main>
    );
  }

  const reports = (data ?? []) as Report[];

  return (
    <main className="min-h-[100dvh] bg-[#080809] p-6 text-[#f4f4f2]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-medium">My reports</h1>
        <p className="mt-1 text-xs text-[#9c9ca3]">
          {reports.length} report{reports.length === 1 ? "" : "s"} submitted.
        </p>
        <ul className="mt-4 divide-y divide-[#1c1d20] rounded border border-[#1c1d20] bg-[#0b0b0c]">
          {reports.length === 0 ? (
            <li className="p-6 text-center text-sm text-[#7a7a80]">You haven't reported anything yet.</li>
          ) : (
            reports.map((r) => (
              <li key={r.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm capitalize">{r.reason}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wide ${
                      r.status === "pending"
                        ? "text-[#f4a8a8]"
                        : r.status === "resolved"
                          ? "text-[#a8d4a8]"
                          : "text-[#7a7a80]"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                {r.details ? <p className="mt-1 text-xs text-[#9c9ca3]">{r.details}</p> : null}
                <p className="mt-1 text-[10px] text-[#7a7a80]">Submitted {r.created_at.slice(0, 10)}</p>
                {r.resolved_at ? (
                  <p className="text-[10px] text-[#7a7a80]">Resolved {r.resolved_at.slice(0, 10)}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}
