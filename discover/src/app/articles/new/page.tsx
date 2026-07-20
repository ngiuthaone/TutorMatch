import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { ArticleEditorPage } from "@/components/article-editor/article-editor-page";

export default function NewArticle() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center"><div className="text-sm text-muted">Loading editor\u2026</div></div>}>
      <RequireAuth><ArticleEditorPage /></RequireAuth>
    </Suspense>
  );
}
