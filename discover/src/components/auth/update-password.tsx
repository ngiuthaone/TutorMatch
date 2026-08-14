"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCircleCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isLiveMode } from "@/lib/auth/config";
import { validateNewPassword } from "@/lib/auth/password";
import { getSupabaseClient } from "@/lib/auth/supabase-client";
import { ensureSession, getSessionSnapshot, updatePasswordWithSession } from "@/lib/auth/session";

export function UpdatePasswordPage() {
  const router = useRouter();
  const live = isLiveMode();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!live) return;
    void ensureSession().then(() => {
      if (getSessionSnapshot().status === "anonymous") {
        router.replace("/auth/sign-in");
      }
    });
  }, [live, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const validationError = validateNewPassword(password, confirm);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!live) {
      setDone(true);
      return;
    }
    setLoading(true);
    try {
      await updatePasswordWithSession(password);
      const client = getSupabaseClient();
      try {
        await client?.auth.signOut();
      } catch {}
      setDone(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update your password.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-[100dvh] grid place-items-center px-6">
        <div className="auth-form-shell auth-success" role="status">
          <IconCircleCheck size={36} />
          <h2>Password updated</h2>
          <p>Sign in with your new password.</p>
          <div className="mt-6">
            <a href="/auth/sign-in?resetComplete=1">
              <Button size="lg" className="w-full">Back to sign in</Button>
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center px-6 py-12">
      <div className="auth-form-shell w-full max-w-md">
        <Link href="/" className="auth-brand" aria-label="Tutoria home">
          <span>T</span>
        </Link>
        <header className="auth-heading">
          <h1>Choose a new password</h1>
          <p className="mt-2 text-sm text-muted">Use at least 12 characters.</p>
        </header>
        <form onSubmit={handleSubmit} className="auth-form mt-8 flex flex-col gap-4" noValidate>
          <Input
            label="New password"
            type="password"
            placeholder="At least 12 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            placeholder="Repeat the new password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
          />
          {error && <p role="alert" className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}
          <Button type="submit" size="lg" loading={loading}>
            Update password
          </Button>
        </form>
      </div>
    </main>
  );
}