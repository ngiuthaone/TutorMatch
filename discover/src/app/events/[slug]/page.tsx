import type { Metadata } from "next";
import { PublishedEventPage } from "@/components/events/published-event-page";
import { Footer } from "@/components/discover/footer";
import { TopNav } from "@/components/discover/top-nav";
import { allEvents, getEventBySlug, getSimilarEvents } from "@/lib/event-data";

export function generateStaticParams() {
  return allEvents.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  if (!event) return { title: "Event not found | Tutoria" };

  return {
    title: `${event.title} | Tutoria Events`,
    description: event.subtitle,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <PublishedEventPage slug={slug} fallback={event} similarEvents={getSimilarEvents(slug)} />
      <Footer />
    </div>
  );
}
