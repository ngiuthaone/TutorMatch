import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirectPath } from "@/lib/auth/redirect";
import "./auth-screen-v3.css";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; resetComplete?: string | string[] }> }) {
  const params = await searchParams;
  const nextPath = safeRedirectPath(params.next);
  const resetComplete = params.resetComplete === "1";
  return (
    <main className="auth-page">
      <Suspense fallback={null}>
        <SignInForm nextPath={nextPath} resetComplete={resetComplete} />
      </Suspense>
    </main>
  );
}
