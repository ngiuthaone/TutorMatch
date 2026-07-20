"use client";

import { useState } from "react";
import { IconBrandGoogle, IconBrandApple, IconCircleCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleCards } from "./role-cards";
import { InterestsGrid } from "./interests-grid";
import { PreferencesForm } from "./preferences-form";

type SignUpStep = "account" | "roles" | "interests" | "preferences" | "complete";

export function SignUpFlow({ nextPath = "/discover" }: { nextPath?: string }) {
  const [step, setStep] = useState<SignUpStep>("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = 4;
  const stepIndex = ["account", "roles", "interests", "preferences"].indexOf(step) + 1;
  const showProgress = step !== "complete";

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setStep("roles");
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
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setStep("complete");

    if (typeof window !== "undefined") {
      const signupData = {
        name,
        email,
        roles,
        interests,
        completed: true,
        joinedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem("tutoria_signup", JSON.stringify(signupData));
      } catch {}
    }
  };

  return (
    <div className="flex flex-col justify-center px-6 lg:px-16 py-12 max-w-2xl mx-auto w-full">
      {showProgress && (
        <div className="mb-8">
          <span className="text-xl font-bold tracking-tight text-primary">
            Tutoria
          </span>
          <div className="mt-4 flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i < stepIndex ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Step {stepIndex} of {totalSteps}
          </p>
        </div>
      )}

      {step === "account" && (
        <>
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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" size="lg">
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

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="social" size="md">
              <IconBrandGoogle size={18} />
              Google
            </Button>
            <Button variant="social" size="md">
              <IconBrandApple size={18} />
              Apple
            </Button>
          </div>

          <p className="mt-8 text-center text-xs text-muted">
            By joining Tutoria, you agree to our{" "}
            <a href="#" className="text-primary hover:text-primary-dark transition-colors">Terms</a>{" "}
            and{" "}
            <a href="#" className="text-primary hover:text-primary-dark transition-colors">Privacy Policy</a>.
          </p>
        </>
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
