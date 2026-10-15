"use client";
import React, { useEffect, useState } from "react";
import { TEST_SUBMIT_REVIEW, TEST_COURSE_URL } from "../test-data";

export interface SubmitReviewData {
  courseUrl: string;
  identityVerified: boolean;
  termsAccepted: boolean;
  ready: boolean
}

export interface SubmitReviewPageProps {
  initialData?: Partial<SubmitReviewData>;
  onChange?: (data: SubmitReviewData) => void
}

const REVIEW_ROWS = TEST_SUBMIT_REVIEW.reviewRows;

const DEFAULTS: SubmitReviewData = { ...TEST_SUBMIT_REVIEW };

export default function SubmitReviewPage({ initialData, onChange }: SubmitReviewPageProps) {
  const [data, setData] = useState<SubmitReviewData>({
    ...DEFAULTS,
    ...initialData,
  });

  useEffect(() => {
    onChange?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const update = (patch: Partial<SubmitReviewData>) =>
    setData((d) => ({ ...d, ...patch }));

  const totalReqs = REVIEW_ROWS.length;
  const doneCount = REVIEW_ROWS.filter((r) => r.done).length;
  const percent = Math.round((doneCount / totalReqs) * 100);

  return (
    <>
      <div className="grid-2">
        <div className="panel panel-soft">
          <div className="review-percent">{percent}%</div>
          <strong>Ready for review</strong>
          <div className="help">
            {doneCount} of {totalReqs} submission requirements complete.
          </div>
          <div className="curriculum-meter">
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="panel">
          <label>
            <span className="label">Course URL</span>
            <div className="url-field">
              <span>tutoria.vn/course/</span>
              <input
                className="field"
                data-bind="courseUrl"
                value={data.courseUrl}
                placeholder="master-sourdough-bread-baking-at-home"
                onChange={(e) => update({ courseUrl: e.target.value })}
              />
            </div>
          </label>
          <div className="help">
            The URL must be unique and should remain stable after publication.
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        {REVIEW_ROWS.map((row) => (
          <div key={row.title} className={`review-row${row.done ? " done" : ""}`}>
            <div className="review-icon">{row.done ? "✓" : "!"}</div>
            <div>
              <div className="review-title">{row.title}</div>
              <div className="review-detail">{row.detail}</div>
            </div>
            {row.pageLink ? (
              <button
                type="button"
                className="btn btn-sm"
                data-page-link={row.pageLink}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const evt = new CustomEvent("course-creator-navigate", {
                      detail: row.pageLink,
                    });
                    window.dispatchEvent(evt);
                  }
                }}
              >
                {row.done ? "Review" : "Fix"}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <section className="section">
        <div className="grid-2">
          <label className="check-card">
            <input
              type="checkbox"
              data-bind-checkbox="identityVerified"
              checked={data.identityVerified}
              onChange={(e) => update({ identityVerified: e.target.checked })}
            />
            <span>
              <strong>Identity verification completed</strong>
              <span className="help" style={{ display: "block" }}>
                Required before the first marketplace publication.
              </span>
            </span>
          </label>
          <label className="check-card">
            <input
              type="checkbox"
              data-bind-checkbox="termsAccepted"
              checked={data.termsAccepted}
              onChange={(e) => update({ termsAccepted: e.target.checked })}
            />
            <span>
              <strong>I own or have permission to use all content</strong>
              <span className="help" style={{ display: "block" }}>
                Includes video, audio, images, code, downloads, trademarks, and third-party
                material.
              </span>
            </span>
          </label>
        </div>
      </section>

      <div className="review-submit">
        <div>
          <strong>Your course is ready</strong>
          <div className="help">
            A reviewer checks technical quality, landing-page accuracy, policy compliance, and
            learner experience.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-submit-review
          onClick={() => update({ ready: true })}
        >
          <svg
            data-lucide="send"
            className="icon"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-7 20-7" />
          </svg>
          Submit for review
        </button>
      </div>
    </>
  );
}

export { SubmitReviewPage };
