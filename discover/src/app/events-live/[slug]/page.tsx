import type { Metadata } from "next";
import { EventDetailPage } from "@/components/event-live/event-detail-page";

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `Event | Tutoria`,
    description: "Attend an event on Tutoria.",
  };
}

export default async function EventDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <EventDetailPage slug={slug} />;
}
