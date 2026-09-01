"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconUsers, IconLock, IconCheck, IconMessageCircle, IconAlertCircle } from "@tabler/icons-react";
import { getCommunity, joinCommunity, leaveCommunity, type Community, type CommunityMembership } from "@/lib/community/communities-api";
import { getSessionAccessToken } from "@/lib/auth/session";

export function CommunityDetailPage({ slug }: { slug: string }) {
  const router = useRouter();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<CommunityMembership | null>(null);
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

  useEffect(() => { load(); }, [load]);

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
          <button className="px-3 py-2 text-sm font-medium border-b-2 border-primary text-primary">Posts</button>
          <button className="px-3 py-2 text-sm text-muted hover:text-foreground">Threads</button>
          <button className="px-3 py-2 text-sm text-muted hover:text-foreground">About</button>
        </div>

        <div className="text-center py-12 text-sm text-muted">
          {isMember
            ? "Community posts will appear here. Use the create button to start a discussion."
            : "Join this community to see and create posts."}
        </div>
      </div>
    </div>
  );
}
