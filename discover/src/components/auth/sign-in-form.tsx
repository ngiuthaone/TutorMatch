"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBrandApple, IconBrandGoogle, IconCircleCheck, IconMail } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isLiveMode } from "@/lib/auth/config";
import { requestPasswordReset, signInWithPassword, signInWithProvider } from "@/lib/auth/session";

type AuthMode = "signin" | "reset" | "success";

const AUTH_KEY = "tutoria_signup";

function completeDemoSignIn(email: string) {
  try {
    const identifier = email.trim();
    const accountKey = identifier.toLocaleLowerCase();
    const accounts = JSON.parse(localStorage.getItem("tutoria_accounts") || "{}");
    const existingSession = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    const matchingAccount = accounts[accountKey];
    const sessionMatches = existingSession?.email?.trim().toLocaleLowerCase() === accountKey;
    const storedName = matchingAccount?.name || (sessionMatches ? existingSession?.name : "");
    const name = typeof storedName === "string" && storedName.trim() && storedName.trim() !== identifier
      ? storedName.trim()
      : "Tutoria member";
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      ...(matchingAccount || (sessionMatches ? existingSession : {})),
      email: identifier,
      name,
      completed: true,
    }));
  } catch {}
}

export function SignInForm({ nextPath = "/discover", resetComplete: resetCompleteProp = false }: { nextPath?: string; resetComplete?: boolean }) {
  const router = useRouter();
  const live = isLiveMode();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [resetJustRequested, setResetJustRequested] = useState(false);
  const [resetComplete, setResetComplete] = useState(resetCompleteProp);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || (!live && !password)) {
      setError(live ? "Enter your email address." : "Enter your email address and password.");
      return;
    }
    if (live && !password) {
      setError("Enter your password.");
      return;
    }
    setError("");
    setLoading(true);
    setResetJustRequested(false);
    setResetComplete(false);

    if (!live) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setLoading(false);
      setSuccess(true);
      completeDemoSignIn(email);
      await new Promise((resolve) => setTimeout(resolve, 600));
      router.replace(nextPath);
      return;
    }

    try {
      await signInWithPassword(email.trim(), password);
      setSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 450));
      router.replace(nextPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign-in failed. Try again.");
      setLoading(false);
    }
  };

  const handleContinueSocial = async (provider: "google" | "apple") => {
    if (!live) {
      // Demo mode keeps the prototype flowing without a provider.
      completeDemoSignIn(email || "demo@tutoria.local");
      router.replace(nextPath);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithProvider(provider);
    } catch (socialError) {
      setError(socialError instanceof Error ? socialError.message : "Social sign-in is not configured.");
      setLoading(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter the email address of your account.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (live) {
        await requestPasswordReset(email.trim());
      } else {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      setMode("signin");
      setEmail("");
      setError("");
      setResetJustRequested(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not send a reset link.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-form-shell auth-success" role="status">
        <IconCircleCheck size={36} />
        <h2>{live ? "Signed in" : "Signing you in"}</h2>
        <p>{live ? "Loading your Tutoria account." : "Loading your Tutoria account."}</p>
      </div>
    );
  }

  return (
    <div className="auth-form-shell">
      <Link href="/" className="auth-brand" aria-label="Tutoria home">
        <span>T</span>
      </Link>

      <header className="auth-heading">
        <h1>{mode === "reset" ? "Reset your password" : "Welcome back"}</h1>
        {mode === "reset" && <p>Enter your email and we&apos;ll send you a secure recovery link.</p>}
      </header>

      <form action="/discover" method="get" onSubmit={mode === "reset" ? handleReset : handleSubmit} className="auth-form" noValidate>
        <Input
          label="Email address"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        {mode === "signin" && (
          <Input
            label="Password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        )}

        {mode === "signin" && (
          <button type="button" className="auth-forgot" onClick={() => { setMode("reset"); setError(""); }}>
            Forgot password?
          </button>
        )}

        {error && <p role="alert" className="auth-error">{error}</p>}
        {resetJustRequested && (
          <p role="status" className="auth-success-inline">
            If an account exists for that email, a recovery link is on its way.
          </p>
        )}
        {resetComplete && (
          <p role="status" className="auth-success-inline">
            Your password was updated. Sign in with your new password.
          </p>
        )}

        <Button type="submit" size="lg" loading={loading} className="auth-submit">
          {mode === "reset" ? "Send recovery link" : "Continue"}
        </Button>
      </form>

      <p className="auth-account-prompt">
        {mode === "reset" ? (
          <>
            Remembered it?{" "}
            <button type="button" className="auth-inline-link" onClick={() => { setMode("signin"); setError(""); }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}>Sign up</Link>
          </>
        )}
      </p>

      {mode === "signin" && (
        <>
          <div className="auth-divider"><span>OR</span></div>

          <div className="auth-social-stack">
            <Button variant="social" size="md" className="auth-social-button" onClick={() => void handleContinueSocial("google")} disabled={loading}>
              <IconBrandGoogle size={19} />
              Continue with Google
            </Button>
            <Button variant="social" size="md" className="auth-social-button" onClick={() => void handleContinueSocial("apple")} disabled={loading}>
              <IconBrandApple size={19} />
              Continue with Apple
            </Button>
          </div>
          {live && (
            <p className="auth-social-note">
              <IconMail size={14} /> Google and Apple sign-in appear when those providers are enabled in your Supabase dashboard.
            </p>
          )}
        </>
      )}

      <footer className="auth-legal">
        <Link href="/terms">Terms of use</Link>
        <span aria-hidden="true">|</span>
        <Link href="/privacy">Privacy policy</Link>
      </footer>
    </div>
  );
}