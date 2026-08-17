import { Suspense } from "react";
import { AuthCallbackPage } from "@/components/auth/auth-callback";

export default function AuthCallbackRoute() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh]" aria-busy="true" />}>
      <AuthCallbackPage />
    </Suspense>
  );
}