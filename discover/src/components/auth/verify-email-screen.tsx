"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCircleCheck, IconMail } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ensureSession, getAuthenticatedEmail, getSessionSnapshot, resendSignupConfirmation, useSession } from "@/lib/auth/session";

export function VerifyEmailScreen({ nextPath, emailHint = "" }: { nextPath: string; emailHint?: string }) {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState<string | null>(emailHint || null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void ensureSession().then(() => {
      const snapshot = getSessionSnapshot();
      if (snapshot.status === "anonymous" && !emailHint) {
        router.replace(`/auth/sign-in?next=${encodeURIComponent(`/auth/verify-email?next=${nextPath}`)}`);
        return;
      }
      setEmail(emailHint || getAuthenticatedEmail() || null);
    });
  }, [emailHint, nextPath, router]);

  const resend = async () => {
    setSending(true);
    setSent(false);
    setError("");
    try {
      await resendSignupConfirmation(nextPath, email || undefined);
      setSent(true);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not send the verification email.");
    } finally {
      setSending(false);
    }
  };

  if (session.status === "initializing" || session.status === "unavailable") {
    return <main className="min-h-[100dvh] grid place-items-center" aria-busy="true" />;
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-background px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10">
          {sent ? <IconCircleCheck size={32} className="text-primary" /> : <IconMail size={32} className="text-primary" />}
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Verify your email</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Verify your email before sending this booking request. We&apos;ll return you to your Tutor and recheck that Session before anything is submitted.
        </p>
        {email && <p className="mt-4 text-sm font-medium text-foreground">{email}</p>}
        {sent && <p className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-sm text-foreground">Verification email sent. Open the link to continue.</p>}
        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex flex-col gap-3">
          <Button type="button" size="lg" loading={sending} onClick={() => void resend()}>
            {sent ? "Resend verification email" : "Send verification email"}
          </Button>
          <Link className="text-sm text-muted underline underline-offset-4" href={nextPath}>
            Return to booking
          </Link>
        </div>
      </section>
    </main>
  );
}
