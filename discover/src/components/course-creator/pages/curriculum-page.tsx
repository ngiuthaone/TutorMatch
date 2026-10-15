"use client";

import React, { useCallback, useEffect, useState } from "react";

export type CurriculumItemType =
  | "lecture"
  | "quiz"
  | "practice-test"
  | "coding"
  | "assignment"
  | "role-play"
  | "lab";

export interface CurriculumItem {
  id: string;
  type: CurriculumItemType;
  title: string;
  fileName?: string;
  videoMinutes?: number;
  complete: boolean
}

export interface Section {
  id: string;
  title: string;
  goal: string;
  items: CurriculumItem[]
}

export interface CurriculumData {
  sections: Section[];
  addingSection: boolean
}

export interface CurriculumPageProps {
  initialData?: Partial<CurriculumData>;
  onChange?: (data: CurriculumData) => void
}

const ITEM_TYPE_LABELS: Record<CurriculumItemType, { name: string }> = {
  lecture: { name: "Lecture" },
  quiz: { name: "Quiz" },
  "practice-test": { name: "Practice test" },
  coding: { name: "Coding exercise" },
  assignment: { name: "Assignment" },
  "role-play": { name: "Role play" },
  lab: { name: "Lecture with lab" },
};

const DEFAULT_DATA: CurriculumData = {
  sections: [
    {
      id: "section-intro",
      title: "Introduction",
      goal: "Understand what the course covers and how to use it.",
      items: [
        {
          id: "item-welcome",
          type: "lecture",
          title: "Welcome to the course",
          fileName: "welcome.mp4",
          videoMinutes: 4,
          complete: true,
        },
      ],
    },
  ],
  addingSection: false,
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

function itemTypeName(type: CurriculumItemType): string {
  return ITEM_TYPE_LABELS[type]?.name ?? type
}

function isItemComplete(item: CurriculumItem): boolean {
  if (!item.title.trim()) return false;
  if (item.type === "lecture" || item.type === "lab") {
    return Boolean(item.fileName) && (item.videoMinutes ?? 0) > 0
  }
  return Boolean(item.title.trim());
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function DragIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}

interface AddItemMenuProps {
  onSelect: (type: CurriculumItemType) => void
}

const ITEM_DESCRIPTIONS: Record<CurriculumItemType, string> = {
  lecture: "Video, video & slides, or article",
  quiz: "Multiple-choice knowledge check",
  coding: "Hands-on programming task",
  "practice-test": "Timed exam-style assessment",
  assignment: "Open-ended learning task",
  "role-play": "Practice with an AI character",
  lab: "Hands-on browser environment",
};

function AddItemMenu({ onSelect }: AddItemMenuProps) {
  const watchTypes: CurriculumItemType[] = ["lecture"];
  const practiceTypes: CurriculumItemType[] = [
    "role-play",
    "quiz",
    "coding",
    "practice-test",
    "assignment",
    "lab",
  ];

  return (
    <div className="ud-add-menu" role="menu">
      <div className="ud-add-menu-label">Watch or read</div>
      {watchTypes.map((type) => {
        const meta = ITEM_TYPE_LABELS[type];
        return (
          <button
            key={type}
            type="button"
            className="ud-add-option"
            onClick={() => onSelect(type)}
            role="menuitem"
          >
            <span>
              <strong>{meta.name}</strong>
              <small>{ITEM_DESCRIPTIONS[type]}</small>
            </span>
            <span className="ud-lab-badge">With lab</span>
          </button>
        );
      })}
      <div className="ud-add-menu-label">Practice</div>
      {practiceTypes.map((type) => {
        const meta = ITEM_TYPE_LABELS[type];
        return (
          <button
            key={type}
            type="button"
            className="ud-add-option"
            onClick={() => onSelect(type)}
            role="menuitem"
          >
            <span>
              <strong>{meta.name}</strong>
              <small>{ITEM_DESCRIPTIONS[type]}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface InlineItemEditorProps {
  item: CurriculumItem;
  onChange: (patch: Partial<CurriculumItem>) => void;
  onDelete: () => void;
  onClose: () => void
}

function InlineItemEditor({ item, onChange, onDelete, onClose }: InlineItemEditorProps) {
  const typeName = itemTypeName(item.type);
  const isLecture = item.type === "lecture" || item.type === "lab";

  return (
    <div className="ud-inline-content">
      <div className="ud-inline-head">
        <strong>
          {item.title ? `Edit ${typeName.toLowerCase()}` : `New ${typeName.toLowerCase()}`}
        </strong>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          title="Close editor"
          aria-label="Close editor"
        >
          <XIcon />
        </button>
      </div>
      <div className="ud-inline-body">
        <div className="stack">
          <label className="ud-inline-title">
            <span className="label">{typeName} title</span>
            <input
              className="field"
              value={item.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={`Enter a ${typeName.toLowerCase()} title`}
            />
          </label>

          {isLecture && (
            <label>
              <span className="label">Video file name</span>
              <input
                className="field"
                value={item.fileName ?? ""}
                onChange={(e) => onChange({ fileName: e.target.value })}
                placeholder="e.g. welcome.mp4"
              />
            </label>
          )}

          {isLecture && (
            <label>
              <span className="label">Video length (minutes)</span>
              <input
                className="field"
                type="number"
                min={0}
                step={1}
                value={item.videoMinutes ?? 0}
                onChange={(e) =>
                  onChange({ videoMinutes: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </label>
          )}

          <label className="check-card">
            <input
              type="checkbox"
              checked={item.complete}
              onChange={(e) => onChange({ complete: e.target.checked })}
            />
            <span>
              <strong>Mark as complete</strong>
              <span className="help" style={{ display: "block" }}>
                Used to track curriculum readiness.
              </span>
            </span>
          </label>

          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              Delete {typeName.toLowerCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CurriculumPage({ initialData, onChange }: CurriculumPageProps) {
  const [sections, setSections] = useState<Section[]>(
    initialData?.sections ?? DEFAULT_DATA.sections,
  );
  const [addingSection, setAddingSection] = useState<boolean>(
    initialData?.addingSection ?? DEFAULT_DATA.addingSection,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [addItemMenuSectionId, setAddItemMenuSectionId] = useState<string | null>(null);

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionGoal, setNewSectionGoal] = useState("");

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [editSectionGoal, setEditSectionGoal] = useState("");

  useEffect(() => {
    onChange?.({ sections, addingSection });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, addingSection]);

  const updateSections = useCallback((next: Section[]) => setSections(next), []);

  const startAddSection = () => {
    setNewSectionTitle("");
    setNewSectionGoal("");
    setAddingSection(true);
    setAddItemMenuSectionId(null)
  };

  const cancelAddSection = () => {
    setAddingSection(false);
    setNewSectionTitle("");
    setNewSectionGoal("")
  };

  const confirmAddSection = () => {
    const title = newSectionTitle.trim() || "Untitled section";
    const goal = newSectionGoal.trim();
    const newSection: Section = { id: uid("section"), title, goal, items: [] };
    updateSections([...sections, newSection]);
    setAddingSection(false);
    setNewSectionTitle("");
    setNewSectionGoal("");
  };

  const startEditSection = (section: Section) => {
    setEditingSectionId(section.id);
    setEditSectionTitle(section.title);
    setEditSectionGoal(section.goal)
  };

  const cancelEditSection = () => {
    setEditingSectionId(null);
    setEditSectionTitle("");
    setEditSectionGoal("")
  };

  const saveEditSection = () => {
    if (!editingSectionId) return;
    const id = editingSectionId;
    updateSections(
      sections.map((s) =>
        s.id === id
          ? { ...s, title: editSectionTitle.trim() || s.title, goal: editSectionGoal.trim() }
          : s,
      ),
    );
    setEditingSectionId(null);
    setEditSectionTitle("");
    setEditSectionGoal("");
  };

  const deleteSection = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const label = section.title.trim() || "this section";
    if (typeof window !== "undefined") {
      const ok = window.confirm(`Delete "${label}"? This will also remove its items.`);
      if (!ok) return;
    }
    const next = sections.filter((s) => s.id !== sectionId);
    updateSections(next);
    if (
      selectedItemId &&
      !next.some((s) => s.items.some((i) => i.id === selectedItemId))
    ) {
      setSelectedItemId(null)
    }
    if (addItemMenuSectionId === sectionId) setAddItemMenuSectionId(null);
  };

  const toggleAddItemMenu = (sectionId: string) => {
    setAddItemMenuSectionId((prev) => (prev === sectionId ? null : sectionId));
    setSelectedItemId(null)
  };

  const addItem = (sectionId: string, type: CurriculumItemType) => {
    const newItem: CurriculumItem = {
      id: uid("item"),
      type,
      title: "",
      fileName: type === "lecture" || type === "lab" ? "" : undefined,
      videoMinutes: type === "lecture" || type === "lab" ? 0 : undefined,
      complete: false,
    };
    updateSections(
      sections.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s,
      ),
    );
    setAddItemMenuSectionId(null);
    setSelectedItemId(newItem.id);
  };

  const selectItem = (itemId: string) => {
    setAddItemMenuSectionId(null);
    setSelectedItemId((prev) => (prev === itemId ? null : itemId))
  };

  const updateItem = (sectionId: string, itemId: string, patch: Partial<CurriculumItem>) => {
    updateSections(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
            }
          : s,
      ),
    );
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    if (section.items.length <= 1) return;
    if (typeof window !== "undefined") {
      const item = section.items.find((i) => i.id === itemId);
      const label = item?.title.trim() || "this item";
      const ok = window.confirm(`Delete "${label}"?`);
      if (!ok) return;
    }
    updateSections(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
          : s,
      ),
    );
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  const moveItem = (sectionId: string, itemId: string, direction: -1 | 1) => {
    updateSections(
      sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.items.findIndex((i) => i.id === itemId);
        if (idx < 0) return s;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= s.items.length) return s;
        const items = s.items.slice();
        const [moved] = items.splice(idx, 1);
        items.splice(newIdx, 0, moved);
        return { ...s, items };
      }),
    );
  };

  const renderItemRow = (section: Section, item: CurriculumItem, itemIndex: number) => {
    const open = selectedItemId === item.id;
    const complete = isItemComplete(item);
    const typeName = itemTypeName(item.type);
    const isLecture = item.type === "lecture" || item.type === "lab";
    const defaultTitle = `Untitled ${typeName.toLowerCase()}`;
    const metaText = complete
      ? item.fileName
        ? `${item.fileName}${isLecture ? ` \u00b7 ${item.videoMinutes ?? 0} min` : ""}`
        : "Content complete"
      : "Add content to complete this item";

    return (
      <div className="ud-item-wrap" key={item.id}>
        <div className={`ud-item-row ${open ? "is-open" : ""}`.trim()}>
          <span className={`ud-item-state ${complete ? "" : "pending"}`.trim()}>
            {complete ? <CheckIcon /> : "!"}
          </span>
          <button
            type="button"
            className="ud-item-main"
            onClick={() => selectItem(item.id)}
            aria-expanded={open}
          >
            <div className="ud-item-title">
              <b>
                {typeName} {itemIndex + 1}:
              </b>{" "}
              {item.title.trim() || defaultTitle}
            </div>
            <div className="ud-item-meta">{metaText}</div>
          </button>
          {isLecture ? (
            <button
              type="button"
              className="btn btn-sm ud-content-btn"
              onClick={() => selectItem(item.id)}
            >
              <PlusIcon />
              {complete ? "Edit content" : "Content"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm ud-content-btn"
              onClick={() => selectItem(item.id)}
            >
              {complete ? "Edit" : "Set up"}
            </button>
          )}
          <div className="ud-row-menu">
            <button
              type="button"
              className="icon-btn"
              onClick={() => window.alert("Preview is not yet wired up.")}
              title="Preview"
              aria-label="Preview"
            >
              <EyeIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => selectItem(item.id)}
              title={open ? "Close" : "Open"}
              aria-label={open ? "Close" : "Open"}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => moveItem(section.id, item.id, -1)}
              disabled={itemIndex === 0}
              title="Move up"
              aria-label="Move up"
            >
              <ArrowUpIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => moveItem(section.id, item.id, 1)}
              disabled={itemIndex === section.items.length - 1}
              title="Move down"
              aria-label="Move down"
            >
              <ArrowDownIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => deleteItem(section.id, item.id)}
              disabled={section.items.length <= 1}
              title="Delete"
              aria-label="Delete"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
        {open && (
          <InlineItemEditor
            item={item}
            onChange={(patch) => updateItem(section.id, item.id, patch)}
            onDelete={() => deleteItem(section.id, item.id)}
            onClose={() => setSelectedItemId(null)}
          />
        )}
      </div>
    );
  };

  const renderSection = (section: Section, sectionIndex: number) => {
    const isEditing = editingSectionId === section.id;
    const menuOpen = addItemMenuSectionId === section.id;

    return (
      <section className="ud-section-box" key={section.id}>
        <header className="ud-section-head">
          <div className="ud-section-copy">
            <div className="ud-section-titleline">
              <strong>Section {sectionIndex + 1}:</strong>
              <FileIcon />
              {isEditing ? (
                <input
                  className="field"
                  style={{ minHeight: 32, padding: "4px 8px", fontSize: 14, maxWidth: 360 }}
                  value={editSectionTitle}
                  onChange={(e) => setEditSectionTitle(e.target.value)}
                  placeholder="Section title"
                  autoFocus
                />
              ) : (
                <span>{section.title.trim() || "Untitled section"}</span>
              )}
            </div>
            {isEditing ? (
              <div style={{ marginTop: 8 }}>
                <textarea
                  className="field"
                  style={{ minHeight: 64, padding: "6px 10px", fontSize: 12.5, maxWidth: 560 }}
                  value={editSectionGoal}
                  onChange={(e) => setEditSectionGoal(e.target.value)}
                  placeholder="What will students be able to do at the end of this section?"
                />
                <div className="row" style={{ marginTop: 8, gap: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={cancelEditSection}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={saveEditSection}
                  >
                    Save section
                  </button>
                </div>
              </div>
            ) : (
              section.goal.trim() && <div className="ud-section-goal">{section.goal}</div>
            )}
          </div>
          {!isEditing && (
            <div className="ud-section-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => startEditSection(section)}
                title="Edit section"
                aria-label="Edit section"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => deleteSection(section.id)}
                title="Delete section"
                aria-label="Delete section"
              >
                <TrashIcon />
              </button>
              <button
                type="button"
                className="icon-btn ud-section-drag"
                title="Drag section"
                aria-label="Drag section"
              >
                <DragIcon />
              </button>
            </div>
          )}
        </header>
        <div className="ud-section-body">
          {section.items.length === 0 ? (
            <div className="caption-empty-list">
              <strong>No curriculum items yet</strong>
            </div>
          ) : (
            section.items.map((item, itemIndex) => renderItemRow(section, item, itemIndex))
          )}
          <div className="ud-add-area">
            <button
              type="button"
              className="btn btn-sm ud-add-trigger"
              onClick={() => toggleAddItemMenu(section.id)}
              aria-expanded={menuOpen}
            >
              <PlusIcon />
              Curriculum item
            </button>
            {menuOpen && <AddItemMenu onSelect={(type) => addItem(section.id, type)} />}
          </div>
        </div>
      </section>
    );
  };

  return (
      <div>
<p className="ud-curriculum-note">
        Courses must include at least 5 lectures and 30 minutes of video content. Draft-course items
        are published automatically when the course is approved.
      </p>

      <div className="ud-curriculum-stack">
        {sections.map((section, sectionIndex) => renderSection(section, sectionIndex))}
      </div>

      <div className="ud-add-section-wrap">
        {addingSection ? (
          <div className="ud-new-section">
            <label>
              <span className="label">New section</span>
              <input
                className="field"
                placeholder="Enter a title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                autoFocus
              />
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              <span className="label">
                What will students be able to do at the end of this section?
              </span>
              <textarea
                className="field"
                placeholder="Enter a learning objective (optional)"
                value={newSectionGoal}
                onChange={(e) => setNewSectionGoal(e.target.value)}
              />
            </label>
            <div className="ud-new-section-actions">
              <button type="button" className="btn" onClick={cancelAddSection}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmAddSection}>
                Add section
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn ud-add-trigger" onClick={startAddSection}>
            <PlusIcon />
            Section
          </button>
        )}
      </div>
    </div>
  );
}
