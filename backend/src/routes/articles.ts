import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import type { AuthService } from "../services/auth-service.js";
import type { ArticleService } from "../services/article-service.js";
import { safeHttpUrl } from "../lib/sanitize.js";

const noStore = async (_request: unknown, reply: any, payload: unknown) => { reply.header("Cache-Control", "no-store"); return payload; };

function isAllowedImageHost(value: string, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return true;
  const trimmed = String(value || "").trim();
  let url: URL;
  try { url = new URL(trimmed); } catch { return false; }
  return allowedHosts.includes(url.hostname.toLowerCase());
}

const articleContentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).nullable().optional(),
  excerpt: z.string().max(500).nullable().optional(),
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  coverImageAlt: z.string().max(300).nullable().optional(),
  contentHtml: z.string().max(500_000),
  contentJson: z.record(z.string(), z.unknown()),
  tags: z.array(z.string().max(50)).max(10).optional(),
  level: z.enum(["complete_beginner", "beginner", "intermediate", "advanced", "all_levels"]).nullable().optional(),
  estimatedReadingMinutes: z.number().int().min(1).max(120).optional(),
  commentsEnabled: z.boolean().optional(),
});

const articleUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(500).nullable().optional(),
  excerpt: z.string().max(500).nullable().optional(),
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  coverImageAlt: z.string().max(300).nullable().optional(),
  contentHtml: z.string().max(500_000).optional(),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  level: z.enum(["complete_beginner", "beginner", "intermediate", "advanced", "all_levels"]).nullable().optional(),
  estimatedReadingMinutes: z.number().int().min(1).max(120).optional(),
  commentsEnabled: z.boolean().optional(),
});

const idParamSchema = z.string().uuid();
const slugParamSchema = z.string().trim().min(1).max(200);
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  tag: z.string().max(50).optional(),
});

export const articleRoutes: FastifyPluginAsync<{
  authService: AuthService;
  articleService: ArticleService;
  publishMax: number;
  readMax: number;
  windowMs: number;
  allowedImageHosts: string[];
}> = async (app, options) => {
  // Public article list (paginated by published_at desc).
  app.get("/api/v1/articles", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid filter parameters.");
    const q = parsed.data;
    const result = await options.articleService.listPublicArticles(q.cursor ?? null, q.limit ?? 20, q.tag ?? null);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return { articles: result.data.articles, nextCursor: result.data.nextCursor };
  });

  // Public article by slug.
  app.get("/api/v1/articles/:slug", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = slugParamSchema.safeParse(decodeURIComponent((request.params as { slug?: string }).slug ?? ""));
    if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Article not found.");
    const result = await options.articleService.getPublicArticle(parsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Article not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return result.data;
  });

  // Create article draft.
  app.post("/api/v1/articles", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = articleContentSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "ARTICLE_INVALID", "Article details are invalid.");
    const body = parsed.data;
    if (body.coverImageUrl && !safeHttpUrl(body.coverImageUrl)) throw new ApiError(400, "ARTICLE_INVALID", "Cover image URL must be an https:// URL.");
    if (body.coverImageUrl && !isAllowedImageHost(body.coverImageUrl, options.allowedImageHosts)) {
      throw new ApiError(400, "ARTICLE_INVALID", "Cover image host is not allowed.");
    }
    request.log.info({ event: "articles.create.attempt", userId: request.auth?.userId }, "article draft create attempted");
    const result = await options.articleService.createDraft(request.auth.accessToken, {
      title: body.title,
      subtitle: body.subtitle,
      excerpt: body.excerpt,
      coverImageUrl: body.coverImageUrl,
      coverImageAlt: body.coverImageAlt,
      contentHtml: body.contentHtml,
      contentJson: body.contentJson,
      tags: body.tags,
      level: body.level,
      estimatedReadingMinutes: body.estimatedReadingMinutes,
      commentsEnabled: body.commentsEnabled,
    });
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before publishing.");
      if (result.code === "CONTENT_TOO_LARGE") throw new ApiError(413, "CONTENT_TOO_LARGE", "Article content is too large.");
      if (result.code === "UNSAFE_CONTENT") throw new ApiError(400, "UNSAFE_CONTENT", "Article content contains unsafe HTML.");
      throw new ApiError(400, result.code, "Article details are invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You are not allowed to create an article.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    request.log.info({ event: "articles.create.success", articleId: result.data.id, userId: request.auth?.userId }, "article draft created");
    return { id: result.data.id, status: result.data.status };
  });

  // Update article draft.
  app.patch("/api/v1/articles/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Article not found.");
    const bodyParsed = articleUpdateSchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ApiError(400, "ARTICLE_INVALID", "Article details are invalid.");
    const body = bodyParsed.data;
    if (body.coverImageUrl && !safeHttpUrl(body.coverImageUrl)) throw new ApiError(400, "ARTICLE_INVALID", "Cover image URL must be an https:// URL.");
    if (body.coverImageUrl && !isAllowedImageHost(body.coverImageUrl, options.allowedImageHosts)) {
      throw new ApiError(400, "ARTICLE_INVALID", "Cover image host is not allowed.");
    }
    const result = await options.articleService.updateDraft(request.auth.accessToken, idParsed.data, {
      title: body.title,
      subtitle: body.subtitle,
      excerpt: body.excerpt,
      coverImageUrl: body.coverImageUrl,
      coverImageAlt: body.coverImageAlt,
      contentHtml: body.contentHtml,
      contentJson: body.contentJson,
      tags: body.tags,
      level: body.level,
      estimatedReadingMinutes: body.estimatedReadingMinutes,
      commentsEnabled: body.commentsEnabled,
    });
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Article not found.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before editing.");
      if (result.code === "NOT_DRAFT") throw new ApiError(409, "NOT_DRAFT", "Only drafts can be edited.");
      if (result.code === "CONTENT_TOO_LARGE") throw new ApiError(413, "CONTENT_TOO_LARGE", "Article content is too large.");
      if (result.code === "UNSAFE_CONTENT") throw new ApiError(400, "UNSAFE_CONTENT", "Article content contains unsafe HTML.");
      throw new ApiError(400, result.code, "Article details are invalid.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this article.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return { id: result.data.id, status: result.data.status };
  });

  // Publish article.
  app.post("/api/v1/articles/:id/publish", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Article not found.");
    const result = await options.articleService.publish(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Article not found.");
    if (result.status === "invalid") {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Please confirm your email before publishing.");
      if (result.code === "NOT_DRAFT") throw new ApiError(409, "NOT_DRAFT", "Only drafts can be published.");
      if (result.code === "SLUG_EXHAUSTED") throw new ApiError(409, "SLUG_EXHAUSTED", "Could not generate a unique slug.");
      throw new ApiError(400, result.code, "Cannot publish this article.");
    }
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this article.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return { id: result.data.id, slug: result.data.slug, status: result.data.status };
  });

  // Unpublish article.
  app.post("/api/v1/articles/:id/unpublish", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Article not found.");
    const result = await options.articleService.unpublish(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Article not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this article.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return result.data;
  });

  // Delete article (owner, soft-delete).
  app.delete("/api/v1/articles/:id", { preHandler: app.authenticate, config: { rateLimit: { max: options.publishMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Article not found.");
    const result = await options.articleService.deleteArticle(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Article not found.");
    if (result.status === "forbidden") throw new ApiError(403, "FORBIDDEN", "You do not own this article.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return result.data;
  });

  // List my articles (drafts + published) for the editor.
  app.get("/api/v1/articles/mine", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const result = await options.articleService.listMyArticles(request.auth.accessToken);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return result.data;
  });

  // Get my single article (full content, including json) for editing.
  app.get("/api/v1/articles/:id/mine", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const idParsed = idParamSchema.safeParse((request.params as { id?: string }).id ?? "");
    if (!idParsed.success) throw new ApiError(404, "NOT_FOUND", "Article not found.");
    const result = await options.articleService.getMyArticle(request.auth.accessToken, idParsed.data);
    if (result.status === "not_found") throw new ApiError(404, "NOT_FOUND", "Article not found.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Articles are temporarily unavailable.");
    return result.data;
  });
};
