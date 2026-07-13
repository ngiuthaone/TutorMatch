import type { PostDraft, ArticleDraft, PublishedPost, PublishedArticle, Comment, Attachment } from "./types";
import { generateId, getUserFromStorage } from "./types";

const POSTS_KEY = "tutoria_published_posts";
const ARTICLES_KEY = "tutoria_published_articles";
const POST_DRAFTS_KEY = "tutoria_post_drafts";
const ARTICLE_DRAFTS_KEY = "tutoria_article_drafts";
const COMMENTS_KEY = "tutoria_comments";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function savePostDraft(draft: PostDraft): void {
  const drafts = read<PostDraft[]>(POST_DRAFTS_KEY, []);
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) drafts[idx] = draft;
  else drafts.push(draft);
  write(POST_DRAFTS_KEY, drafts);
}

export function getPostDrafts(): PostDraft[] {
  return read<PostDraft[]>(POST_DRAFTS_KEY, []);
}

export function deletePostDraft(id: string): void {
  write(POST_DRAFTS_KEY, read<PostDraft[]>(POST_DRAFTS_KEY, []).filter((d) => d.id !== id));
}

export function publishPost(draft: PostDraft): PublishedPost {
  const user = getUserFromStorage();
  const post: PublishedPost = {
    ...draft,
    authorId: user?.id || "local-user",
    authorName: user?.name || "You",
    authorAvatar: user?.avatarUrl,
    authorRole: user?.role,
    likes: 0,
    comments: 0,
    appreciated: false,
    saved: false,
    status: "published",
    updatedAt: new Date().toISOString(),
  };
  const posts = read<PublishedPost[]>(POSTS_KEY, []);
  const idx = posts.findIndex((p) => p.id === draft.id);
  if (idx >= 0) posts[idx] = post;
  else posts.unshift(post);
  write(POSTS_KEY, posts);
  deletePostDraft(draft.id);
  return post;
}

export function getPublishedPosts(): PublishedPost[] {
  return read<PublishedPost[]>(POSTS_KEY, []);
}

export function updatePublishedPost(id: string, updates: Partial<PublishedPost>): void {
  const posts = read<PublishedPost[]>(POSTS_KEY, []);
  const idx = posts.findIndex((p) => p.id === id);
  if (idx >= 0) {
    posts[idx] = { ...posts[idx], ...updates, updatedAt: new Date().toISOString() };
    write(POSTS_KEY, posts);
  }
}

export function deletePublishedPost(id: string): void {
  write(POSTS_KEY, read<PublishedPost[]>(POSTS_KEY, []).filter((p) => p.id !== id));
}

export function saveArticleDraft(draft: ArticleDraft): void {
  const drafts = read<ArticleDraft[]>(ARTICLE_DRAFTS_KEY, []);
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) drafts[idx] = draft;
  else drafts.push(draft);
  write(ARTICLE_DRAFTS_KEY, drafts);
}

export function getArticleDrafts(): ArticleDraft[] {
  return read<ArticleDraft[]>(ARTICLE_DRAFTS_KEY, []);
}

export function deleteArticleDraft(id: string): void {
  write(ARTICLE_DRAFTS_KEY, read<ArticleDraft[]>(ARTICLE_DRAFTS_KEY, []).filter((d) => d.id !== id));
}

export function publishArticle(draft: ArticleDraft): PublishedArticle {
  const user = getUserFromStorage();
  const article: PublishedArticle = {
    ...draft,
    authorId: user?.id || "local-user",
    authorName: user?.name || "You",
    authorAvatar: user?.avatarUrl,
    authorRole: user?.role,
    likes: 0,
    comments: 0,
    appreciated: false,
    saved: false,
    status: "published",
    updatedAt: new Date().toISOString(),
  };
  const articles = read<PublishedArticle[]>(ARTICLES_KEY, []);
  const idx = articles.findIndex((a) => a.id === draft.id);
  if (idx >= 0) articles[idx] = article;
  else articles.unshift(article);
  write(ARTICLES_KEY, articles);
  deleteArticleDraft(draft.id);
  return article;
}

export function getPublishedArticles(): PublishedArticle[] {
  return read<PublishedArticle[]>(ARTICLES_KEY, []);
}

export function getPublishedArticleById(id: string): PublishedArticle | undefined {
  return read<PublishedArticle[]>(ARTICLES_KEY, []).find((a) => a.id === id);
}

export function deletePublishedArticle(id: string): void {
  write(ARTICLES_KEY, read<PublishedArticle[]>(ARTICLES_KEY, []).filter((a) => a.id !== id));
}

export function addComment(comment: Comment): void {
  const comments = read<Comment[]>(COMMENTS_KEY, []);
  comments.unshift(comment);
  write(COMMENTS_KEY, comments);
  const posts = read<PublishedPost[]>(POSTS_KEY, []);
  const pIdx = posts.findIndex((p) => p.id === comment.contentId);
  if (pIdx >= 0) {
    posts[pIdx] = { ...posts[pIdx], comments: posts[pIdx].comments + 1 };
    write(POSTS_KEY, posts);
  }
  const articles = read<PublishedArticle[]>(ARTICLES_KEY, []);
  const aIdx = articles.findIndex((a) => a.id === comment.contentId);
  if (aIdx >= 0) {
    articles[aIdx] = { ...articles[aIdx], comments: articles[aIdx].comments + 1 };
    write(ARTICLES_KEY, articles);
  }
}

export function getComments(contentId: string): Comment[] {
  const all = read<Comment[]>(COMMENTS_KEY, []);
  const topLevel = all.filter((c) => c.contentId === contentId && !c.parentId);
  return topLevel.map((c) => ({
    ...c,
    replies: all.filter((r) => r.parentId === c.id),
  }));
}

export function toggleAppreciate(contentId: string, type: "post" | "article"): void {
  if (type === "post") {
    const posts = read<PublishedPost[]>(POSTS_KEY, []);
    const idx = posts.findIndex((p) => p.id === contentId);
    if (idx >= 0) {
      posts[idx] = {
        ...posts[idx],
        appreciated: !posts[idx].appreciated,
        likes: posts[idx].appreciated ? posts[idx].likes - 1 : posts[idx].likes + 1,
      };
      write(POSTS_KEY, posts);
    }
  } else {
    const articles = read<PublishedArticle[]>(ARTICLES_KEY, []);
    const idx = articles.findIndex((a) => a.id === contentId);
    if (idx >= 0) {
      articles[idx] = {
        ...articles[idx],
        appreciated: !articles[idx].appreciated,
        likes: articles[idx].appreciated ? articles[idx].likes - 1 : articles[idx].likes + 1,
      };
      write(ARTICLES_KEY, articles);
    }
  }
}
