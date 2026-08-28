import type { Metadata } from "next";

import { EventNewFrame } from "./event-new-frame";

export const metadata: Metadata = {
  title: "Create an event or workshop | Tutoria",
  description: "Plan, price, preview, and publish a learning experience on Tutoria.",
};

export default function NewEventPage() {
  return <EventNewFrame />;
}
