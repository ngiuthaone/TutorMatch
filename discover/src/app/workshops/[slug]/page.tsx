import type { Metadata } from "next";
import { WorkshopDetailPage } from "@/components/workshop/workshop-detail-page";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Workshop — Tutoria`, description: "Book this workshop on Tutoria." };
}

export default async function WorkshopDetailRoute({ params }: Props) {
  const { slug } = await params;
  return <WorkshopDetailPage slug={slug} />;
}
