"use client";
import React, { useEffect, useState } from "react";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string
}

export interface FaqData {
  faqs: FaqEntry[]
}

export interface FaqPageProps {
  initialData?: Partial<FaqData>;
  onChange?: (data: FaqData) => void
}

const MAX_FAQS = 10;

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function MessageCircleQuestionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export default function FaqPage({ initialData, onChange }: FaqPageProps) {
  const [faqs, setFaqs] = useState<FaqEntry[]>(
    () => initialData?.faqs ?? [{ id: `faq_${Date.now()}`, question: "", answer: "" }]
  );

  useEffect(() => {
    onChange?.({ faqs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faqs]);

  const complete = faqs.filter(
    (f) => f.question.trim() !== "" && f.answer.trim() !== ""
  ).length;
  const atMax = faqs.length >= MAX_FAQS;
  const onlyOne = faqs.length === 1;

  const addFaq = () => {
    if (atMax) return;
    setFaqs((prev) => [
      ...prev,
      { id: `faq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, question: "", answer: "" },
    ]);
  };

  const removeFaq = (id: string) => {
    if (onlyOne) return;
    setFaqs((prev) => prev.filter((f) => f.id !== id))
  };

  const updateFaq = (
    id: string,
    field: "question" | "answer",
    value: string
  ) => {
    setFaqs((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  return (
      <div>
    <div className="info" role="status">
        <MessageCircleQuestionIcon />
        <div>
          <strong>
            {complete} {complete === 1 ? "answer" : "answers"} ready
          </strong>
          <div className="help">
            Keep answers direct. Cover access, course format, required tools, certificates,
            support, or who the course is for.
          </div>
        </div>
      </div>

      <section className="section">
        <div className="stack">
          {faqs.map((f, i) => {
            const isComplete = f.question.trim() !== "" && f.answer.trim() !== "";
            return (
              <article
                key={f.id}
                style={{
                  border: "1px solid #38383d",
                  background: "#242427",
                  borderRadius: 6,
                  padding: 20,
                  marginTop: i > 0 ? 14 : 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 16,
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 4,
                        background: "#e4e4e5",
                        color: "#171719",
                        fontFamily: '"DM Mono", monospace',
                        fontSize: 10,
                        fontWeight: 600,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <strong style={{ fontSize: 14, fontWeight: 600, color: "#f1f1f2" }}>
                        Question {i + 1}
                      </strong>
                      <span style={{ fontSize: 12, color: "#8f9096" }}>
                        {isComplete ? "Visible in preview" : "Complete both fields to publish"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeFaq(f.id)}
                    disabled={onlyOne}
                    aria-label="Delete question"
                    title="Delete question"
                    style={{ opacity: onlyOne ? 0.4 : 1, cursor: onlyOne ? "not-allowed" : "pointer" }}
                  >
                    <TrashIcon />
                  </button>
                </div>

                <label style={{ display: "block", marginBottom: 6 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      color: "#8f9096",
                      marginBottom: 6,
                    }}
                  >
                    Question
                  </span>
                  <input
                    type="text"
                    className="field"
                    maxLength={160}
                    value={f.question}
                    onChange={(ev) => updateFaq(f.id, "question", ev.target.value)}
                    placeholder="e.g. Do I need any prior experience?"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px 14px",
                      fontSize: 14,
                      color: "#f1f1f2",
                      background: "#111113",
                      border: "1px solid #3b3b40",
                      borderRadius: 4,
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </label>

                <label style={{ display: "block", marginTop: 14 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      color: "#8f9096",
                      marginBottom: 6,
                    }}
                  >
                    Answer
                  </span>
                  <textarea
                    className="field"
                    maxLength={800}
                    value={f.answer}
                    onChange={(ev) => updateFaq(f.id, "answer", ev.target.value)}
                    placeholder="Give learners a clear, specific answer…"
                    style={{
                      display: "block",
                      width: "100%",
                      minHeight: 100,
                      padding: "12px 14px",
                      fontSize: 14,
                      color: "#f1f1f2",
                      background: "#111113",
                      border: "1px solid #3b3b40",
                      borderRadius: 4,
                      outline: "none",
                      boxSizing: "border-box",
                      resize: "vertical",
                      lineHeight: 1.6,
                      fontFamily: "inherit",
                    }}
                  />
                </label>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className="btn"
          onClick={addFaq}
          disabled={atMax}
          style={{
            marginTop: 14,
            opacity: atMax ? 0.4 : 1,
            cursor: atMax ? "not-allowed" : "pointer",
          }}
        >
          <PlusIcon />
          <span style={{ marginLeft: 8 }}>Add another question</span>
        </button>

        <div className="help" style={{ marginTop: 10 }}>
          Up to {MAX_FAQS} questions.
        </div>
      </section>
    </div>
  );
}

export { FaqPage };
