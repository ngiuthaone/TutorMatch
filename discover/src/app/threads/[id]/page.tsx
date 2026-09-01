import { notFound } from "next/navigation";
import { getThread, isCommunityApiError } from "@/lib/community/threads-api";
import { ThreadDetailView } from "@/components/community/thread-detail";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let result;
  try {
    result = await getThread(id);
  } catch (err) {
    if (isCommunityApiError(err) && err.status === 404) notFound();
    throw err;
  }
  return <ThreadDetailView detail={result} />;
}
