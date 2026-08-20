import type { Metadata } from "next";
import { ClassDetailPage } from "@/components/class/class-detail-page";

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `Class | Tutoria`,
    description: "Book a class on Tutoria.",
  };
}

export default async function ClassDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClassDetailPage slug={slug} />;
}
