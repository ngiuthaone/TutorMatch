import { SignInForm } from "@/components/auth/sign-in-form";
import "./auth-screen-v3.css";

function safeNextPath(next: string | string[] | undefined) {
  const path = Array.isArray(next) ? next[0] : next;
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/discover";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  return (
    <main className="auth-page">
      <section className="auth-form-panel" aria-label="Sign in to Tutoria">
        <SignInForm nextPath={nextPath} />
      </section>
    </main>
  );
}
