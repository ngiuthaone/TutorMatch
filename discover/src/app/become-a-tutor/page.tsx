import type { Metadata } from "next";

import { TutorOnboarding } from "@/components/tutor-onboarding/tutor-onboarding";

export const metadata: Metadata = {
  title: "Become a tutor | Tutoria",
  description: "Create your Tutoria teaching profile.",
};

export default function BecomeATutorPage() {
  return <TutorOnboarding />;
}
