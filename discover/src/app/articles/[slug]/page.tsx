import { notFound } from "next/navigation";
import { getArticleBySlug, isCommunityApiError } from "@/lib/community/articles-api";
import { ArticleView } from "@/components/community/article-view";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let article;
  try {
    article = await getArticleBySlug(slug);
  } catch (err) {
    if (isCommunityApiError(err) && err.status === 404) notFound();
    throw err;
  }
  return <ArticleView article={article} />;
}
