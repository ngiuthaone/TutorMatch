import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import { EventsLiveListing } from "./events-live-listing";

export const metadata: Metadata = {
  title: "Events | Tutoria",
  description: "Join live sessions, workshops, and gatherings from the Tutoria community.",
};

export default function EventsLivePage() {
  return <EventsLiveListing />;
}
