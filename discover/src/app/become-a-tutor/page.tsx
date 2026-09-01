import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { TutorOnboarding } from "@/components/tutor-onboarding/tutor-onboarding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Become a tutor | Tutoria",
  description: "Create your Tutoria teaching profile.",
};

export default function BecomeATutorPage() {
  return <RequireAuth><TutorOnboarding /></RequireAuth>;
}
