import { Suspense } from "react";
import { ArticleEditorPage } from "@/components/article-editor/article-editor-page";

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center"><div className="text-sm text-muted">Loading editor\u2026</div></div>}>
      <ArticleEditorPage articleId={id} />
    </Suspense>
  );
}
