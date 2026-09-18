import type { Metadata } from "next";

export const dynamic = "force-dynamic";

import { WorkshopDetailTemplatePage } from "@/components/workshop/workshop-detail-template-page";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Workshop — Tutoria",
    description: "Book this workshop on Tutoria.",
  };
}

export default async function WorkshopDetailRoute({ params }: Props) {
  const { slug } = await params;
  return <WorkshopDetailTemplatePage slug={slug} />;
}
