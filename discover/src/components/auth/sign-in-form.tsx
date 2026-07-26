"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBrandApple, IconBrandGoogle, IconCircleCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm({ nextPath = "/discover" }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setError("");
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setLoading(false);
    setSuccess(true);
    try {
      const identifier = email.trim();
      const accountKey = identifier.toLocaleLowerCase();
      const accounts = JSON.parse(localStorage.getItem("tutoria_accounts") || "{}");
      const existingSession = JSON.parse(localStorage.getItem("tutoria_signup") || "null");
      const matchingAccount = accounts[accountKey];
      const sessionMatches = existingSession?.email?.trim().toLocaleLowerCase() === accountKey;
      const storedName = matchingAccount?.name || (sessionMatches ? existingSession?.name : "");
      const name = typeof storedName === "string" && storedName.trim() && storedName.trim() !== identifier
        ? storedName.trim()
        : "Tutoria member";
      localStorage.setItem("tutoria_signup", JSON.stringify({
        ...(matchingAccount || (sessionMatches ? existingSession : {})),
        email: identifier,
        name,
        completed: true,
      }));
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 600));
    router.replace(nextPath);
  };

  if (success) {
    return (
      <div className="auth-form-shell auth-success" role="status">
        <IconCircleCheck size={36} />
        <h2>Signing you in</h2>
        <p>Loading your Tutoria account.</p>
      </div>
    );
  }

  return (
    <div className="auth-form-shell">
      <Link href="/" className="auth-brand" aria-label="Tutoria home">
        <span>T</span>
      </Link>

      <header className="auth-heading">
        <h1>Welcome back</h1>
      </header>

      <form action="/discover" method="get" onSubmit={handleSubmit} className="auth-form" noValidate>
        <Input
          label="Email address"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />

        <button type="button" className="auth-forgot">Forgot password?</button>

        {error && <p role="alert" className="auth-error">{error}</p>}

        <Button type="submit" size="lg" loading={loading} className="auth-submit">
          Continue
        </Button>
      </form>

      <p className="auth-account-prompt">
        Don&apos;t have an account?{" "}
        <Link href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}>Sign up</Link>
      </p>

      <div className="auth-divider"><span>OR</span></div>

      <div className="auth-social-stack">
        <Button variant="social" size="md" className="auth-social-button">
          <IconBrandGoogle size={19} />
          Continue with Google
        </Button>
        <Button variant="social" size="md" className="auth-social-button">
          <IconBrandApple size={19} />
          Continue with Apple
        </Button>
      </div>

      <footer className="auth-legal">
        <Link href="/terms">Terms of use</Link>
        <span aria-hidden="true">|</span>
        <Link href="/privacy">Privacy policy</Link>
      </footer>
    </div>
  );
}
