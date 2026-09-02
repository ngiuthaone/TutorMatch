"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconAlertCircle, IconCheck, IconLock, IconUsers } from "@tabler/icons-react";
import {
  getCommunity, updateCommunity, archiveCommunity,
  listCommunityMembers, approveMember, banMember, setMemberRole,
  type Community, type CommunityMember,
} from "@/lib/community/communities-api";
import { getSessionAccessToken } from "@/lib/auth/session";

export function CommunitySettingsPage({ slug }: { slug: string }) {
  const router = useRouter();
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "request" | "invite">("open");
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCommunity(slug);
      setCommunity(c);
      setName(c.name);
      setDescription(c.description ?? "");
      setVisibility(c.visibility);
      setJoinPolicy(c.join_policy);
      setIsOwner(c.membership?.is_owner ?? false);
      if (c.membership?.is_moderator && c.id) {
        const m = await listCommunityMembers(c.id, {});
        setMembers(m.members);
      }
    } catch {
      setError("Community not found or unavailable.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async () => {
    if (!community) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateCommunity(community.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        joinPolicy,
      });
      setSuccess("Settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [community, name, description, visibility, joinPolicy]);

  const handleArchive = useCallback(async () => {
    if (!community) return;
    if (!confirm("Archive this community? Members will lose access.")) return;
    try {
      await archiveCommunity(community.id);
      router.push("/communities");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive.");
    }
  }, [community, router]);

  const handleApprove = useCallback(async (userId: string) => {
    if (!community) return;
    try {
      await approveMember(community.id, userId);
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, status: "active" } : m));
    } catch { /* silently fail */ }
  }, [community]);

  const handleBan = useCallback(async (userId: string) => {
    if (!community) return;
    if (!confirm("Ban this member?")) return;
    try {
      await banMember(community.id, userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch { /* silently fail */ }
  }, [community]);

  const handlePromote = useCallback(async (userId: string, role: "moderator" | "member") => {
    if (!community) return;
    try {
      await setMemberRole(community.id, userId, role);
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m));
    } catch { /* silently fail */ }
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

  if (!isOwner) {
    return (
      <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
        <div className="mx-auto max-w-[680px] px-4 py-8 text-center">
          <p className="text-muted">Only the community owner can access settings.</p>
          <Link href={`/communities/${community.slug}`} className="text-sm text-primary hover:underline mt-2 inline-block">Back to community</Link>
        </div>
      </div>
    );
  }

  const pendingMembers = members.filter(m => m.status === "pending");

  return (
    <div className="min-h-[100dvh] bg-[#070b12] text-foreground">
      <div className="mx-auto max-w-[680px] px-4 py-6">
        <Link href={`/communities/${community.slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
          <IconArrowLeft size={14} /> Back to community
        </Link>
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-muted mb-6">/{community.slug}</p>

        {error && (
          <div className="mb-3 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex items-center gap-2">
            <IconAlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="mb-3 px-4 py-2 rounded-xl border border-green-500/30 bg-green-500/10 text-green-200 text-sm flex items-center gap-2">
            <IconCheck size={14} /> {success}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setVisibility("public")} className={`text-left px-3 py-2.5 rounded-xl border ${visibility === "public" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                <div className="text-sm font-medium">Public</div>
                <div className="text-xs text-muted">Anyone can see this community</div>
              </button>
              <button type="button" onClick={() => setVisibility("private")} className={`text-left px-3 py-2.5 rounded-xl border flex items-start gap-2 ${visibility === "private" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                <IconLock size={14} className="mt-0.5 text-muted" />
                <div>
                  <div className="text-sm font-medium">Private</div>
                  <div className="text-xs text-muted">Only members can see content</div>
                </div>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">How people join</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setJoinPolicy("open")} className={`text-left px-3 py-2.5 rounded-xl border ${joinPolicy === "open" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                <div className="text-sm font-medium">Open</div>
              </button>
              <button type="button" onClick={() => setJoinPolicy("request")} className={`text-left px-3 py-2.5 rounded-xl border ${joinPolicy === "request" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                <div className="text-sm font-medium">Request</div>
              </button>
              <button type="button" onClick={() => setJoinPolicy("invite")} className={`text-left px-3 py-2.5 rounded-xl border ${joinPolicy === "invite" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                <div className="text-sm font-medium">Invite</div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark disabled:opacity-40">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {pendingMembers.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5 mb-4">
            <h2 className="text-sm font-semibold mb-3">Pending requests ({pendingMembers.length})</h2>
            <div className="space-y-2">
              {pendingMembers.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-background">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {(m.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm">{m.name}</span>
                  <button onClick={() => handleApprove(m.user_id)} className="px-3 py-1 text-xs font-medium rounded-lg bg-primary text-white">Approve</button>
                  <button onClick={() => handleBan(m.user_id)} className="px-3 py-1 text-xs font-medium rounded-lg border border-border text-muted hover:text-red-400">Reject</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <h2 className="text-sm font-semibold text-red-300 mb-2 flex items-center gap-2">
            <IconAlertCircle size={14} /> Danger zone
          </h2>
          <p className="text-xs text-muted mb-3">Archiving hides the community. Members lose access. This cannot be undone from the UI.</p>
          <button onClick={handleArchive} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/10">
            Archive community
          </button>
        </div>
      </div>
    </div>
  );
}
