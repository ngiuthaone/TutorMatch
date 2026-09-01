import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { ArticlePreview } from "@/components/article-editor/article-preview";

export default async function PreviewArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center"><div className="text-sm text-muted">Loading preview…</div></div>}>
      <ArticlePreview id={slug} />
    </Suspense>
  );
}
