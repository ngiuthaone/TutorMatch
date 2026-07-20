import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { EventCreator } from "@/components/events/event-creator";

export const metadata: Metadata = {
  title: "Create an event or workshop | Tutoria",
  description: "Plan, price, preview, and publish a learning experience on Tutoria.",
};

export default function NewEventPage() {
  return <RequireAuth><EventCreator /></RequireAuth>;
}
