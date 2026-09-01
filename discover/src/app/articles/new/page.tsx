export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { ArticleEditorPage } from "@/components/community/article-editor";

export default function NewArticle() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center"><div className="text-sm text-[#9ca3af]">Loading editor…</div></div>}>
      <RequireAuth><ArticleEditorPage /></RequireAuth>
    </Suspense>
  );
}
