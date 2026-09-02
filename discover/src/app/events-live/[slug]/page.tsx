export const dynamic = "force-dynamic";

import Client from "./page-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <Client params={Promise.resolve({ slug })} />;
}
