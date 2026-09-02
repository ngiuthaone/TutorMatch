import type { Post } from "./posts-api";
import type { Comment } from "./comments-api";
import type { ReferenceThread, ThreadReply, ThreadLevel, ReplyPermission, ThreadVisibility, AnchorType } from "./threads-api";

type NewPost = (post: Post) => void;
type NewComment = (comment: Comment) => void;
type NewThread = (thread: ReferenceThread) => void;
type NewThreadReply = (reply: ThreadReply) => void;
type LikeUpdate = (payload: { post_id: string; like_count: number }) => void;
type CommentCountUpdate = (payload: { post_id: string; comment_count: number }) => void;

function ensureUuid(raw: unknown, fallbackLabel: string): string {
  if (typeof raw === "string" && raw.length > 0) return raw;
  // Use a stable UUID v4-like for malformed rows. Not ideal but the UI needs
  // an id to react to. The server is the source of truth.
  const hex = "00000000000000000000000000000000".split("");
  for (let i = 0; i < 32; i++) hex[i] = Math.floor(Math.random() * 16).toString(16);
  console.warn(`realtime: missing id in payload (${fallbackLabel}), generated temporary id`);
  return hex.join("");
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStringOrNull(v: unknown): string | null {
  if (v === null) return null;
  return typeof v === "string" ? v : null;
}

function asStringOrUndef(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return typeof v === "string" ? v : undefined;
}

function postFrom(row: Record<string, unknown>): Post {
  return {
    id: ensureUuid(row.id, "post.id"),
    body: String(row.body ?? ""),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    level: asStringOrNull(row.level),
    post_type: asStringOrNull(row.post_type),
    reply_permission: String(row.reply_permission ?? "everyone"),
    like_count: Number(row.like_count ?? 0),
    repost_count: Number(row.repost_count ?? 0),
    comment_count: Number(row.comment_count ?? 0),
    image_url: asStringOrNull(row.image_url),
    community_id: asStringOrNull(row.community_id),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    is_author: false,
    liked_by_me: false,
    reposted_by_me: false,
    author: {
      name: String((row as Record<string, unknown>).author_name ?? "Someone"),
      avatar_url: asStringOrNull(row.author_avatar),
      role: asStringOrUndef(row.author_role),
    },
  };
}

function commentFrom(row: Record<string, unknown>): Comment {
  return {
    id: ensureUuid(row.id, "comment.id"),
    parent_id: asStringOrNull(row.parent_id),
    body: String(row.body ?? ""),
    appreciated_count: Number(row.appreciated_count ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    depth: Number(row.depth ?? 1),
    is_creator: false,
    appreciated_by_me: false,
    author: {
      name: String((row as Record<string, unknown>).author_name ?? "Someone"),
      avatar_url: asStringOrNull(row.author_avatar),
      role: asStringOrUndef(row.author_role),
    },
  };
}

function threadFrom(row: Record<string, unknown>): ReferenceThread {
  return {
    id: ensureUuid(row.id, "thread.id"),
    title: String(row.title ?? ""),
    body: asStringOrNull(row.body),
    anchor_type: (row.anchor_type as AnchorType) ?? "external_url",
    anchor_id: asStringOrNull(row.anchor_id),
    anchor_url: asStringOrNull(row.anchor_url),
    anchor_title: asStringOrNull(row.anchor_title),
    anchor_domain: asStringOrNull(row.anchor_domain),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    level: asStringOrNull(row.level) as ThreadLevel | null,
    visibility: ((row.visibility as string) ?? "public") as ThreadVisibility,
    reply_permission: ((row.reply_permission as string) ?? "everyone") as ReplyPermission,
    community_id: asStringOrNull(row.community_id),
    appreciated_count: Number(row.appreciated_count ?? 0),
    reply_count: Number(row.reply_count ?? 0),
    status: ((row.status as string) ?? "published") as ReferenceThread["status"],
    is_creator: false,
    appreciated_by_me: false,
    creator: {
      name: String((row as Record<string, unknown>).creator_name ?? "Someone"),
      avatar_url: asStringOrNull(row.creator_avatar),
      role: asStringOrUndef(row.creator_role),
    },
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function threadReplyFrom(row: Record<string, unknown>): ThreadReply {
  return {
    id: ensureUuid(row.id, "reply.id"),
    parent_id: asStringOrNull(row.parent_id),
    body: String(row.body ?? ""),
    appreciated_count: Number(row.appreciated_count ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    depth: Number(row.depth ?? 1),
    is_creator: false,
    appreciated_by_me: false,
    author: {
      name: String((row as Record<string, unknown>).author_name ?? "Someone"),
      avatar_url: asStringOrNull(row.author_avatar),
      role: asStringOrUndef(row.author_role),
    },
  };
}

/**
 * Subscribe to new comments on a post.
 * Server-side RLS on public.comments restricts which rows the caller can see.
 */
export function subscribeToPostComments(
  postId: string,
  onComment: NewComment,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return;
      const channel = supabase
        .channel(`post:${postId}:comments`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "comments", filter: `owner_id=eq.${postId}` },
          (payload) => {
            try {
              onComment(commentFrom(payload.new as Record<string, unknown>));
            } catch (error) {
              console.error("subscribeToPostComments: failed to parse payload", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToPostComments: subscribe failed", error);
    }
  })();
  signal?.addEventListener("abort", () => { cancelled = true; unsubscribe(); });
  return () => { cancelled = true; unsubscribe(); };
}

/**
 * Subscribe to like_count updates on a post. The like table is write-heavy
 * but we only need the aggregate count, so we INSERT-only and re-read the
 * like_count from posts. If you need per-user, also subscribe to post_likes.
 */
export function subscribeToPostLikes(
  postId: string,
  onUpdate: LikeUpdate,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return;
      const channel = supabase
        .channel(`post:${postId}:likes`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${postId}` },
          (payload) => {
            try {
              const row = payload.new as Record<string, unknown>;
              onUpdate({
                post_id: String(row.id),
                like_count: Number(row.like_count ?? 0),
              });
            } catch (error) {
              console.error("subscribeToPostLikes: failed to parse payload", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToPostLikes: subscribe failed", error);
    }
  })();
  signal?.addEventListener("abort", () => { cancelled = true; unsubscribe(); });
  return () => { cancelled = true; unsubscribe(); };
}

/**
 * Subscribe to comment_count updates on a post.
 */
export function subscribeToPostCommentCount(
  postId: string,
  onUpdate: CommentCountUpdate,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return;
      const channel = supabase
        .channel(`post:${postId}:commentcount`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${postId}` },
          (payload) => {
            try {
              const row = payload.new as Record<string, unknown>;
              onUpdate({
                post_id: String(row.id),
                comment_count: Number(row.comment_count ?? 0),
              });
            } catch (error) {
              console.error("subscribeToPostCommentCount: failed to parse payload", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToPostCommentCount: subscribe failed", error);
    }
  })();
  signal?.addEventListener("abort", () => { cancelled = true; unsubscribe(); });
  return () => { cancelled = true; unsubscribe(); };
}

/**
 * Subscribe to a community's new posts (for community feed live updates).
 * Server-side RLS on public.posts restricts which rows the caller can see
 * (private communities the caller isn't a member of are invisible).
 */
export function subscribeToCommunityPosts(
  communityId: string,
  onPost: NewPost,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return;
      const channel = supabase
        .channel(`community:${communityId}:posts`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "posts", filter: `community_id=eq.${communityId}` },
          (payload) => {
            try {
              onPost(postFrom(payload.new as Record<string, unknown>));
            } catch (error) {
              console.error("subscribeToCommunityPosts: failed to parse payload", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToCommunityPosts: subscribe failed", error);
    }
  })();
  signal?.addEventListener("abort", () => { cancelled = true; unsubscribe(); });
  return () => { cancelled = true; unsubscribe(); };
}

/**
 * Subscribe to a community's new threads.
 */
export function subscribeToCommunityThreads(
  communityId: string,
  onThread: NewThread,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return;
      const channel = supabase
        .channel(`community:${communityId}:threads`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reference_threads", filter: `community_id=eq.${communityId}` },
          (payload) => {
            try {
              onThread(threadFrom(payload.new as Record<string, unknown>));
            } catch (error) {
              console.error("subscribeToCommunityThreads: failed to parse payload", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToCommunityThreads: subscribe failed", error);
    }
  })();
  signal?.addEventListener("abort", () => { cancelled = true; unsubscribe(); });
  return () => { cancelled = true; unsubscribe(); };
}

/**
 * Subscribe to new replies on a reference thread.
 */
export function subscribeToThreadReplies(
  threadId: string,
  onReply: NewThreadReply,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return;
      const channel = supabase
        .channel(`thread:${threadId}:replies`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reference_thread_replies", filter: `thread_id=eq.${threadId}` },
          (payload) => {
            try {
              onReply(threadReplyFrom(payload.new as Record<string, unknown>));
            } catch (error) {
              console.error("subscribeToThreadReplies: failed to parse payload", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToThreadReplies: subscribe failed", error);
    }
  })();
  signal?.addEventListener("abort", () => { cancelled = true; unsubscribe(); });
  return () => { cancelled = true; unsubscribe(); };
}

/**
 * Subscribe to the global posts feed (public, no community filter).
 * Server-side RLS restricts which posts the caller can see.
 */
export function subscribeToGlobalPosts(
  onPost: NewPost,
  signal?: AbortSignal,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let unsubscribe = () => undefined;
  let cancelled = false;
  void (async () => {
    try {
      const supabase = (await import("@/lib/auth/supabase-client")).getSupabaseClient();
      if (cancelled) return;
      if (!supabase) return;
      const channel = supabase
        .channel("global:posts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "posts" },
          (payload) => {
            try {
              onPost(postFrom(payload.new as Record<string, unknown>));
            } catch (error) {
              console.error("subscribeToGlobalPosts: failed to parse payload", error);
            }
          },
        )
        .subscribe();
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("subscribeToGlobalPosts: subscribe failed", error);
    }
  })();
  signal?.addEventListener("abort", () => { cancelled = true; unsubscribe(); });
  return () => { cancelled = true; unsubscribe(); };
}
