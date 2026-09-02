"use client";

import { useState } from "react";
import { unblockUser } from "@/lib/messaging-api";

type Block = { blocker_id: string; blocked_id: string; created_at: string };

export function BlockedUsersList({ initial }: { initial: Block[] }) {
  const [rows, setRows] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (rows.length === 0) {
    return (
      <ul className="mt-4 divide-y divide-[#1c1d20] rounded border border-[#1c1d20] bg-[#0b0b0c]">
        <li className="p-6 text-center text-sm text-[#7a7a80]">You haven't blocked anyone.</li>
      </ul>
    );
  }

  const onUnblock = async (targetId: string) => {
    setError("");
    setPendingId(targetId);
    try {
      await unblockUser(targetId);
      setRows((current) => current.filter((r) => r.blocked_id !== targetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unblock user.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      {error ? <p className="mt-2 text-[11px] text-[#f4a8a8]">{error}</p> : null}
      <ul className="mt-4 divide-y divide-[#1c1d20] rounded border border-[#1c1d20] bg-[#0b0b0c]">
        {rows.map((row) => (
          <li key={row.blocked_id} className="flex items-center gap-3 p-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1c1d20] text-xs font-medium text-[#cfcfd4]">
              {(row.blocked_id[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-mono text-[#9c9ca3]">{row.blocked_id}</p>
              <p className="text-[11px] text-[#7a7a80]">Blocked {row.created_at.slice(0, 10)}</p>
            </div>
            <button
              type="button"
              onClick={() => void onUnblock(row.blocked_id)}
              disabled={pendingId === row.blocked_id}
              className="rounded border border-[#3a1f1f] bg-[#1f1112] px-2 py-1 text-[11px] text-[#f4a8a8] hover:bg-[#2a1718] disabled:opacity-40"
            >
              {pendingId === row.blocked_id ? "Unblocking…" : "Unblock"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
