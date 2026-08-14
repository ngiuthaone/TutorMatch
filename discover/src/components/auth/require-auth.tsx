"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLiveMode } from "@/lib/auth/config";
import { evaluateAuthGate } from "@/lib/auth/gate";
import { useSession } from "@/lib/auth/session";

export function RequireAuth({ children }: { children: ReactNode }) {
  if (!isLiveMode()) {
    // Mock routes must never depend on the live session store. That store only
    // becomes available after real Supabase configuration has been supplied.
    return <>{children}</>;
  }

  return <LiveAuthGate>{children}</LiveAuthGate>;
}

function LiveAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const action = evaluateAuthGate(session.status, pathname);
    if (action.type === "redirect") {
      router.replace(action.to);
      return;
    }
    if (action.type === "authorize") {
      const frame = window.requestAnimationFrame(() => setAuthorized(true));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [pathname, router, session.status]);

  if (!authorized) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#080809] px-6 text-[#f4f4f2]" aria-busy="true">
        <p className="text-sm text-[#9c9ca3]">Loading your messages…</p>
      </main>
    );
  }
  return <>{children}</>;
}
