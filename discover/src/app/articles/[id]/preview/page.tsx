import { Suspense } from "react";
import { ArticlePreview } from "@/components/article-editor/article-preview";

export default async function PreviewArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center"><div className="text-sm text-muted">Loading preview\u2026</div></div>}>
      <ArticlePreview id={id} />
    </Suspense>
  );
}
