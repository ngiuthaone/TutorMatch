"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { IconMessage2, IconShare, IconRepeat, IconX, IconPlus, IconSearch, IconHome, IconBell, IconUser, IconMenu2, IconDots, IconLink, IconBookmark, IconHeart, IconHeartFilled, IconUserPlus, IconUserMinus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listPosts, createPost, repostPost, unrepostPost, likePost, unlikePost, type Post } from "@/lib/community/posts-api";
import { listComments, createComment, appreciateComment, unappreciateComment, type Comment } from "@/lib/community/comments-api";
import { getSessionAccessToken } from "@/lib/auth/session";
import styles from "./discussions.module.css";

const ALL_TAGS = ["Photography", "IELTS", "Languages", "Business", "Technology", "Creative", "Cooking", "Personal development", "Academic", "Community"];
const publicProfileHref = (name: string) =>
  `/user/${encodeURIComponent(name)}`;

export function DiscussionsPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [tab, setTab] = useState<"posts" | "blogs">((params.get("tab") as "posts" | "blogs") || "posts");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedMode, setFeedMode] = useState<"foryou" | "following" | "communities" | "questions">("foryou");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search);
    queueMicrotask(() => setSearchQuery(s.get("q") || ""));
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("sort");
    if (searchQuery) url.searchParams.set("q", searchQuery);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, [tab, searchQuery]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Primary navigation">
          <Link href="/discover" className={styles.logo} aria-label="Tutoria home">T</Link>
          <nav className={styles.nav}>
            <Link href="/discussions" className={`${styles.navLink} ${styles.navActive}`} aria-label="Home"><IconHome size={25} stroke={1.8} /></Link>
            <Link href="/search" className={styles.navLink} aria-label="Search"><IconSearch size={25} stroke={1.8} /></Link>
            <button className={`${styles.navButton} ${styles.navCreate}`} aria-label="Create a post" onClick={() => window.dispatchEvent(new CustomEvent("tutoria:create-post"))}><IconPlus size={27} stroke={1.8} /></button>
            <Link href="/discussions/saved" className={styles.navLink} aria-label="Saved"><IconBookmark size={25} stroke={1.8} /></Link>
            <button className={styles.navButton} aria-label="Notifications"><IconBell size={25} stroke={1.8} /></button>
            <Link href="/user/me" className={styles.navLink} aria-label="Profile"><IconUser size={25} stroke={1.8} /></Link>
          </nav>
          <div className={styles.navBottom}><button className={styles.navButton} aria-label="More options"><IconMenu2 size={25} stroke={1.8} /></button></div>
        </aside>

        <main className={styles.feedColumn}>
          <header className={styles.feedHeader}>
            <h1 style={{ fontFamily: "var(--font-sans), Inter, sans-serif" }}>Discussions</h1>
            <button className={styles.headerAction} aria-label="Notifications"><IconBell size={21} stroke={1.7} /></button>
          </header>

          <div className={styles.feedTabs} role="tablist" aria-label="Discussion feed">
            {(["foryou", "following", "communities", "questions"] as const).map((mode) => (
              <button key={mode} role="tab" aria-selected={feedMode === mode} onClick={() => setFeedMode(mode)} className={`${styles.feedTab} ${feedMode === mode ? styles.feedTabActive : ""}`}>
                {mode === "foryou" ? "For you" : mode === "following" ? "Following" : mode === "communities" ? "Communities" : "Questions"}
              </button>
            ))}
          </div>

          <div className={styles.utilityBar}>
            <div className={styles.contentTabs} role="tablist" aria-label="Content type">
              <button role="tab" aria-selected={tab === "posts"} onClick={() => setTab("posts")} className={`${styles.contentTab} ${tab === "posts" ? styles.contentTabActive : ""}`}>Posts</button>
              <button role="tab" aria-selected={tab === "blogs"} onClick={() => setTab("blogs")} className={`${styles.contentTab} ${tab === "blogs" ? styles.contentTabActive : ""}`}>Articles</button>
            </div>
          </div>

          {tab === "posts" ? (
            <PostsTab searchQuery={searchQuery} feedMode={feedMode} />
          ) : (
            <BlogsTab searchQuery={searchQuery} feedMode={feedMode} />
          )}
        </main>

        <aside className={styles.rightRail} aria-label="Discover more">
          <section className={styles.railCard}>
            <h2 style={{ fontFamily: "var(--font-sans), Inter, sans-serif" }}>Join the conversation</h2>
            <p>Share what you know, ask thoughtful questions, and learn with the Tutoria community.</p>
            <Link href="/auth/sign-up" className={styles.railPrimary}>Join Tutoria</Link>
          </section>
          <section className={styles.railCard}>
            <h2 style={{ fontFamily: "var(--font-sans), Inter, sans-serif" }}>Trending today</h2>
            <Link href="/discussions/tags/Photography" className={styles.railLink}>Photography <span>View all</span></Link>
            <Link href="/discussions/tags/IELTS" className={styles.railLink}>IELTS practice <span>View all</span></Link>
            <Link href="/discussions/tags/Technology" className={styles.railLink}>Technology <span>View all</span></Link>
            <Link href="/communities" className={styles.railLink}>Explore communities <span>View all</span></Link>
          </section>
          <p className={styles.railFooter}>© 2026 Tutoria · Community guidelines · Privacy · Terms</p>
        </aside>

        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          <Link href="/discussions" className={`${styles.mobileNavLink} ${styles.mobileNavLinkActive}`} aria-label="Home"><IconHome size={23} /></Link>
          <Link href="/search" className={styles.mobileNavLink} aria-label="Search"><IconSearch size={23} /></Link>
          <button className={`${styles.mobileNavLink} ${styles.mobileCreate}`} aria-label="Create a post" onClick={() => window.dispatchEvent(new CustomEvent("tutoria:create-post"))}><IconPlus size={25} /></button>
          <Link href="/discussions/saved" className={styles.mobileNavLink} aria-label="Saved"><IconBookmark size={23} /></Link>
          <Link href="/user/me" className={styles.mobileNavLink} aria-label="Profile"><IconUser size={23} /></Link>
        </nav>
      </div>
    </div>
  );
}

function PostsTab({ searchQuery, feedMode }: {
  searchQuery: string;
  feedMode: "foryou" | "following" | "communities" | "questions";
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [shareOpen, setShareOpen] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPosts({
        cursor: reset ? null : cursor,
        limit: 20,
        tag: feedMode === "communities" ? searchQuery || null : null,
        postType: feedMode === "questions" ? "question" : null,
      });
      setPosts(prev => reset ? result.posts : [...prev, ...result.posts]);
      setCursor(result.nextCursor);
      setHasMore(result.nextCursor !== null);
    } catch {
      setError("Posts are temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [cursor, feedMode, searchQuery]);

  useEffect(() => {
    loadPosts(true);
  }, [feedMode, searchQuery]);

  useEffect(() => {
    const openComposer = () => {
      if (getSessionAccessToken()) setShowCompose(true);
      else router.push("/auth/sign-in?next=/discussions");
    };
    window.addEventListener("tutoria:create-post", openComposer);
    return () => window.removeEventListener("tutoria:create-post", openComposer);
  }, []);

  const handleRepost = useCallback(async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const isReposted = post.reposted_by_me;
    const previousState = { repost_count: post.repost_count, reposted_by_me: post.reposted_by_me };

    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      repost_count: isReposted ? p.repost_count - 1 : p.repost_count + 1,
      reposted_by_me: !isReposted
    } : p));

    try {
      if (isReposted) {
        const result = await unrepostPost(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, repost_count: result.repost_count, reposted_by_me: false } : p));
      } else {
        const result = await repostPost(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, repost_count: result.repost_count, reposted_by_me: true } : p));
      }
    } catch (error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...previousState } : p));
      console.error("Failed to toggle repost:", error);
    }
  }, [posts]);

  const handleFollow = useCallback(async (authorName: string, postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const isFollowing = post.is_following;
    const previousState = { is_following: post.is_following };

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_following: !isFollowing } : p));

    try {
      if (isFollowing) {
        await unfollowUser(authorName);
      } else {
        await followUser(authorName);
      }
    } catch (error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...previousState } : p));
      console.error("Failed to toggle follow:", error);
    }
  }, [posts]);

  const handleLike = useCallback(async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const isLiked = post.liked_by_me;
    const previousState = { like_count: post.like_count, liked_by_me: post.liked_by_me };

    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      like_count: isLiked ? p.like_count - 1 : p.like_count + 1,
      liked_by_me: !isLiked
    } : p));

    try {
      if (isLiked) {
        const result = await unlikePost(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, like_count: result.like_count, liked_by_me: false } : p));
      } else {
        const result = await likePost(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, like_count: result.like_count, liked_by_me: true } : p));
      }
    } catch (error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...previousState } : p));
      console.error("Failed to toggle like:", error);
    }
  }, [posts]);

  const handleShare = useCallback((postId: string) => {
    setShareOpen(prev => prev === postId ? null : postId);
  }, []);

  const copyLink = useCallback(async (postId: string) => {
    const url = `${window.location.origin}/discussions?post=${postId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setShareOpen(null);
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareOpen]);

  const handlePublish = useCallback(async (body: string, tags: string[]) => {
    try {
      const result = await createPost({ body, tags });
      const newPost: Post = {
        id: result.id,
        body,
        tags,
        reply_permission: "everyone",
        like_count: 0,
        repost_count: 0,
        comment_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_author: true,
        author: { name: "You", avatar_url: null, role: undefined },
      };
      setPosts(prev => [newPost, ...prev]);
      setShowCompose(false);
    } catch {
      setError("Failed to publish post. Please try again.");
    }
  }, []);

  return (
    <>
      <div>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            {error}
          </div>
        )}

        {loading && posts.length === 0 && (
          <div className="text-center py-12 text-sm text-muted">Loading posts…</div>
        )}

        <div className={styles.postList}>
          {posts.map((post) => {
            const isLiked = !!post.liked_by_me;
            const isReposted = !!post.reposted_by_me;
            const authorName = post.author.name;
            const authorRole = post.author.role || "Learner";
            const avatarUrl = post.author.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(authorName)}/60/60`;

            return (
              <div key={post.id} onClick={() => setSelectedPost(post)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedPost(post); }}
                className={styles.post}>
                <div className={styles.avatarRail} onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(authorName)); }}>
                  <img src={avatarUrl} alt={`${authorName}'s profile`} loading="lazy" width="40" height="40" />
                  <span className={styles.threadLine} aria-hidden="true" />
                </div>
                <div className={styles.postBody}>
                  <div className={styles.postMeta}>
                    <button onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(authorName)); }}
                      className={styles.author}>{authorName}</button>
                    <span className={styles.role}>· {authorRole}</span>
                    <span className={styles.time}>· {formatTimeAgo(post.created_at)}</span>
                    {post.is_author !== true && (
                      <button onClick={(e) => { e.stopPropagation(); handleFollow(authorName, post.id); }}
                        className={styles.followBtn} aria-label="Follow">
                        {post.is_following ? <IconUserMinus size={14} /> : <IconUserPlus size={14} />}
                        <span>{post.is_following ? "Unfollow" : "Follow"}</span>
                      </button>
                    )}
                    <button className={styles.moreButton} aria-label={`More options for ${authorName}`}>
                      <IconDots size={20} />
                    </button>
                  </div>
                  <p className={styles.postCopy}>{post.body}</p>
                  <div className={styles.tags}>
                    {(post.tags || []).map((t: string) => (
                      <button key={t} onClick={(e) => { e.stopPropagation(); router.push(`/discussions/tags/${encodeURIComponent(t)}`); }} className={styles.tag}>#{t.replaceAll(" ", "")}</button>
                    ))}
                  </div>
                  <div className={styles.postActions}>
                    <button onClick={(e) => { e.stopPropagation(); handleLike(post.id); }}
                      className={`${styles.action} ${isLiked ? styles.actionLiked : ""}`} aria-label={`${isLiked ? "Unlike" : "Like"} post`}>
                      {isLiked ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
                      <span className="tabular-nums">{post.like_count + (isLiked && !post.liked_by_me ? 1 : 0)}</span>
                    </button>
                    <div className={styles.action} aria-label="Comments">
                      <IconMessage2 size={17} />
                      <span className="tabular-nums">{post.comment_count}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleRepost(post.id); }}
                      className={`${styles.action} ${isReposted ? styles.actionReposted : ""}`} aria-label={`${isReposted ? "Unrepost" : "Repost"} post`}>
                      <IconRepeat size={18} />
                      <span className="tabular-nums">{post.repost_count}</span>
                    </button>
                    <div className="relative" ref={shareOpen === post.id ? shareRef : undefined}>
                      <button onClick={(e) => { e.stopPropagation(); handleShare(post.id); }}
                        className={styles.action} aria-label="Share post">
                        <IconShare size={18} />
                      </button>
                      {shareOpen === post.id && (
                        <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-border bg-background shadow-lg p-1 z-20">
                          <button onClick={(e) => { e.stopPropagation(); copyLink(post.id); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface transition-colors">
                            <IconLink size={14} /> Copy link
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && !loading && (
          <button onClick={() => loadPosts()} className={styles.loadMore}>Load more</button>
        )}

        {!loading && posts.length === 0 && !error && (
          <div className={styles.empty}>No posts yet. Be the first to share something!</div>
        )}
      </div>

      {showCompose && (
        <PostComposerModal onClose={() => setShowCompose(false)} onPublished={handlePublish} />
      )}

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PostComposerModal({ onClose, onPublished }: { onClose: () => void; onPublished: (body: string, tags: string[]) => void }) {
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    onPublished(content.trim(), selectedTags);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[580px] mx-4 my-12 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <span className="text-sm font-semibold text-foreground">Create post</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
            <IconX size={18} />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">Y</div>
            <div className="flex-1 min-w-0">
              <textarea value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?" rows={4}
                className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none leading-relaxed" />
              <div className="mt-4">
                <p className="text-xs text-muted mb-2">Tag topics (tap to select):</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_TAGS.map((t) => (
                    <button key={t} onClick={() => setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].slice(0, 3))}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${selectedTags.includes(t) ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light" : "border-border text-muted hover:border-primary/30"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-border">
                <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={!content.trim()}
                  className="px-5 py-1.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Post</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(!!post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [reposted, setReposted] = useState(!!post.reposted_by_me);
  const [repostCount, setRepostCount] = useState(post.repost_count);
  const authorName = post.author.name;
  const authorRole = post.author.role || "Learner";
  const avatarUrl = post.author.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(authorName)}/60/60`;

  useEffect(() => {
    listComments("post", post.id).then(r => setComments(r.comments)).catch(() => {});
  }, [post.id]);

  const handleLike = async () => {
    try {
      if (liked) {
        const result = await unlikePost(post.id);
        setLiked(false);
        setLikeCount(result.like_count);
      } else {
        const result = await likePost(post.id);
        setLiked(true);
        setLikeCount(result.like_count);
      }
    } catch { /* silently fail */ }
  };

  const handleRepost = async () => {
    try {
      if (reposted) {
        const result = await unrepostPost(post.id);
        setReposted(false);
        setRepostCount(result.repost_count);
      } else {
        const result = await repostPost(post.id);
        setReposted(true);
        setRepostCount(result.repost_count);
      }
    } catch { /* silently fail */ }
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const result = await createComment("post", post.id, newComment.trim());
      const c: Comment = {
        id: result.id,
        parent_id: null,
        body: newComment.trim(),
        appreciated_count: 0,
        created_at: new Date().toISOString(),
        depth: 1,
        is_creator: true,
        appreciated_by_me: false,
        author: { name: "You", avatar_url: null, role: undefined },
      };
      setComments(prev => [...prev, c]);
      setNewComment("");
    } catch { /* silently fail */ }
  };

  const submitReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    try {
      const result = await createComment("post", post.id, replyText.trim(), parentId);
      const parentComment = comments.find(c => c.id === parentId);
      const c: Comment = {
        id: result.id,
        parent_id: parentId,
        body: replyText.trim(),
        appreciated_count: 0,
        created_at: new Date().toISOString(),
        depth: (parentComment?.depth ?? 0) + 1,
        is_creator: true,
        appreciated_by_me: false,
        author: { name: "You", avatar_url: null, role: undefined },
      };
      setComments(prev => [...prev, c]);
      setReplyText("");
      setReplyTo(null);
    } catch { /* silently fail */ }
  };

  const handleAppreciate = async (commentId: string, isAppreciated: boolean) => {
    try {
      if (isAppreciated) {
        const result = await unappreciateComment(commentId);
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, appreciated_count: result.appreciated_count, appreciated_by_me: false } : c));
      } else {
        const result = await appreciateComment(commentId);
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, appreciated_count: result.appreciated_count, appreciated_by_me: true } : c));
      }
    } catch { /* silently fail */ }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/discussions?post=${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setShareOpen(false);
  };

  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareOpen]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[580px] mx-4 my-8 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <span className="text-xs text-muted">Post</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
            <IconX size={18} />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 cursor-pointer">
              <img src={avatarUrl} alt={authorName} className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-primary transition-all" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button onClick={() => window.location.assign(publicProfileHref(authorName))}
                  className="font-semibold text-foreground hover:text-primary transition-colors">{authorName}</button>
                <span className="text-muted">{authorRole}</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-muted">{formatTimeAgo(post.created_at)}</span>
              </div>
              <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-line">{post.body}</p>
              <div className="flex items-center gap-1.5 mt-3">
                {(post.tags || []).map((t: string) => (
                  <span key={t} onClick={() => router.push(`/discussions/tags/${encodeURIComponent(t)}`)}
                    className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light cursor-pointer hover:bg-primary/20 transition-colors">{t}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted">
                <button onClick={handleLike}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${liked ? "text-red-400 bg-red-50 dark:bg-red-900/10" : "hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-400"}`}>
                  {liked ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
                  <span className="tabular-nums">{likeCount}</span>
                </button>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer">
                  <IconMessage2 size={15} />
                  <span className="tabular-nums">{comments.length}</span>
                </div>
                <button onClick={handleRepost}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${reposted ? "text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:text-emerald-400"}`}>
                  <IconRepeat size={15} />
                  <span className="tabular-nums">{repostCount}</span>
                </button>
                <div className="relative ml-auto" ref={shareRef}>
                  <button onClick={() => setShareOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface hover:text-foreground transition-colors">
                    <IconShare size={15} />
                  </button>
                  {shareOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-border bg-background shadow-lg p-1 z-20">
                      <button onClick={copyLink}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-surface transition-colors">
                        <IconLink size={14} /> Copy link
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">Y</div>
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment…" onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none" />
            <button onClick={submitComment} disabled={!newComment.trim()}
              className="text-sm font-medium text-primary hover:text-primary-dark transition-colors disabled:opacity-40">Post</button>
          </div>
        </div>

        {comments.length > 0 && (
          <div className="border-t border-border px-5 py-4 space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3" style={{ marginLeft: `${Math.min((c.depth - 1) * 24, 72)}px` }}>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {c.author.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-medium text-foreground">{c.author.name}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{formatTimeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground leading-relaxed">{c.body}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                    <button onClick={() => handleAppreciate(c.id, !!c.appreciated_by_me)}
                      className={`flex items-center gap-1 ${c.appreciated_by_me ? "text-red-400" : "hover:text-red-400"} transition-colors`}>
                      {c.appreciated_by_me ? <IconHeartFilled size={12} /> : <IconHeart size={12} />}
                      <span>{c.appreciated_count}</span>
                    </button>
                    <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                      className="hover:text-primary transition-colors">
                      Reply
                    </button>
                  </div>
                  {replyTo === c.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply…" onKeyDown={(e) => { if (e.key === "Enter") submitReply(c.id); }}
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none border-b border-border pb-1" />
                      <button onClick={() => submitReply(c.id)} disabled={!replyText.trim()}
                        className="text-xs font-medium text-primary hover:text-primary-dark transition-colors disabled:opacity-40">Reply</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlogsTab({ searchQuery, feedMode }: {
  searchQuery: string;
  feedMode: "foryou" | "following" | "communities" | "questions";
}) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(8);

  const BLOGS = [
    { id: "b1", title: "Five mistakes beginners make when learning photography", author: "Duc Pham", role: "Photography Artist", excerpt: "After teaching photography workshops for 5 years, I've seen the same patterns. Here's what holds beginners back.", likes: 234, comments: 18, tags: ["Photography"], createdAt: "2h ago", readTime: "8 min read", image: "https://picsum.photos/seed/post-photo/400/240" },
    { id: "b2", title: "How I improved my IELTS speaking from 6.0 to 7.5", author: "Linh Nguyen", role: "English & IELTS Coach", excerpt: "Three months of consistent practice. The key insight that changed everything for me.", likes: 412, comments: 37, tags: ["IELTS", "Languages"], createdAt: "5h ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-ielts/400/240" },
    { id: "b3", title: "What I wish I knew before starting a small business", author: "Huy Tran", role: "Full-stack Developer", excerpt: "Four years in, here are the hard lessons about regulations, hiring, and why co-founders matter.", likes: 189, comments: 24, tags: ["Business"], createdAt: "1d ago", readTime: "10 min read", image: "https://picsum.photos/seed/post-business/400/240" },
  ];

  let feed: any[] = [...BLOGS];

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    feed = feed.filter((b) =>
      (b.title || "").toLowerCase().includes(q) ||
      (b.excerpt || "").toLowerCase().includes(q) ||
      (b.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  }

  return (
    <div className={styles.postList}>
      {feed.slice(0, visibleCount).map((blog) => {
        const avatar = blog.avatar || `https://picsum.photos/seed/${encodeURIComponent(blog.author)}-avatar/60/60`;
        return (
          <article key={blog.id} role="button" tabIndex={0}
            onClick={() => router.push(`/discussions/blogs/${blog.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter") router.push(`/discussions/blogs/${blog.id}`); }}
            className={styles.post}>
            <div className={styles.avatarRail} onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(blog.author)); }}>
              <img src={avatar} alt={`${blog.author}'s profile`} loading="lazy" width="40" height="40" />
              <span className={styles.threadLine} aria-hidden="true" />
            </div>
            <div className={styles.postBody}>
              <div className={styles.postMeta}>
                <button onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(blog.author)); }} className={styles.author}>{blog.author}</button>
                <span className={styles.role}>· {blog.role}</span>
                <span className={styles.time}>· {blog.createdAt}</span>
                <button onClick={(e) => e.stopPropagation()} className={styles.moreButton} aria-label={`More options for ${blog.title}`}><IconDots size={20} /></button>
              </div>
              <p className={styles.articleLabel}>Article · {blog.readTime}</p>
              <h2 className={styles.articleTitle}>{blog.title}</h2>
              <p className={styles.articleExcerpt}>{blog.excerpt}</p>
              {blog.image && <img src={blog.image} alt={`Cover for ${blog.title}`} className={styles.postImage} loading="lazy" width="600" height="400" />}
              <div className={styles.tags}>
                {(blog.tags || []).map((t: string) => (
                  <button key={t} onClick={(e) => { e.stopPropagation(); router.push(`/discussions/tags/${encodeURIComponent(t)}`); }} className={styles.tag}>#{t.replaceAll(" ", "")}</button>
                ))}
              </div>
              <div className={styles.postActions}>
                <button onClick={(e) => e.stopPropagation()} className={styles.action} aria-label="Like article"><IconMessage2 size={17} /><span>{blog.likes}</span></button>
                <button onClick={(e) => e.stopPropagation()} className={styles.action} aria-label="View article replies"><IconMessage2 size={17} /><span>{blog.comments}</span></button>
              </div>
            </div>
          </article>
        );
      })}

      {visibleCount < feed.length && (
        <button onClick={() => setVisibleCount((c) => c + 8)} className={styles.loadMore}>Load more</button>
      )}

      {feed.length === 0 && (
        <div className="text-center py-12 text-sm text-muted border border-dashed border-border rounded-2xl">
          No articles found.
        </div>
      )}
    </div>
  );
}
