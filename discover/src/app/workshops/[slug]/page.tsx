import type { Metadata } from "next";

export const dynamic = "force-dynamic";

import { WorkshopDetailTemplatePage } from "@/components/workshop/workshop-detail-template-page";
import { getApiBaseUrl } from "@/lib/auth/config";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const apiBase = getApiBaseUrl();

  if (apiBase) {
    try {
      const response = await fetch(
        apiBase + "/api/v1/events/" + encodeURIComponent(slug),
        { cache: "no-store" },
      );

      if (response.ok) {
        const event = (await response.json()) as {
          title?: string;
          subtitle?: string;
          description?: string;
          image?: string;
          galleryImage?: string;
        };

        const title = typeof event.title === "string"
          ? event.title + " | Tutoria Workshops"
          : "Workshop | Tutoria";
        const description =
          typeof event.subtitle === "string"
            ? event.subtitle
            : typeof event.description === "string"
              ? event.description
              : "Book this workshop on Tutoria.";

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            ...(event.image || event.galleryImage
              ? { images: [event.image || event.galleryImage || ""] }
              : {}),
          },
        };
      }
    } catch {
      // Fall back to generic metadata while the public content endpoint is unavailable.
    }
  }

  return {
    title: "Workshop | Tutoria",
    description: "Book this workshop on Tutoria.",
  };
}

export default async function WorkshopDetailRoute({ params }: Props) {
  const { slug } = await params;
  return <WorkshopDetailTemplatePage slug={slug} />;
}
