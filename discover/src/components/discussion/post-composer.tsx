"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  IconX, IconPhoto, IconChevronDown, IconChevronUp,
  IconSend, IconDeviceFloppy, IconDots,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { TOPICS, SKILLS, COMMUNITIES, generateId, getUserFromStorage, estimateReadingTime } from "@/lib/types";
import type { PostDraft, ContentVisibility, ContentLevel, ReplyPermission, PostType, Attachment } from "@/lib/types";
import { savePostDraft, publishPost } from "@/lib/storage";

interface PostComposerProps {
  onClose: () => void;
  onPublished: () => void;
  preselectType?: string;
}

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: "insight", label: "Insight" },
  { value: "question", label: "Question" },
  { value: "tip", label: "Tip" },
  { value: "tutorial", label: "Tutorial" },
  { value: "experience", label: "Experience" },
  { value: "project", label: "Project" },
  { value: "discussion", label: "Discussion" },
];

export function PostComposer({ onClose, onPublished, preselectType }: PostComposerProps) {
  const router = useRouter();
  const user = getUserFromStorage();
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState<PostType | undefined>(
    preselectType === "question" ? "question" : undefined
  );
  const [visibility, setVisibility] = useState<ContentVisibility>("public");
  const [communityId, setCommunityId] = useState<string>("");
  const [topicName, setTopicName] = useState("");
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [level, setLevel] = useState<ContentLevel | undefined>();
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>("everyone");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showAudience, setShowAudience] = useState(false);
  const [showPostType, setShowPostType] = useState(false);
  const [showTopic, setShowTopic] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [draftId] = useState(() => generateId());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = body.trim().length > 0 || attachments.length > 0;
  const communityName = COMMUNITIES.find((c) => c.id === communityId)?.name;

  useEffect(() => {
    if (!hasContent) return;
    const timer = setTimeout(() => {
      setSaving(true);
      savePostDraft({
        id: draftId,
        body,
        postType,
        title: postType === "question" ? title : undefined,
        visibility,
        communityId: communityId || undefined,
        communityName,
        topicName: topicName || undefined,
        skillNames,
        level,
        replyPermission,
        attachments,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        skillIds: [],
      });
      setTimeout(() => setSaving(false), 300);
    }, 1500);
    return () => clearTimeout(timer);
  }, [body, postType, title, visibility, communityId, communityName, topicName, skillNames, level, replyPermission, attachments, hasContent, draftId]);

  const handlePublish = useCallback(() => {
    if (!hasContent && postType !== "question") return;
    if (postType === "question" && !title.trim() && !body.trim()) return;
    if (visibility === "community" && !communityId) return;
    setPublishing(true);
    const draft: PostDraft = {
      id: draftId,
      body,
      postType,
      title: postType === "question" ? title : undefined,
      visibility,
      communityId: communityId || undefined,
      communityName,
      topicName: topicName || undefined,
      skillNames,
      level,
      replyPermission,
      attachments,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      skillIds: [],
    };
    publishPost(draft);
    setTimeout(() => {
      setPublishing(false);
      onPublished();
      onClose();
    }, 400);
  }, [body, postType, title, visibility, communityId, communityName, topicName, skillNames, level, replyPermission, attachments, hasContent, draftId, onClose, onPublished]);

  const handleSaveDraft = useCallback(() => {
    savePostDraft({
      id: draftId,
      body,
      postType,
      title: postType === "question" ? title : undefined,
      visibility,
      communityId: communityId || undefined,
      communityName,
      topicName: topicName || undefined,
      skillNames,
      level,
      replyPermission,
      attachments,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      skillIds: [],
    });
    setSaving(true);
    setTimeout(() => setSaving(false), 300);
  }, [body, postType, title, visibility, communityId, communityName, topicName, skillNames, level, replyPermission, attachments, draftId]);

  const handleAddAttachment = useCallback((type: Attachment["type"]) => {
    if (type === "image") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files || []);
        files.forEach((file) => {
          if (file.size > 10 * 1024 * 1024) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            const url = e.target?.result as string;
            setAttachments((prev) => [
              ...prev,
              { id: generateId(), type: "image", url, fileName: file.name, mimeType: file.type, fileSize: file.size, sortOrder: prev.length, uploadStatus: "complete" },
            ]);
          };
          reader.readAsDataURL(file);
        });
      };
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleSkill = useCallback((skill: string) => {
    setSkillNames((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : prev.length < 5 ? [...prev, skill] : prev
    );
  }, []);

  const canPublish = postType === "question"
    ? (title.trim().length > 0 || body.trim().length > 0)
    : hasContent;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[640px] mx-4 my-8 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors" aria-label="Close">
              <IconX size={18} />
            </button>
            <span className="text-sm font-semibold text-foreground">Create</span>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[11px] text-muted">Saving\u2026</span>}
            <button onClick={handleSaveDraft}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors">
              <IconDeviceFloppy size={13} /> Save draft
            </button>
            <button onClick={handlePublish} disabled={!canPublish || publishing}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {publishing ? "Posting\u2026" : <><IconSend size={13} /> Post</>}
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "Y"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{user?.name || "You"}</span>
                <div className="relative">
                  <button onClick={() => setShowAudience((v) => !v)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border border-border text-muted hover:bg-surface transition-colors">
                    {visibility === "community" && communityName ? communityName : "Everyone"}
                    <IconChevronDown size={11} />
                  </button>
                  {showAudience && (
                    <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-border bg-background shadow-lg p-1.5 z-20">
                      <button onClick={() => { setVisibility("public"); setCommunityId(""); setShowAudience(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${visibility === "public" ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                        Everyone
                      </button>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Communities</p>
                      {COMMUNITIES.filter((c) => c.canPost).map((c) => (
                        <button key={c.id} onClick={() => { setVisibility("community"); setCommunityId(c.id); setShowAudience(false); }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${visibility === "community" && communityId === c.id ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {postType === "question" && (
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="What would you like to ask?"
                  className="mt-3 w-full text-sm font-medium text-foreground bg-transparent placeholder:text-muted/60 focus:outline-none border-b border-border pb-2" />
              )}

              <textarea ref={textareaRef} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder={postType === "question" ? "Add more context\u2026" : "Share an idea, question, lesson, or experience\u2026"}
                rows={Math.max(3, body.split("\n").length)}
                className="mt-3 w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none leading-relaxed" />

              {postType !== "question" && body.length > 4800 && (
                <p className="text-[11px] text-muted text-right">{5000 - body.length} characters remaining</p>
              )}

              {attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border">
                      {att.type === "image" && (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-border">
                          <img src={att.url} alt={att.altText || ""} className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{att.fileName || att.url}</p>
                        {att.fileSize && (
                          <p className="text-[11px] text-muted">{(att.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                        )}
                      </div>
                      <button onClick={() => removeAttachment(att.id)}
                        className="p-1 rounded text-muted hover:text-foreground hover:bg-border/50 transition-colors">
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border">
                <button onClick={() => handleAddAttachment("image")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
                  <IconPhoto size={15} /> Image
                </button>
                <button onClick={() => setShowMetadata((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors ml-auto">
                  <IconDots size={15} /> More
                </button>
              </div>

              {showMetadata && (
                <div className="mt-4 space-y-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1.5">Post type</p>
                    <div className="flex flex-wrap gap-1.5">
                      {POST_TYPES.map((pt) => (
                        <button key={pt.value} onClick={() => setPostType(postType === pt.value ? undefined : pt.value)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${postType === pt.value ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light" : "border-border text-muted hover:border-primary/30 hover:text-foreground"}`}>
                          {pt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-foreground mb-1.5">Topic</p>
                    <div className="relative">
                      <button onClick={() => setShowTopic((v) => !v)}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg border border-border text-foreground hover:bg-surface transition-colors">
                        {topicName || "Select a topic\u2026"}
                      </button>
                      {showTopic && (
                        <div className="absolute left-0 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                          {TOPICS.map((t) => (
                            <button key={t} onClick={() => { setTopicName(t === topicName ? "" : t); setShowTopic(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${t === topicName ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-foreground mb-1.5">Skills (up to 5)</p>
                    <div className="relative">
                      <input type="text" value={skillSearch} onChange={(e) => { setSkillSearch(e.target.value); setShowSkills(true); }}
                        onFocus={() => setShowSkills(true)} placeholder="Search skills\u2026"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary/40" />
                      {showSkills && (
                        <div className="absolute left-0 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                          {SKILLS.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase())).map((s) => (
                            <button key={s} onClick={() => toggleSkill(s)}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${skillNames.includes(s) ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                              {skillNames.includes(s) ? "\u2713 " : ""}{s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {skillNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {skillNames.map((s) => (
                          <span key={s} onClick={() => toggleSkill(s)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-primary/10 text-primary-dark dark:text-primary-light cursor-pointer">
                            {s} <IconX size={10} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-foreground mb-1.5">Level</p>
                    <div className="relative">
                      <button onClick={() => setShowLevel((v) => !v)}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg border border-border text-foreground hover:bg-surface transition-colors">
                        {level ? level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Select level\u2026"}
                      </button>
                      {showLevel && (
                        <div className="absolute left-0 top-full mt-1 w-full rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                          {(["complete_beginner", "beginner", "intermediate", "advanced", "all_levels"] as ContentLevel[]).map((l) => (
                            <button key={l} onClick={() => { setLevel(level === l ? undefined : l); setShowLevel(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${l === level ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                              {l.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-foreground mb-1.5">Who can reply?</p>
                    <div className="relative">
                      <button onClick={() => setShowReply((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-surface transition-colors">
                        {replyPermission === "everyone" ? "Everyone can reply" : replyPermission === "community_members" ? "Community members" : "No replies"}
                        <IconChevronDown size={12} />
                      </button>
                      {showReply && (
                        <div className="absolute left-0 top-full mt-1 w-44 rounded-xl border border-border bg-background shadow-lg p-1 z-10">
                          {(["everyone", "community_members", "disabled"] as ReplyPermission[]).map((rp) => (
                            <button key={rp} onClick={() => { setReplyPermission(rp); setShowReply(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${rp === replyPermission ? "bg-primary/10 text-primary-dark dark:text-primary-light font-medium" : "text-foreground hover:bg-surface"}`}>
                              {rp === "everyone" ? "Everyone" : rp === "community_members" ? "Community members" : "No replies"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
