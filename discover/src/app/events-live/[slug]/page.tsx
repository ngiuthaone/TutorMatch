export const dynamic = "force-dynamic";

import Client from "./page-client";

interface PageProps {
  params: { slug: string };
}

export default function Page({ params }: PageProps) {
  return <Client {...params} />;
}
