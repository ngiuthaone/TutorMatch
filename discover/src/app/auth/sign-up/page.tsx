import { SignUpFlow } from "@/components/auth/sign-up-flow";

export const dynamic = "force-dynamic";
import { safeRedirectPath } from "@/lib/auth/redirect";
import "./sign-up-screen.css";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(next);
  return (
    <main className="signup-page">
      <SignUpFlow nextPath={nextPath} />
    </main>
  );
}
