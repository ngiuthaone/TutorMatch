"use client";
import React from "react";
import { ArrowLeft, Eye, Settings2, Save, ChevronLeft, Check } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const TUTORIA_CREATOR_COLORS = {
  bg: "#0d0d0f",
  ink: "#f1f1f2",
  muted: "#8f9096",
  mutedStronger: "#b8b8ba",
  panel: "#1c1c1f",
  input: "#111113",
  border: "rgba(52,52,56,0.5)",
  borderFocus: "rgba(138,138,145,0.3)",
  accent: "#ececed",
  accentHover: "#ffffff",
  accentMuted: "rgba(228,228,229,0.10)",
  danger: "#ff6b6b",
  success: "#a9c8b4",
  warning: "#d2b17b",
} as const;

export const FONT_DISPLAY = '"Instrument Sans","SF Pro Text",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
export const FONT_MONO = '"DM Mono",ui-monospace,SFMono-Regular,monospace';

export const NAV_PAGES = [
  { id: "intended-learners", label: "Intended learners", group: "Plan", optional: false },
  { id: "video-setup", label: "Video & setup", group: "Plan", optional: false },
  { id: "curriculum", label: "Curriculum", group: "Create", optional: false },
  { id: "captions", label: "Captions", group: "Create", optional: true },
  { id: "landing-page", label: "Course landing page", group: "Publish", optional: false },
  { id: "pricing", label: "Pricing", group: "Publish", optional: false },
  { id: "promotions", label: "Promotions", group: "Publish", optional: true },
  { id: "course-messages", label: "Course messages", group: "Publish", optional: true },
  { id: "submit-review", label: "Submit for review", group: "Publish", optional: false },
] as const;

export type NavPageId = (typeof NAV_PAGES)[number]["id"];

export interface CourseCreatorShellProps {
  courseId?: string;
  courseTitle?: string;
  saveStatus?: SaveStatus;
  currentPage: string;
  onNavigate: (page: string) => void;
  onSave?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSubmitForReview?: () => void;
  onPreview?: () => void;
  onShare?: () => void;
  onExit?: () => void;
  onPublish?: () => void;
  isPracticeTestMode?: boolean;
  pageKicker?: string;
  pageTitle?: string;
  pageDescription?: string;
  isOptionalPage?: boolean;
  completedPages?: string[];
  children: React.ReactNode;
}

function Topbar({
  courseTitle,
  saveStatus,
  onSave,
  onExit,
  onShare,
  onPreview,
  onPublish,
}: {
  courseTitle?: string;
  saveStatus: SaveStatus;
  onSave?: () => void;
  onExit?: () => void;
  onShare?: () => void;
  onPreview?: () => void;
  onPublish?: () => void;
}) {
  const label =
    saveStatus === "saving"
      ? "Saving"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save failed"
          : "Unsaved";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back"
          className="btn btn-ghost btn-sm"
        >
          <ArrowLeft className="icon" size={18} />
        </button>
        <div className="topbar-title">
          <span>tutoria</span>
          <span className="topbar-status" style={{ marginLeft: 2 }}>·</span>
          <span title={courseTitle}>{courseTitle || "Working title"}</span>
        </div>
      </div>

      <div className="topbar-right">
        <span className="topbar-status" data-save-label>
          {label}
        </span>
        {onPreview ? (
          <button type="button" onClick={onPreview} className="btn btn-sm">
            <Eye className="icon" size={16} />
            <span>Preview</span>
          </button>
        ) : null}
        {onShare ? (
          <button type="button" onClick={onShare} className="btn btn-sm">
            <Settings2 className="icon" size={16} />
            <span>Share</span>
          </button>
        ) : null}
        <button type="button" onClick={onSave} className="btn btn-sm" data-save>
          <Save className="icon" size={16} />
          <span>Save</span>
        </button>
        <button type="button" onClick={onPublish} className="btn btn-primary btn-sm">
          Publish
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  currentPage,
  onNavigate,
  completedPages,
  isPracticeTestMode,
}: {
  currentPage: string;
  onNavigate: (p: string) => void;
  completedPages: string[];
  isPracticeTestMode: boolean;
}) {
  const items = NAV_PAGES.filter((p) => {
    if (!isPracticeTestMode) return true;
    if (p.group === "Create") return false;
    return true;
  });

  const groups: { title: string; items: typeof items[number][] }[] = [
    { title: "Plan", items: items.filter((i) => i.group === "Plan") },
    { title: "Create", items: items.filter((i) => i.group === "Create") },
    { title: "Publish", items: items.filter((i) => i.group === "Publish") },
  ];

  return (
    <aside className="sidebar">
      <div className="side-summary">
        <h2>tutoria<span style={{ color: "#8e9298", marginLeft: 2 }}>·</span></h2>
        <p>Working title</p>
      </div>

      <nav>
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.title} className="nav-group">
              <div className="nav-group-title">{g.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {g.items.map((it) => {
                  const active = currentPage === it.id;
                  const done = completedPages.includes(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => onNavigate(it.id)}
                      data-page={it.id}
                      aria-current={active ? "page" : undefined}
                      className={`nav-item ${active ? "active" : ""} ${done ? "done" : ""}`}
                    >
                      <span className="nav-check" aria-hidden>
                        {done ? <Check size={10} /> : null}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </nav>
    </aside>
  );
}



function PageHeader({
  kicker,
  title,
  description,
  right,
}: {
  kicker?: string;
  title?: string;
  description?: string;
  right?: React.ReactNode;
}) {
  if (!kicker && !title && !description && !right) return null;
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div>
          {kicker ? (
            <div className="page-kicker">{kicker}</div>
          ) : null}
          {title ? (
            <h1 className="page-title">{title}</h1>
          ) : null}
          {description ? (
            <p className="page-desc">{description}</p>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </div>
  );
}

function Footer({
  onPrev,
  onSave,
  onNext,
  onSubmitForReview,
  saveStatus,
  nextLabel,
}: {
  onPrev?: () => void;
  onSave?: () => void;
  onNext?: () => void;
  onSubmitForReview?: () => void;
  saveStatus: SaveStatus;
  nextLabel?: string;
}) {
  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "All changes saved"
        : saveStatus === "error"
          ? "Save failed"
          : "Unsaved changes";

  return (
    <footer className="page-footer">
      <div className="page-footer-inner">
        <div className="row" style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <button type="button" onClick={onPrev} className="btn btn-sm">
            <ChevronLeft className="icon" size={16} />
            <span>Previous</span>
          </button>
        </div>
        <div className="row" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
          <span className="save-state">{saveLabel}</span>
          {onSubmitForReview ? (
            <button type="button" onClick={onSubmitForReview} className="btn btn-sm">
              Submit for review
            </button>
          ) : null}
          <button type="button" onClick={onSave} className="btn btn-sm">
            Save
          </button>
          <button type="button" onClick={onNext} className="btn btn-primary btn-sm">
            {nextLabel ?? "Save & continue"}
          </button>
        </div>
      </div>
    </footer>
  );
}

function MobileSectionNav({
  currentPage,
  onNavigate,
}: {
  currentPage: string;
  onNavigate: (p: string) => void;
}) {
  return (
    <div className="mobile-section-nav">
      <label htmlFor="section-select" style={{ fontSize: 11, fontWeight: 700, color: "#8f9096", whiteSpace: "nowrap" }}>
        Section
      </label>
      <select
        id="section-select"
        className="field"
        style={{ minHeight: 40, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
        value={currentPage}
        onChange={(e) => onNavigate(e.target.value)}
      >
        {NAV_PAGES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CourseCreatorShell({
  courseId,
  courseTitle,
  saveStatus = "idle",
  currentPage,
  onNavigate,
  onSave,
  onPrev,
  onNext,
  onSubmitForReview,
  onPreview,
  onShare,
  onExit,
  onPublish,
  isPracticeTestMode = false,
  pageKicker,
  pageTitle,
  pageDescription,
  isOptionalPage,
  completedPages = [],
  children,
}: CourseCreatorShellProps) {
  return (
    <div className="manage-shell" data-tutoria-creator data-course-id={courseId}>
      <Topbar
        courseTitle={courseTitle}
        saveStatus={saveStatus}
        onSave={onSave}
        onExit={onExit}
        onShare={onShare}
        onPreview={onPreview}
        onPublish={onPublish}
      />
      <MobileSectionNav currentPage={currentPage} onNavigate={onNavigate} />
      <div className="manage-grid">
        <Sidebar
          currentPage={currentPage}
          onNavigate={onNavigate}
          completedPages={completedPages}
          isPracticeTestMode={isPracticeTestMode}
        />
        <main className="main">
          <div className="page-wrap" data-page-content={currentPage}>
            <PageHeader
              kicker={pageKicker}
              title={pageTitle}
              description={pageDescription}
              right={isOptionalPage ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 9px",
                    borderRadius: 999,
                    border: "1px dashed #9da3a7",
                    background: TUTORIA_CREATOR_COLORS.panel,
                    fontFamily: FONT_DISPLAY,
                    fontSize: 9.5,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "#8f9096",
                    fontWeight: 700,
                  }}
                >
                  Optional
                </span>
              ) : null}
            />
            {children}
          </div>
        </main>
      </div>
      <Footer
        onPrev={onPrev}
        onSave={onSave}
        onNext={onNext}
        onSubmitForReview={onSubmitForReview}
        saveStatus={saveStatus}
      />
      <MobileSectionNav currentPage={currentPage} onNavigate={onNavigate} />
    </div>
  );
}
