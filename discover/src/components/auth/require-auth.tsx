"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const AUTH_KEY = "tutoria_signup";

function hasCompletedAccount() {
  try {
    return Boolean(JSON.parse(window.localStorage.getItem(AUTH_KEY) || "null")?.completed);
  } catch {
    return false;
  }
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!hasCompletedAccount()) {
      router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const frame = window.requestAnimationFrame(() => setAuthorized(true));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, router]);

  if (!authorized) return <main className="min-h-[100dvh]" aria-busy="true" />;
  return <>{children}</>;
}
