import { notFound } from "next/navigation";
import { ArticleEditorPage } from "@/components/community/article-editor";
import { getArticleBySlug, isCommunityApiError } from "@/lib/community/articles-api";

export const dynamic = "force-dynamic";

async function loadArticleId(slug: string): Promise<string> {
  const article = await getArticleBySlug(slug);
  return article.id;
}

export default async function EditArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let articleId: string;
  try {
    articleId = await loadArticleId(slug);
  } catch (err) {
    if (isCommunityApiError(err) && err.status === 404) notFound();
    throw err;
  }
  return <ArticleEditorPage articleId={articleId} />;
}
