import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { ArticleView } from "@/components/article-editor/article-view";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <ArticleView id={id} />
      </Suspense>
      <Footer />
    </div>
  );
}
