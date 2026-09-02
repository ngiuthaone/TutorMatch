"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconUsers, IconLock, IconCheck, IconMessageCircle, IconAlertCircle } from "@tabler/icons-react";
import { getCommunity, joinCommunity, leaveCommunity, type Community, type CommunityMembership } from "@/lib/community/communities-api";
import { getSessionAccessToken } from "@/lib/auth/session";

export function CommunityDetailPage({ slug }: { slug: string }) {
  const router = useRouter();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<CommunityMembership | null>(null);
  const [tab, setTab] = useState<"posts" | "threads" | "about">("posts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCommunity(slug);
      setCommunity(c);
      setMembership(c.membership);
    } catch {
      setError("Community not found or unavailable.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadRef = useRef(load);
  // eslint-disable-next-line react-hooks/refs
  loadRef.current = load;

  useEffect(() => {
    loadRef.current();
  }, []);

  const handleJoin = useCallback(async () => {
    if (!getSessionAccessToken()) {
      router.push(`/auth/sign-in?next=/communities/${slug}`);
      return;
    }
    if (!community) return;
    setActionLoading(true);
    setError(null);
    try {
      const result = await joinCommunity(community.id);
      if (result.status === "active") {
        setMembership(prev => prev ? { ...prev, is_member: true, is_pending: false } : prev);
        setSuccess("Joined the community.");
      } else {
        setMembership(prev => prev ? { ...prev, is_pending: true } : prev);
        setSuccess("Join request sent. A moderator will review it.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join.");
    } finally {
      setActionLoading(false);
    }
  }, [community, router, slug]);

  const handleLeave = useCallback(async () => {
    if (!community) return;
    if (!confirm("Leave this community?")) return;
    setActionLoading(true);
    try {
      await leaveCommunity(community.id);
      setMembership(prev => prev ? { ...prev, is_member: false, is_pending: false } : prev);
      setSuccess("Left the community.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave.");
    } finally {
      setActionLoading(false);
    }
  }, [community]);

  if (loading || !community) {
    return (
      <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
        <div className="mx-auto max-w-[680px] px-4 py-8">
          <div className="animate-pulse h-40 rounded-2xl bg-surface" />
        </div>
      </div>
    );
  }

  if (error && !community) {
    return (
      <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
        <div className="mx-auto max-w-[680px] px-4 py-8 text-center">
          <p className="text-muted">{error}</p>
          <Link href="/communities" className="text-sm text-primary hover:underline mt-2 inline-block">Back to communities</Link>
        </div>
      </div>
    );
  }

  const isMember = membership?.is_member;
  const isPending = membership?.is_pending;
  const isMod = membership?.is_moderator;

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-6">
        <Link href="/communities" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
          <IconArrowLeft size={14} /> All communities
        </Link>

        {success && (
          <div className="mb-3 px-4 py-2 rounded-xl border border-green-500/30 bg-green-500/10 text-green-200 text-sm flex items-center gap-2">
            <IconCheck size={14} /> {success}
          </div>
        )}
        {error && (
          <div className="mb-3 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex items-center gap-2">
            <IconAlertCircle size={14} /> {error}
          </div>
        )}

        {/* Header */}
        <div className="rounded-2xl border border-border bg-surface p-5 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {community.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{community.name}</h1>
                {community.visibility === "private" && <IconLock size={14} className="text-muted" />}
              </div>
              <div className="text-xs text-muted">/{community.slug}</div>
              {community.description && <p className="text-sm text-muted mt-2">{community.description}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><IconUsers size={12} />{community.member_count} members</span>
                <span className="inline-flex items-center gap-1"><IconMessageCircle size={12} />{community.post_count + community.thread_count} posts</span>
                <span className="px-1.5 py-0.5 rounded bg-border/30">
                  {community.join_policy === "open" ? "Open join" : community.join_policy === "request" ? "Approval required" : "Invite only"}
                </span>
              </div>
            </div>
            <div className="shrink-0">
              {isMod ? (
                <Link href={`/communities/${community.slug}/settings`} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:border-primary/30">
                  Manage
                </Link>
              ) : isMember ? (
                <button onClick={handleLeave} disabled={actionLoading} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:border-primary/30">
                  Joined
                </button>
              ) : isPending ? (
                <button disabled className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted cursor-not-allowed">
                  Pending
                </button>
              ) : (
                <button onClick={handleJoin} disabled={actionLoading} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50">
                  {actionLoading ? "Joining…" : community.join_policy === "request" ? "Request to join" : "Join"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-border mb-4">
          <button onClick={() => setTab("posts")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "posts" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}>Posts</button>
          <button onClick={() => setTab("threads")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "threads" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}>Threads</button>
          <button onClick={() => setTab("about")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "about" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}>About</button>
          {isMember && (
            <div className="ml-auto flex items-center gap-2">
              <Link href={`/discussions/new?community=${community.id}`} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark">
                New post
              </Link>
              <Link href={`/threads/new?community=${community.id}`} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:border-primary/30">
                New thread
              </Link>
            </div>
          )}
        </div>

        {tab === "posts" && (
          <CommunityPostsTab communityId={community.id} communitySlug={community.slug} isMember={isMember} canModerate={!!isMod} />
        )}
        {tab === "threads" && (
          <CommunityThreadsTab communityId={community.id} communitySlug={community.slug} isMember={isMember} canModerate={!!isMod} />
        )}
        {tab === "about" && (
          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
            <p>Community slug: <span className="text-foreground font-mono">/{community.slug}</span></p>
            <p className="mt-2">Visibility: <span className="text-foreground">{community.visibility}</span></p>
            <p className="mt-2">Join policy: <span className="text-foreground">{community.join_policy}</span></p>
            <p className="mt-2">Created: <span className="text-foreground">{new Date(community.created_at).toLocaleDateString()}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityPostsTab({ communityId, communitySlug, isMember, canModerate }: { communityId: string; communitySlug: string; isMember?: boolean; canModerate: boolean }) {
  const [posts, setPosts] = useState<import("@/lib/community/posts-api").Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    import("@/lib/community/posts-api").then(({ listPosts }) => {
      listPosts({ communityId, limit: 20 })
        .then((r) => { if (!cancelled) { setPosts(r.posts); setLoading(false); } })
        .catch(() => { if (!cancelled) { setError("Posts are temporarily unavailable."); setLoading(false); } });
    });
    return () => { cancelled = true; };
  }, [communityId]);

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="animate-pulse h-24 rounded-2xl bg-surface" />)}</div>;
  if (error) return <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm p-4">{error}</div>;
  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted">
        {isMember ? "No posts yet. Be the first to share something." : "Join this community to see posts."}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Link key={p.id} href={`/discussions?post=${p.id}`} className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-2 mb-1.5 text-xs text-muted">
            <span className="font-medium text-foreground">{p.author.name}</span>
            {p.author.role && <span>· {p.author.role}</span>}
            <span>· {new Date(p.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-foreground line-clamp-3">{p.body}</p>
          {p.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {p.tags.slice(0, 3).map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-border/30 text-muted">#{t}</span>)}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted">
            <span>♥ {p.like_count}</span>
            <span>💬 {p.comment_count}</span>
            <span>↻ {p.repost_count}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CommunityThreadsTab({ communityId, communitySlug, isMember, canModerate }: { communityId: string; communitySlug: string; isMember?: boolean; canModerate: boolean }) {
  const [threads, setThreads] = useState<import("@/lib/community/threads-api").ReferenceThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    import("@/lib/community/threads-api").then(({ listThreads }) => {
      listThreads({ communityId, limit: 20 })
        .then((r) => { if (!cancelled) { setThreads(r.threads); setLoading(false); } })
        .catch(() => { if (!cancelled) { setError("Threads are temporarily unavailable."); setLoading(false); } });
    });
    return () => { cancelled = true; };
  }, [communityId]);

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="animate-pulse h-24 rounded-2xl bg-surface" />)}</div>;
  if (error) return <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm p-4">{error}</div>;
  if (threads.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted">
        {isMember ? "No threads yet. Start a reference thread to discuss a resource." : "Join this community to see threads."}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {threads.map((t) => (
        <Link key={t.id} href={`/threads/${t.id}`} className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-2 mb-1.5 text-xs text-muted">
            <span className="font-medium text-foreground">{t.creator.name}</span>
            {t.creator.role && <span>· {t.creator.role}</span>}
            <span>· {new Date(t.created_at).toLocaleDateString()}</span>
            {t.status === "closed" && <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-400">Closed</span>}
          </div>
          <h3 className="text-sm font-semibold">{t.title}</h3>
          {t.body && <p className="text-xs text-muted line-clamp-2 mt-1">{t.body}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted">
            <span>♥ {t.appreciated_count}</span>
            <span>↩ {t.reply_count}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
