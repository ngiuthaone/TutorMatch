"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {BadgeCheck, Languages, Minus, MoreVertical, Captions, AudioLines, FileCheck2, Search, Trash2, X, Check, ChevronDown} from "lucide-react";
import { SearchableDropdown } from "../../ui/searchable-dropdown";

export interface CaptionTrack {
  id: string;
  language: string;
  format: "vtt" | "srt";
  fileName: string;
  lectureId: string;
  status: "uncaptioned" | "auto_generated" | "draft" | "published" | "needs_review";
  generated?: boolean;
}

export interface CaptionsData {
  languages: string[];
  activeLanguage: string;
  tracks: CaptionTrack[];
}

export interface CaptionsPageProps {
  initialData?: Partial<CaptionsData>;
  onChange?: (data: CaptionsData) => void;
  isComingSoon?: boolean;
}

const DEFAULT_LANGUAGES = ["English", "Vietnamese"];

const LANGUAGES = [
  "English","Vietnamese","French","German","Spanish","Portuguese","Italian","Japanese","Korean","Chinese (Simplified)",
  "Chinese (Traditional)","Hindi","Arabic","Russian","Turkish","Dutch","Polish","Swedish","Thai","Indonesian",
  "Czech","Greek","Hungarian","Romanian","Danish","Finnish","Norwegian","Ukrainian","Hebrew","Malay",
  "Filipino","Bengali","Punjabi","Tamil","Telugu","Marathi","Urdu","Persian","Swahili","Afrikaans",
];

const LECTURES: { id: string; title: string; fileName: string; duration: string }[] = [
  { id: "id-pucbugzk", title: "Welcome to the course", fileName: "welcome.mp4", duration: "4 min" },
  { id: "id-mgfpujvc", title: "What is a starter?", fileName: "starter-basics.mp4", duration: "8 min" },
  { id: "id-jceklk2l", title: "Mixing and autolyse", fileName: "mixing.mp4", duration: "6 min" },
  { id: "id-v6l6rfap", title: "Bulk fermentation", fileName: "bulk-fermentation.mp4", duration: "7 min" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "uncaptioned", label: "No captions" },
  { value: "auto_generated", label: "Auto-generated" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "needs_review", label: "Needs review" },
] as const;

const DEFAULTS: CaptionsData = {
  languages: DEFAULT_LANGUAGES,
  activeLanguage: "English",
  tracks: [
    { id: "cap_1", language: "English", format: "vtt", fileName: "welcome-en.vtt", lectureId: "id-pucbugzk", status: "published" },
    { id: "cap_2", language: "English", format: "vtt", fileName: "starter-basics-en.vtt", lectureId: "id-mgfpujvc", status: "draft" },
    { id: "cap_3", language: "Vietnamese", format: "srt", fileName: "mixing-vi.srt", lectureId: "id-jceklk2l", status: "needs_review" },
  ],
};

const SKELETON_COUNT = 4;

function SkeletonRow() {
  return (
    <div className="caption-row caption-skeleton" aria-hidden="true">
      <div className="skeleton-lecture">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-meta" />
      </div>
      <div className="skeleton-file">
        <div className="skeleton-line" />
      </div>
      <div className="skeleton-line skeleton-updated" />
      <div className="skeleton-box skeleton-action" />
    </div>
  );
}

function ComingSoonBanner() {
  return (
    <div className="caption-coming-soon">
      <Captions className="icon" aria-hidden="true" />
      <div>
        <strong>Captions — Coming soon</strong>
        <p>Accurate captions are on the way. You’ll soon be able to upload, review, and publish caption files for every lecture.</p>
      </div>
    </div>
  );
}

export default function CaptionsPage({ initialData, onChange, isComingSoon = false }: CaptionsPageProps) {
  const [data, setData] = useState<CaptionsData>({
    ...DEFAULTS,
    ...initialData,
  });
  const [filter, setFilter] = useState<"all" | "uncaptioned" | "auto_generated" | "draft" | "published" | "needs_review">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ trackId: string; lectureTitle: string } | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onChange?.(data);
  }, [data, onChange]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const update = (patch: Partial<CaptionsData>) =>
    setData((d) => ({ ...d, ...patch }));

  const handleAddLanguage = () => {
    if (typeof window === "undefined") return;
    const code = window.prompt("Language code (e.g. French, Japanese):");
    if (!code) return;
    if (data.languages.includes(code)) return;
    update({ languages: [...data.languages, code], activeLanguage: code });
  };

  const handleDisableLanguage = () => {
    if (data.languages.length <= 1) return;
    const next = data.languages.filter((l) => l !== data.activeLanguage);
    update({ languages: next, activeLanguage: next[0] ?? "English" });
  };

  const handleUpload = (lectureId: string, file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const detected: "vtt" | "srt" = lower.endsWith(".srt") ? "srt" : "vtt";

    const newTrack: CaptionTrack = {
      id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      language: data.activeLanguage,
      format: detected,
      fileName: file.name,
      lectureId,
      status: "draft",
    };
    update({ tracks: [...data.tracks, newTrack] });
  };

  const getTrack = (lectureId: string) =>
    data.tracks.find((t: CaptionTrack) => t.lectureId === lectureId && t.language === data.activeLanguage);

  const getTrackStatus = (lectureId: string): CaptionTrack["status"] => {
    const track = getTrack(lectureId);
    return track?.status ?? "uncaptioned";
  };

  const updateTrackStatus = (lectureId: string, status: CaptionTrack["status"]) => {
    setData((d) => ({
      ...d,
      tracks: d.tracks.map((t) =>
        t.lectureId === lectureId && t.language === d.activeLanguage ? { ...t, status } : t
      ),
    }));
  };

  const deleteTrack = (lectureId: string) => {
    setData((d) => ({
      ...d,
      tracks: d.tracks.filter((t) => !(t.lectureId === lectureId && t.language === d.activeLanguage)),
    }));
    setDeleteTarget(null);
  };

  const batchUpdateStatus = (status: CaptionTrack["status"]) => {
    setData((d) => ({
      ...d,
      tracks: d.tracks.map((t) =>
        selectedIds.includes(t.lectureId) && t.language === d.activeLanguage ? { ...t, status } : t
      ),
    }));
    setSelectedIds([]);
  };

  const toggleSelect = (lectureId: string) => {
    setSelectedIds((prev) =>
      prev.includes(lectureId) ? prev.filter((id) => id !== lectureId) : [...prev, lectureId]
    );
  };

  const toggleSelectAll = () => {
    const visible = visibleLectures.map((l) => l.id);
    const allSelected = visible.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visible);
  };

  const isStatusVisible = (lectureId: string, status: CaptionTrack["status"]) => {
    if (filter === "all") return true;
    return status === filter;
  };

  const captionedCount = LECTURES.filter((l) => getTrackStatus(l.id) !== "uncaptioned").length;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: LECTURES.length };
    for (const lecture of LECTURES) {
      const status = getTrackStatus(lecture.id);
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [data.tracks, data.activeLanguage]);

  const visibleLectures = LECTURES.filter((l) => isStatusVisible(l.id, getTrackStatus(l.id)));

  const getStatusLabel = (status: CaptionTrack["status"]) => {
    switch (status) {
      case "published": return "Published";
      case "draft": return "Draft";
      case "auto_generated": return "Auto-generated";
      case "needs_review": return "Needs review";
      default: return "No captions";
    }
  };

  const allVisibleSelected =
    visibleLectures.length > 0 && visibleLectures.every((l) => selectedIds.includes(l.id));
  const someVisibleSelected = visibleLectures.some((l) => selectedIds.includes(l.id)) && !allVisibleSelected;

  return (
    <>
      <div className="info">
        <BadgeCheck className="icon" aria-hidden="true" />
        <div>
          <strong>Aim for at least 99% caption accuracy</strong>
          <div className="help">
            Review automated captions for names, technical vocabulary, punctuation, speaker
            changes, and meaningful non-speech audio.
          </div>
        </div>
      </div>

      {isComingSoon && <ComingSoonBanner />}

      <div style={{ marginTop: 22 }}>
        <section className="caption-manager">
          <div className="caption-commandbar">
            <div className="caption-command-main">
              <div className="caption-command-title">Captions</div>
              <SearchableDropdown
                options={data.languages.map((l) => ({ value: l, label: l }))}
                value={data.activeLanguage}
                onChange={(value) => update({ activeLanguage: value })}
                placeholder="Select language"
                searchPlaceholder="Search languages..."
                emptyMessage="No languages found"
                className="caption-searchable-select"
              />
              <div className="caption-progress">
                {captionedCount}/{LECTURES.length} published lectures captioned
              </div>
            </div>
            <div className="caption-command-actions">
              <button
                type="button"
                className="btn btn-sm"
                data-add-caption-language
                onClick={handleAddLanguage}
              >
                <Languages className="icon" aria-hidden="true" />
                Add language
              </button>
              <button
                type="button"
                className="btn btn-sm"
                data-disable-caption-language
                onClick={handleDisableLanguage}
                disabled={data.languages.length <= 1}
              >
                Disable
              </button>
            </div>
          </div>

          <div className="caption-filterbar">
            {STATUS_OPTIONS.map((option) => {
              const count = option.value === "all" ? LECTURES.length : (statusCounts[option.value] || 0);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`caption-filter${filter === option.value ? " active" : ""}`}
                  data-caption-filter={option.value}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                  <span className="caption-filter-count">({count})</span>
                </button>
              );
            })}
          </div>

          {selectedIds.length > 0 && (
            <div className="caption-batch-bar">
              <span className="caption-batch-count">{selectedIds.length} selected</span>
              <div className="caption-batch-actions">
                <button type="button" className="btn btn-sm" onClick={() => batchUpdateStatus("published")}>
                  Publish
                </button>
                <button type="button" className="btn btn-sm" onClick={() => batchUpdateStatus("draft")}>
                  Mark as draft
                </button>
                <button type="button" className="btn btn-sm" onClick={() => batchUpdateStatus("needs_review")}>
                  Mark as needs review
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    const first = selectedIds[0];
                    const lecture = LECTURES.find((l) => l.id === first);
                    const track = lecture ? getTrack(lecture.id) : null;
                    setDeleteTarget({
                      trackId: track?.id ?? first,
                      lectureTitle: lecture?.title ?? "Selected item",
                    });
                  }}
                >
                  Delete
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelectedIds([])}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="caption-table">
            <div className="caption-table-head">
              <label className="caption-checkbox-cell">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleSelectAll}
                />
                <span>Lecture</span>
              </label>
              <span>Caption file</span>
              <span>Updated</span>
              <span />
            </div>

            {isLoading ? (
              Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonRow key={i} />)
            ) : visibleLectures.length === 0 ? (
              <div className="caption-empty-list">
                <Minus className="icon" aria-hidden="true" />
                <strong>No captions yet</strong>
                <p>Upload caption files for your published lectures to get started.</p>
              </div>
            ) : (
              visibleLectures.map((lecture) => {
                const track = getTrack(lecture.id);
                const status = getTrackStatus(lecture.id);
                const isSelected = selectedIds.includes(lecture.id);
                return (
                  <div
                    key={lecture.id}
                    className={`caption-row${isSelected ? " caption-row-selected" : ""}`}
                    data-captioned={track ? "1" : ""}
                  >
                    <div className="caption-checkbox-cell">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(lecture.id)}
                        aria-label={`Select ${lecture.title}`}
                      />
                    </div>
                    <div className="caption-lecture-name">
                      <div className="caption-lecture-header">
                        <div
                          className={`caption-status-dot caption-status-dot-${status}`}
                          role="img"
                          aria-label={getStatusLabel(status)}
                        />
                        <div className="caption-lecture-title">{lecture.title}</div>
                      </div>
                      <div className="caption-lecture-meta">
                        {lecture.fileName} · {lecture.duration}
                      </div>
                    </div>
                    <div className="caption-file-cell">
                      {track ? (
                        <div className="caption-file-status">
                          <Check className="icon" aria-hidden="true" />
                          <div>
                            <span className="caption-file-title">{track.fileName}</span>
                            {track.generated && <small>Auto-generated</small>}
                          </div>
                        </div>
                      ) : (
                        <div className="caption-file-status">
                          <Minus className="icon" aria-hidden="true" />
                          <div>
                            <span className="caption-file-title empty">No captions</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="caption-uploaded">{track ? "Just now" : "—"}</div>
                    <div className="caption-row-action">
                      <input
                        id={`caption-${lecture.id}`}
                        type="file"
                        accept=".vtt,.srt,text/vtt,application/x-subrip"
                        className="hidden"
                        onChange={(e) => handleUpload(lecture.id, e.target.files?.[0] ?? null)}
                      />
                      <label
                        htmlFor={`caption-${lecture.id}`}
                        className="btn btn-sm"
                        data-caption-row-file
                        data-file-id={`caption-${lecture.id}`}
                        data-item-id={lecture.id}
                        style={{ cursor: "pointer" }}
                      >
                        {track ? "Replace" : "Upload"}
                      </label>
                      <div className="caption-menu-wrapper" ref={menuRef}>
                        <button
                          type="button"
                          className="icon-btn caption-menu-button"
                          data-caption-menu={lecture.id}
                          disabled={!track}
                          aria-label="More actions"
                          onClick={() => setOpenMenuId(openMenuId === lecture.id ? null : lecture.id)}
                        >
                          <MoreVertical className="icon" aria-hidden="true" />
                          <ChevronDown className="icon caption-menu-chevron" aria-hidden="true" />
                        </button>
                        {openMenuId === lecture.id && track && (
                          <div className="caption-menu" role="menu">
                            <button type="button" role="menuitem" onClick={() => { updateTrackStatus(lecture.id, "published"); setOpenMenuId(null); }}>Publish</button>
                            <button type="button" role="menuitem" onClick={() => { updateTrackStatus(lecture.id, "draft"); setOpenMenuId(null); }}>Mark as draft</button>
                            <button type="button" role="menuitem" onClick={() => { updateTrackStatus(lecture.id, "needs_review"); setOpenMenuId(null); }}>Mark as needs review</button>
                            <button type="button" role="menuitem" className="caption-menu-danger" onClick={() => { setDeleteTarget({ trackId: track.id, lectureTitle: lecture.title }); setOpenMenuId(null); }}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {deleteTarget && (
        <div className="caption-modal-backdrop">
          <div className="caption-modal" role="dialog" aria-modal="true" aria-labelledby="caption-modal-title">
            <div className="caption-modal-body">
              <strong id="caption-modal-title">Delete captions?</strong>
              <p>This will remove captions for <strong>{deleteTarget.lectureTitle}</strong>. This action can’t be undone.</p>
            </div>
            <div className="caption-modal-actions">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteTrack(deleteTarget.trackId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
