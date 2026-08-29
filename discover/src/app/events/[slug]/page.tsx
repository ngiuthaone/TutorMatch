import type { Metadata } from "next";
import { WorkshopDataFrame } from "@/components/events/workshop-data-frame";
import { WorkshopDetailPage } from "@/components/workshop/workshop-detail-page";
import { allEvents, getEventBySlug, type EventDetail } from "@/lib/event-data";
import { getSharedEventBySlug, readSharedEvents } from "@/lib/published-event-store";
import { toWorkshopData, type WorkshopDataRecommendation } from "@/lib/workshop-payload";

const unwrapVnd = (price?: string | number): number => {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const digits = price.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : 0;
  }
  return 0;
};

async function buildRecommendations(slug: string, host: string): Promise<WorkshopDataRecommendation[]> {
  const recs: WorkshopDataRecommendation[] = [];
  const seen = new Set<string>([slug]);
  const push = (e: { slug: string; title: string; host: string; price: string; duration?: string; location: string; image?: string; topic: string; rating: number; reviewCount: number }, index: number) => {
    if (seen.has(e.slug)) return;
    seen.add(e.slug);
    recs.push({
      slug: e.slug,
      title: e.title,
      category: e.topic || "Workshop",
      host: e.host,
      rating: e.rating ?? 0,
      reviewCount: e.reviewCount ?? 0,
      duration: e.duration || "2 hours",
      location: e.location,
      priceFrom: unwrapVnd(e.price),
      image: e.image,
      priority: e.host === host ? "host" : "default",
    });
  };
  await Promise.all(allEvents.map(async (e, index) => {
    const detail: EventDetail = getEventBySlug(e.slug)!;
    push(detail, index);
  }));
  const shared = await readSharedEvents();
  shared.forEach((e, index) => push(e as unknown as EventDetail, index));
  return recs.slice(0, 6);
}

export const dynamicParams = true;

export function generateStaticParams() {
  return allEvents.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug) ?? await getSharedEventBySlug(slug);

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
  const event = getEventBySlug(slug) ?? await getSharedEventBySlug(slug);

  if (event) {
    const recommendations = await buildRecommendations(slug, event.host);
    return <WorkshopDataFrame payload={toWorkshopData(event, recommendations)} />;
  }

  return <WorkshopDetailPage slug={slug} />;
}
