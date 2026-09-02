"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconPlus, IconSearch, IconLock, IconUsers, IconMessageCircle } from "@tabler/icons-react";
import { listCommunities, type Community } from "@/lib/community/communities-api";
import { getSessionAccessToken } from "@/lib/auth/session";

export function CommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCommunities({ cursor: reset ? null : cursor, limit: 20, q: query || null });
      setCommunities(prev => reset ? result.communities : [...prev, ...result.communities]);
      setCursor(result.nextCursor);
      setHasMore(result.nextCursor !== null);
    } catch {
      setError("Communities are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [cursor, query]);

  const loadRef = useRef(load);
  // eslint-disable-next-line react-hooks/refs
  loadRef.current = load;

  useEffect(() => {
    loadRef.current(true);
  }, [query]);

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Communities</h1>
            <p className="text-sm text-muted mt-1">Public learning communities</p>
          </div>
          <button
            onClick={() => {
              if (getSessionAccessToken()) router.push("/communities/new");
              else router.push("/auth/sign-in?next=/communities/new");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark"
          >
            <IconPlus size={16} /> Create
          </button>
        </div>

        <div className="relative mb-4">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-none focus:border-primary"
          />
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">{error}</div>
        )}

        {loading && communities.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-20 rounded-2xl bg-surface" />)}
          </div>
        ) : communities.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p>No communities yet.</p>
            <p className="text-xs mt-2">Be the first to start one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {communities.map(c => <CommunityCard key={c.id} community={c} />)}
          </div>
        )}

        {hasMore && !loading && (
          <button onClick={() => load(false)} className="w-full mt-6 py-2.5 text-sm rounded-xl border border-border text-muted hover:text-foreground">
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

function CommunityCard({ community }: { community: Community }) {
  return (
    <Link
      href={`/communities/${encodeURIComponent(community.slug)}`}
      className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {community.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{community.name}</h3>
            {community.visibility === "private" && <IconLock size={12} className="text-muted" />}
            {community.is_member && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">Joined</span>}
          </div>
          {community.description && <p className="text-xs text-muted line-clamp-2 mt-0.5">{community.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><IconUsers size={11} />{community.member_count}</span>
            <span className="inline-flex items-center gap-1"><IconMessageCircle size={11} />{community.post_count + community.thread_count}</span>
            <span className="px-1.5 py-0.5 rounded bg-border/30">
              {community.join_policy === "open" ? "Open" : community.join_policy === "request" ? "Request" : "Invite only"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
