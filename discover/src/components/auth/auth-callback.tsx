"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isLiveMode } from "@/lib/auth/config";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getSupabaseClient } from "@/lib/auth/supabase-client";
import { ensureSession, getSessionSnapshot } from "@/lib/auth/session";

export function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      if (!isLiveMode()) {
        router.replace("/discover");
        return;
      }
      const client = getSupabaseClient();
      if (!client) {
        setError("Authentication is not configured.");
        return;
      }
      try {
        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          await ensureSession();
        }
        const session = (await client.auth.getSession()).data.session;
        if (!session) {
          setError("This sign-in link is invalid or has expired.");
          return;
        }
        if (getSessionSnapshot().status !== "authenticated") {
          await ensureSession();
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
        const type = searchParams.get("type");
        const isRecovery = type === "recovery" || searchParams.get("recovery") !== null;
        if (isRecovery) {
          router.replace("/auth/update-password");
        } else {
          router.replace(safeRedirectPath(searchParams.get("next")));
        }
      } catch {
        setError("We could not complete the sign-in. Request a new link and try again.");
      }
    };
    void run();
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="min-h-[100dvh] grid place-items-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign-in link invalid</h1>
          <p className="mt-3 text-sm text-muted">{error}</p>
          <a href="/auth/sign-in" className="mt-6 inline-block text-sm underline">
            Back to sign in
          </a>
        </div>
      </main>
    );
  }

  return <main className="min-h-[100dvh] grid place-items-center" aria-busy="true" aria-label="Completing sign-in" />;
}