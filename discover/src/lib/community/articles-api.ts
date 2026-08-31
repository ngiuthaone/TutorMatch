import { apiFetch, CommunityApiError } from "./api";

export interface ArticleAuthor {
  name: string;
  avatar_url?: string | null;
  role?: string;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
  tags: string[];
  level?: string | null;
  estimated_reading_minutes: number;
  published_at: string;
  author: ArticleAuthor;
}

export interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  content_html: string;
  tags: string[];
  level?: string | null;
  estimated_reading_minutes: number;
  comments_enabled: boolean;
  published_at: string;
  updated_at: string;
  is_author?: boolean;
  author: ArticleAuthor;
}

export interface MyArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
  published_at?: string | null;
  subtitle?: string | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  content_html?: string;
  content_json?: Record<string, unknown> | null;
  tags?: string[];
  level?: string | null;
  estimated_reading_minutes?: number;
  comments_enabled?: boolean;
}

export interface CreateArticleInput {
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  contentHtml: string;
  contentJson: Record<string, unknown>;
  tags?: string[];
  level?: string | null;
  estimatedReadingMinutes?: number;
  commentsEnabled?: boolean;
}

export async function createArticleDraft(input: CreateArticleInput) {
  return apiFetch<{ id: string; status: string }>("/api/v1/articles", {
    method: "POST",
    body: {
      title: input.title,
      subtitle: input.subtitle ?? null,
      excerpt: input.excerpt ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      coverImageAlt: input.coverImageAlt ?? null,
      contentHtml: input.contentHtml,
      contentJson: input.contentJson,
      tags: input.tags ?? [],
      level: input.level ?? null,
      estimatedReadingMinutes: input.estimatedReadingMinutes ?? 1,
      commentsEnabled: input.commentsEnabled ?? true,
    },
  });
}

export async function updateArticleDraft(id: string, input: Partial<CreateArticleInput>) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/articles/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function publishArticle(id: string) {
  return apiFetch<{ id: string; slug: string; status: string }>(`/api/v1/articles/${id}/publish`, { method: "POST" });
}

export async function unpublishArticle(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/articles/${id}/unpublish`, { method: "POST" });
}

export async function deleteArticle(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/articles/${id}`, { method: "DELETE" });
}

export async function getArticleBySlug(slug: string) {
  return apiFetch<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(slug)}`, { auth: false });
}

export async function listArticles(params: { cursor?: string | null; limit?: number; tag?: string | null } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.tag) q.set("tag", params.tag);
  const qs = q.toString();
  return apiFetch<{ articles: ArticleSummary[]; nextCursor: string | null }>(`/api/v1/articles${qs ? `?${qs}` : ""}`, { auth: false });
}

export async function listMyArticles() {
  return apiFetch<{ articles: MyArticle[] }>("/api/v1/articles/mine");
}

export async function getMyArticle(id: string) {
  return apiFetch<MyArticle>(`/api/v1/articles/${id}/mine`);
}

export function isCommunityApiError(error: unknown): error is CommunityApiError {
  return error instanceof CommunityApiError;
}
