import { createClient } from "@supabase/supabase-js";
import type { AuthService } from "./auth-service.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export type ArticleDraftResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "INVALID_TITLE" | "INVALID_BODY" | "CONTENT_TOO_LARGE" | "UNSAFE_CONTENT" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type ArticleUpdateResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "invalid"; code: "NOT_DRAFT" | "CONTENT_TOO_LARGE" | "UNSAFE_CONTENT" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type ArticlePublishResult =
  | { status: "ok"; data: { id: string; slug: string; status: string } }
  | { status: "invalid"; code: "INVALID_TRANSITION" | "INVALID_SLUG" | "SLUG_EXHAUSTED" | "NOT_DRAFT" | "EMAIL_VERIFICATION_REQUIRED" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type ArticleMutationResult =
  | { status: "ok"; data: { id: string; status: string } }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type PublicArticleResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "unavailable" };

export type PublicArticleListResult =
  | { status: "ok"; data: { articles: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unavailable" };

export type MyArticleListResult =
  | { status: "ok"; data: { articles: Record<string, unknown>[] } }
  | { status: "unavailable" };

function mapDraftError(code: string, message: string): ArticleDraftResult {
  if (code === "P0001" && message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  if (code === "22023") {
    if (message.includes("CONTENT_TOO_LARGE")) return { status: "invalid", code: "CONTENT_TOO_LARGE" };
    if (message.includes("UNSAFE_CONTENT")) return { status: "invalid", code: "UNSAFE_CONTENT" };
    return { status: "invalid", code: "INVALID_BODY" };
  }
  return { status: "unavailable" };
}

function mapUpdateError(code: string, message: string): ArticleUpdateResult {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    if (message.includes("NOT_DRAFT")) return { status: "invalid", code: "NOT_DRAFT" };
    return { status: "not_found" };
  }
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  if (code === "22023") {
    if (message.includes("CONTENT_TOO_LARGE")) return { status: "invalid", code: "CONTENT_TOO_LARGE" };
    if (message.includes("UNSAFE_CONTENT")) return { status: "invalid", code: "UNSAFE_CONTENT" };
    return { status: "invalid", code: "NOT_DRAFT" };
  }
  return { status: "unavailable" };
}

function mapPublishError(code: string, message: string): ArticlePublishResult {
  if (code === "P0001") {
    if (message.includes("EMAIL_VERIFICATION_REQUIRED")) return { status: "invalid", code: "EMAIL_VERIFICATION_REQUIRED" };
    if (message.includes("INVALID_TRANSITION")) return { status: "invalid", code: "NOT_DRAFT" };
    return { status: "not_found" };
  }
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  if (code === "22023") {
    if (message.includes("INVALID_SLUG")) return { status: "invalid", code: "INVALID_SLUG" };
    if (message.includes("SLUG_EXHAUSTED")) return { status: "invalid", code: "SLUG_EXHAUSTED" };
    return { status: "invalid", code: "INVALID_TRANSITION" };
  }
  return { status: "unavailable" };
}

function mapMutationError(code: string, message: string): ArticleMutationResult {
  if (code === "P0001") return { status: "not_found" };
  if (code === "42501" || message.includes("permission denied")) return { status: "forbidden" };
  return { status: "unavailable" };
}

export function createSupabaseArticleService(url: string, publishableKey: string, _authService: AuthService) {
  const caller = (token?: string) => createClient(url, publishableKey, {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });

  return {
    async createDraft(
      token: string,
      input: { title: string; subtitle?: string | null | undefined; excerpt?: string | null | undefined; coverImageUrl?: string | null | undefined; coverImageAlt?: string | null | undefined; contentHtml?: string | undefined; contentJson?: Record<string, unknown> | undefined; tags?: string[] | undefined; level?: string | null | undefined; estimatedReadingMinutes?: number | undefined; commentsEnabled?: boolean | undefined },
    ): Promise<ArticleDraftResult> {
      try {
        const { data, error } = await caller(token).rpc("create_article_draft", {
          p_title: input.title,
          p_subtitle: input.subtitle ?? null,
          p_excerpt: input.excerpt ?? null,
          p_cover_image_url: input.coverImageUrl ?? null,
          p_cover_image_alt: input.coverImageAlt ?? null,
          p_content_html: input.contentHtml ?? "",
          p_content_json: JSON.stringify(input.contentJson ?? {}),
          p_tags: input.tags ?? [],
          p_level: input.level ?? null,
          p_estimated_reading_minutes: input.estimatedReadingMinutes ?? 1,
          p_comments_enabled: input.commentsEnabled ?? true,
        });
        if (error) return mapDraftError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "draft") } };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "createDraft", error });
        return { status: "unavailable" };
      }
    },

    async updateDraft(
      token: string,
      id: string,
      input: { title?: string | undefined; subtitle?: string | null | undefined; excerpt?: string | null | undefined; coverImageUrl?: string | null | undefined; coverImageAlt?: string | null | undefined; contentHtml?: string | null | undefined; contentJson?: Record<string, unknown> | null | undefined; tags?: string[] | null | undefined; level?: string | null | undefined; estimatedReadingMinutes?: number | null | undefined; commentsEnabled?: boolean | null | undefined },
    ): Promise<ArticleUpdateResult> {
      try {
        const { data, error } = await caller(token).rpc("update_article_draft", {
          p_id: id,
          p_title: input.title ?? null,
          p_subtitle: input.subtitle ?? null,
          p_excerpt: input.excerpt ?? null,
          p_cover_image_url: input.coverImageUrl ?? null,
          p_cover_image_alt: input.coverImageAlt ?? null,
          p_content_html: input.contentHtml ?? null,
          p_content_json: input.contentJson === null ? null : JSON.stringify(input.contentJson),
          p_tags: input.tags ?? null,
          p_level: input.level ?? null,
          p_estimated_reading_minutes: input.estimatedReadingMinutes ?? null,
          p_comments_enabled: input.commentsEnabled ?? null,
        });
        if (error) return mapUpdateError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "draft") } };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "updateDraft", error });
        return { status: "unavailable" };
      }
    },

    async publish(token: string, id: string): Promise<ArticlePublishResult> {
      try {
        const { data, error } = await caller(token).rpc("publish_article", { p_id: id });
        if (error) return mapPublishError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; slug?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), slug: String(row.slug ?? ""), status: String(row.status ?? "published") } };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "publish", error });
        return { status: "unavailable" };
      }
    },

    async unpublish(token: string, id: string): Promise<ArticleMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("unpublish_article", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "draft") } };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "unpublish", error });
        return { status: "unavailable" };
      }
    },

    async deleteArticle(token: string, id: string): Promise<ArticleMutationResult> {
      try {
        const { data, error } = await caller(token).rpc("delete_article", { p_id: id });
        if (error) return mapMutationError(error.code ?? "", error.message ?? "");
        const row = data as { id?: string; status?: string };
        return { status: "ok", data: { id: String(row.id ?? ""), status: String(row.status ?? "deleted") } };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "deleteArticle", error });
        return { status: "unavailable" };
      }
    },

    async getPublicArticle(slug: string): Promise<PublicArticleResult> {
      try {
        const { data, error } = await caller().rpc("get_public_article_by_slug", { p_slug: slug });
        if (error) return { status: "unavailable" };
        if (!data || typeof data !== "object") return { status: "not_found" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "getPublicArticle", error });
        return { status: "unavailable" };
      }
    },

    async listPublicArticles(cursor: string | null, limit: number, tag: string | null): Promise<PublicArticleListResult> {
      try {
        const { data, error } = await caller().rpc("list_public_articles", { p_cursor: cursor, p_limit: limit, p_tag: tag });
        if (error) return { status: "unavailable" };
        const row = data as { articles?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { articles: row.articles ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "listPublicArticles", error });
        return { status: "unavailable" };
      }
    },

    async listMyArticles(token: string): Promise<MyArticleListResult> {
      try {
        const { data, error } = await caller(token).rpc("list_my_articles");
        if (error) return { status: "unavailable" };
        const row = data as { articles?: Record<string, unknown>[] };
        return { status: "ok", data: { articles: row.articles ?? [] } };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "listMyArticles", error });
        return { status: "unavailable" };
      }
    },

    async getMyArticle(token: string, id: string): Promise<PublicArticleResult> {
      try {
        const { data, error } = await caller(token).rpc("get_my_article", { p_id: id });
        if (error) return { status: "unavailable" };
        if (!data || typeof data !== "object") return { status: "not_found" };
        return { status: "ok", data: data as Record<string, unknown> };
      } catch (error) {
        logServiceError({ service: "article-service", operation: "getMyArticle", error });
        return { status: "unavailable" };
      }
    },
  };
}

export type ArticleService = ReturnType<typeof createSupabaseArticleService>;
