// discover/src/app/messages/blocked-users/page.tsx
//
// User-facing list of users the caller has blocked. Lets the caller
// unblock directly via a small client component that calls the
// existing unblock_user RPC.

import { getSupabaseClient } from "@/lib/auth/supabase-client";
import { BlockedUsersList } from "./blocked-users-list";

export const dynamic = "force-dynamic";

export default async function BlockedUsersPage() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return (
      <main className="min-h-[100dvh] bg-[#080809] p-6 text-[#f4f4f2]">
        <h1 className="text-lg font-medium">Blocked users</h1>
        <p className="mt-4 text-sm text-[#f4a8a8]">Sign in to view your blocked users.</p>
      </main>
    );
  }
  // RLS-scoped to caller (blocker_id = auth.uid()).
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-[#080809] p-6 text-[#f4f4f2]">
        <h1 className="text-lg font-medium">Blocked users</h1>
        <p className="mt-4 text-sm text-[#f4a8a8]">Could not load blocked users: {error.message}</p>
      </main>
    );
  }

  const rows = (data ?? []) as { blocker_id: string; blocked_id: string; created_at: string }[];

  return (
    <main className="min-h-[100dvh] bg-[#080809] p-6 text-[#f4f4f2]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-medium">Blocked users</h1>
        <p className="mt-1 text-xs text-[#9c9ca3]">
          {rows.length} blocked. Unblock to send and receive messages again.
        </p>
        <BlockedUsersList initial={rows} />
      </div>
    </main>
  );
}
