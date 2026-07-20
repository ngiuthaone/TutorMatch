"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBrandGoogle, IconBrandApple, IconCircleCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm({ nextPath = "/discover" }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setSuccess(true);
    try {
      const name = email.split("@")[0];
      localStorage.setItem("tutoria_signup", JSON.stringify({ email, name, completed: true }));
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
    router.replace(nextPath);
  };

  if (success) {
    return (
      <div className="flex flex-col justify-center px-8 lg:px-16 py-12 lg:py-0 max-w-md mx-auto lg:mx-0 w-full">
        <div className="flex flex-col items-center text-center py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconCircleCheck size={32} className="text-primary" />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-foreground">
            Preparing your world...
          </h2>
          <p className="mt-2 text-sm text-muted">
            Loading your personalized experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center px-8 lg:px-16 py-12 lg:py-0 max-w-md mx-auto lg:mx-0 w-full">
      <div className="mb-8">
        <span className="text-xl font-bold tracking-tight text-primary">
          Tutoria
        </span>
      </div>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
        Welcome back
      </h1>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-sm">
        Continue learning, sharing, and connecting with people who inspire you.
      </p>

      <form action="/discover" method="get" onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <div>
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary/30"
              />
              Remember me
            </label>
            <button type="button" className="text-sm text-primary hover:text-primary-dark transition-colors">
              Forgot password?
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={loading}>
          Sign in
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

      <p className="mt-8 text-center text-sm text-muted">
        New to Tutoria?{" "}
        <a href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`} className="text-primary hover:text-primary-dark font-medium transition-colors">
          Create an account
        </a>
      </p>
    </div>
  );
}
