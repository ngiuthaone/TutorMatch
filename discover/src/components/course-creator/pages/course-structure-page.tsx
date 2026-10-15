"use client";
import React, { useEffect, useState } from "react";

export interface PlannedItem {
  id: string;
  type: "Lecture" | "Quiz" | "Practice Test" | "Assignment";
  title: string;
}

export interface PlannedSection {
  id: string;
  title: string;
  goal: string;
  items: PlannedItem[];
}

export interface CourseStructureData {
  sections: PlannedSection[];
  planChecks: {
    outcomes: boolean;
    practice: boolean;
    sections: boolean;
  };
  structureNotes: string;
}

export interface CourseStructurePageProps {
  initialData?: Partial<CourseStructureData>;
  outcomes?: string[];
  onChange?: (data: CourseStructureData) => void;
  onNavigate?: (page: string) => void;
}

const DEFAULT: CourseStructureData = {
  sections: [],
  planChecks: { outcomes: false, practice: false, sections: false },
  structureNotes: "",
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function CourseStructurePage({ initialData, outcomes = [], onChange, onNavigate }: CourseStructurePageProps) {
  const [data, setData] = useState<CourseStructureData>({
    ...DEFAULT,
    ...initialData,
    sections: initialData?.sections ?? [],
  });
  const [newTitle, setNewTitle] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    onChange?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const addSection = () => {
    if (!newTitle.trim()) return;
    setData((d) => ({
      ...d,
      sections: [...d.sections, { id: uid(), title: newTitle.trim(), goal: newGoal.trim(), items: [] }],
    }));
    setNewTitle("");
    setNewGoal("");
    setShowForm(false);
  };

  const updateSection = (id: string, patch: Partial<PlannedSection>) => {
    setData((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const deleteSection = (id: string) => {
    const sec = data.sections.find((s) => s.id === id);
    if (sec?.items.length && !confirm(`Delete "${sec.title}"? Its ${sec.items.length} planned items will be removed.`)) return;
    setData((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }));
  };

  const addItem = (sectionId: string, type: PlannedItem["type"]) => {
    const title = prompt(`${type} — Title:`);
    if (title === null) return;
    setData((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, { id: uid(), type, title: title.trim() || `New ${type}` }] } : s
      ),
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setData((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s
      ),
    }));
  };

  const hasOutcomes = outcomes.length > 0;
  const hasPractice = data.sections.some((s) => s.items.some((it) => ["Quiz", "Practice Test", "Assignment"].includes(it.type)));
  const allGoals = data.sections.length > 0 && data.sections.every((s) => s.goal.trim());
  const clearProgression = data.sections.length >= 2;

  return (
    <>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", border: "1px solid #e8e9eb", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 16 }}>
        PRIVATE · Only you can see these notes
      </div>

      <section className="section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Your outcomes</h2>
          <span style={{ fontSize: 11, color: "#8f9096" }}>{outcomes.length} outcome{outcomes.length === 1 ? "" : "s"}</span>
        </div>
        {hasOutcomes ? (
          <>
            <div className="panel" style={{ padding: 16 }}>
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                {outcomes.map((o, i) => (
                  <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{o}</li>
                ))}
              </ol>
            </div>
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onNavigate?.("intended-learners")}>
                View or edit in Intended learners →
              </button>
            </div>
          </>
        ) : (
          <div className="panel" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Define your outcomes first</div>
            <div className="help" style={{ marginBottom: 12 }}>Course structure works best when your learning outcomes are defined.</div>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate?.("intended-learners")}>
              Go to Intended learners
            </button>
          </div>
        )}
      </section>

      <section className="section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Private course outline</h2>
          <span style={{ fontSize: 11, color: "#8f9096", fontFamily: "monospace" }}>Private</span>
        </div>
        <p className="section-desc">Draft sections, lesson ideas, activities, projects, and assessments. These notes are private and never appear as learner content.</p>

        {data.sections.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", border: "1px dashed #cfd1d4", borderRadius: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Start planning your course</div>
            <div className="help" style={{ marginBottom: 12 }}>Begin with the outcomes above, then sketch the sections that will get learners there.</div>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowForm(true)}>
              Add first section
            </button>
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onNavigate?.("intended-learners")}>
                View learning outcomes
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {data.sections.map((sec, idx) => (
              <div key={sec.id} className="panel" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Section {idx + 1} — {sec.title}</div>
                    {sec.goal ? (
                      <div className="help" style={{ marginTop: 4 }}>Goal — {sec.goal}</div>
                    ) : (
                      <div className="help" style={{ marginTop: 4, color: "#a0a0a0" }}>No goal yet — add one</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flex: "none" }}>
                    <button type="button" className="icon-btn" title="Edit" onClick={() => {
                      const t = prompt("Section title:", sec.title);
                      if (t === null) return;
                      const g = prompt("Section goal:", sec.goal);
                      if (g === null) return;
                      updateSection(sec.id, { title: t.trim() || sec.title, goal: g.trim() });
                    }}>
                      ✎
                    </button>
                    <button type="button" className="icon-btn" title="Delete" onClick={() => deleteSection(sec.id)}>
                      ×
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8f9096", marginBottom: 6 }}>Planned items</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {sec.items.length === 0 ? (
                      <div className="help" style={{ padding: "8px 0" }}>No planned items yet.</div>
                    ) : (
                      sec.items.map((it) => (
                        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 12.5 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#8f9096" }}>{it.type}</span>
                          <span>{it.title}</span>
                          <button type="button" className="icon-btn" style={{ marginLeft: "auto", width: 24, height: 24 }} onClick={() => removeItem(sec.id, it.id)} title="Remove">
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => addItem(sec.id, "Lecture")}>
                    + Add
                  </button>
                  <span style={{ marginLeft: 6, fontSize: 11, color: "#8f9096" }}>Lecture / Quiz / Practice Test / Assignment</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!showForm ? (
          data.sections.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-sm" onClick={() => setShowForm(true)}>
                + Section
              </button>
            </div>
          )
        ) : (
          <div className="panel" style={{ marginTop: 12, padding: 16 }}>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span className="label">Section title</span>
              <input className="field" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Foundations of sourdough" />
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span className="label">Section goal</span>
              <textarea className="field" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="By the end of this section, learners can…" style={{ minHeight: 64 }} />
              <div className="help">Visible to learners goal — shown on the section header in Curriculum after handoff (editable there).</div>
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-sm" onClick={() => { setShowForm(false); setNewTitle(""); setNewGoal(""); }}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={addSection}>
                Create section
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Structure check</h2>
        <p className="section-desc">Lightweight guidance — not blocking. Fix what matters, skip the rest.</p>
        <div className="panel" style={{ padding: 16, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color: hasOutcomes && data.sections.length > 0 ? "#4ade80" : "#8f9096", fontWeight: 700 }}>{hasOutcomes && data.sections.length > 0 ? "✓" : "○"}</span>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>Outcomes covered</div><div className="help" style={{ margin: "2px 0 0" }}>{hasOutcomes && data.sections.length > 0 ? `Supported by ${data.sections.length} section${data.sections.length > 1 ? "s" : ""}` : "No sections yet"}</div></div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color: hasPractice ? "#4ade80" : "#8f9096", fontWeight: 700 }}>{hasPractice ? "✓" : "○"}</span>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>Practice included</div><div className="help" style={{ margin: "2px 0 0" }}>At least one Quiz, Practice Test, or Assignment planned</div></div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color: allGoals ? "#4ade80" : "#8f9096", fontWeight: 700 }}>{allGoals ? "✓" : "○"}</span>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>Sections have goals</div><div className="help" style={{ margin: "2px 0 0" }}>{allGoals ? "Every section has a clear goal" : `Section ${data.sections.findIndex((s) => !s.goal.trim()) + 1} does not have a goal yet`}</div></div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0" }}>
            <span style={{ color: clearProgression ? "#4ade80" : "#8f9096", fontWeight: 700 }}>{clearProgression ? "✓" : "○"}</span>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>Progression is clear</div><div className="help" style={{ margin: "2px 0 0" }}>{clearProgression ? "Sections follow a logical sequence" : "Add at least 2 sections for clear progression"}</div></div>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate?.("curriculum")}>
          Build curriculum →
        </button>
      </div>
      <p className="help" style={{ textAlign: "right", marginTop: 6 }}>Takes you to the Curriculum workspace where you build the actual learner experience.</p>
    </>
  );
}
