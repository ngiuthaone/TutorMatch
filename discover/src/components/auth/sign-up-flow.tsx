"use client";

import { useState } from "react";
import Link from "next/link";
import { IconBrandGoogle, IconBrandApple, IconCircleCheck, IconMail } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleCards } from "./role-cards";
import { InterestsGrid } from "./interests-grid";
import { PreferencesForm } from "./preferences-form";
import { isLiveMode } from "@/lib/auth/config";
import { signUpWithPassword, signInWithProvider } from "@/lib/auth/session";

type SignUpStep = "account" | "roles" | "interests" | "preferences" | "complete";

export function SignUpFlow({ nextPath = "/discover" }: { nextPath?: string }) {
  const live = isLiveMode();
  const [step, setStep] = useState<SignUpStep>("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState(false);

  const totalSteps = 4;
  const stepIndex = ["account", "roles", "interests", "preferences"].indexOf(step) + 1;
  const showProgress = step !== "complete" && !confirmEmail;

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (!live) {
      setError("");
      setStep("roles");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await signUpWithPassword(email.trim(), password, name);
      setLoading(false);
      if (result.needsConfirmation) {
        setConfirmEmail(true);
        return;
      }
      setStep("roles");
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : "Account creation failed. Try again.");
      setLoading(false);
    }
  };

  const handleProviderSocial = async (provider: "google" | "apple") => {
    if (!live) {
      setConfirmEmail(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithProvider(provider);
    } catch (socialError) {
      setError(socialError instanceof Error ? socialError.message : "Social sign-up is not configured.");
      setLoading(false);
    }
  };

  const handleRolesNext = () => {
    if (roles.length === 0) {
      setError("Please select at least one role");
      return;
    }
    setError("");
    setStep("interests");
  };

  const handleInterestsNext = () => {
    if (interests.length < 3) {
      setError("Please select at least 3 interests");
      return;
    }
    setError("");
    setStep("preferences");
  };

  const handleExplore = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, live ? 300 : 1500));
    setLoading(false);
    setStep("complete");

    if (typeof window !== "undefined" && !live) {
      const signupData = {
        name: name.trim(),
        email: email.trim(),
        roles,
        interests,
        completed: true,
        joinedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem("tutoria_signup", JSON.stringify(signupData));
        const accounts = JSON.parse(localStorage.getItem("tutoria_accounts") || "{}");
        accounts[email.trim().toLocaleLowerCase()] = signupData;
        localStorage.setItem("tutoria_accounts", JSON.stringify(accounts));
      } catch {}
    }
  };

  if (confirmEmail) {
    return (
      <div className="signup-shell">
        <div className="flex flex-col items-center text-center py-10">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconMail size={32} className="text-primary" />
          </div>
          <h1 className="mt-6 text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Confirm your email
          </h1>
          <p className="mt-3 text-sm text-muted max-w-md">
            We sent a confirmation link to <strong>{email.trim()}</strong>. Open it to activate your
            account, then sign in to explore Tutoria.
          </p>
          <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
            <Link href={`/auth/sign-in?next=${encodeURIComponent("/discover")}`}>
              <Button size="lg" className="w-full">Go to sign in</Button>
            </Link>
            <button
              type="button"
              className="text-sm text-muted underline"
              onClick={() => setConfirmEmail(false)}
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-shell">
      {showProgress && (
        <div className="signup-progress">
          <Link href="/" className="signup-brand" aria-label="Tutoria home">T</Link>
          <div className="signup-progress-track">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`signup-progress-segment ${
                  i < stepIndex ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="signup-step-label">
            Step {stepIndex} of {totalSteps}
          </p>
        </div>
      )}

      {step === "account" && (
        <section className="signup-account">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Join a world built around curiosity.
          </h1>

          <form onSubmit={handleCreateAccount} className="mt-8 flex flex-col gap-4">
            <Input
              label="Full name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder={live ? "At least 8 characters" : "Create a password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={loading}>
              Create my account
            </Button>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted">or continue with</span>
            </div>
          </div>

          <div className="signup-social-stack">
            <Button variant="social" size="md" onClick={() => void handleProviderSocial("google")} disabled={loading}>
              <IconBrandGoogle size={18} />
              Google
            </Button>
            <Button variant="social" size="md" onClick={() => void handleProviderSocial("apple")} disabled={loading}>
              <IconBrandApple size={18} />
              Apple
            </Button>
          </div>
          {live && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <IconMail size={13} /> Provider buttons appear once enabled in your Supabase dashboard.
            </p>
          )}

          <p className="signup-legal">
            By joining Tutoria, you agree to our{" "}
            <Link href="/terms">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      )}

      {step === "roles" && (
        <>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            What brings you here?
          </h1>
          <p className="mt-2 text-sm text-muted">
            Choose one or more. You can always change this later.
          </p>

          <div className="mt-8">
            <RoleCards selected={roles} onChange={setRoles} />
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="mt-8">
            <Button size="lg" className="w-full" onClick={handleRolesNext}>
              Continue
            </Button>
          </div>
        </>
      )}

      {step === "interests" && (
        <>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            What would you love to explore?
          </h1>
          <p className="mt-2 text-sm text-muted">
            Pick at least 3 to personalize your experience.
          </p>

          <div className="mt-8">
            <InterestsGrid selected={interests} onChange={setInterests} />
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="mt-8">
            <Button size="lg" className="w-full" onClick={handleInterestsNext}>
              Continue
            </Button>
          </div>
        </>
      )}

      {step === "preferences" && (
        <>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Personalize the experience
          </h1>
          <p className="mt-2 text-sm text-muted">
            These are optional. We will use them to tailor your Discover page.
          </p>

          <div className="mt-8">
            <PreferencesForm />
          </div>

          <div className="mt-8">
            <Button size="lg" className="w-full" onClick={handleExplore} loading={loading}>
              Explore Tutoria
            </Button>
          </div>
        </>
      )}

      {step === "complete" && (
        <div className="flex flex-col items-center text-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconCircleCheck size={32} className="text-primary" />
          </div>
          <h1 className="mt-6 text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Your world is ready.
          </h1>
          <p className="mt-3 text-sm text-muted max-w-md">
            We have selected creators, skills, communities, and experiences based on what you love.
          </p>
          <div className="mt-8">
            <a href={nextPath}>
              <Button size="lg">
                Start exploring
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}