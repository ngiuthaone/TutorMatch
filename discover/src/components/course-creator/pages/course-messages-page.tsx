"use client";
import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { TEST_COURSE_MESSAGES } from "../test-data";

export interface CourseMessagesData {
  welcome: string;
  completion: string;
  messagePreview: "welcome" | "completion";
  instructorName: string
}

export interface CourseMessagesPageProps {
  initialData?: Partial<CourseMessagesData>;
  onChange?: (data: CourseMessagesData) => void
}

const DEFAULTS: CourseMessagesData = {
  welcome: TEST_COURSE_MESSAGES.welcome,
  completion: TEST_COURSE_MESSAGES.completion,
  messagePreview: "welcome",
  instructorName: "Mai Tran",
};

export default function CourseMessagesPage({ initialData, onChange }: CourseMessagesPageProps) {
  const [data, setData] = useState<CourseMessagesData>({
    ...DEFAULTS,
    ...initialData,
  });

  useEffect(() => {
    onChange?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const update = (patch: Partial<CourseMessagesData>) =>
    setData((d) => ({ ...d, ...patch }));

  const preview = data.messagePreview === "completion" ? data.completion : data.welcome;
  const initial = (data.instructorName || "I")[0];

  return (
  <>
<div className="info">
        <ShieldCheck className="icon" aria-hidden={true} />
        <div>
          <strong>Keep these messages course-focused</strong>
          <div className="help">
            Do not include coupon codes, unrelated promotions, or requests to move learners
            away from the learning experience.
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 22 }}>
        <div className="stack">
          <label>
            <div className="row between">
              <span className="label">Welcome message</span>
              <span className="count">{data.welcome.length}/1000</span>
            </div>
            <textarea
              className="field"
              maxLength={1000}
              data-bind="welcome"
              style={{ minHeight: 190 }}
              placeholder="Welcome learners and tell them how to begin."
              value={data.welcome}
              onChange={(e) => update({ welcome: e.target.value })}
            />
          </label>

          <label>
            <div className="row between">
              <span className="label">Congratulations message</span>
              <span className="count">{data.completion.length}/1000</span>
            </div>
            <textarea
              className="field"
              maxLength={1000}
              data-bind="completion"
              style={{ minHeight: 190 }}
              placeholder="Celebrate completion and suggest appropriate next steps."
              value={data.completion}
              onChange={(e) => update({ completion: e.target.value })}
            />
          </label>
        </div>

        <aside className="message-preview">
          <div className="preview-tabs">
            <button
              type="button"
              className={`preview-tab${data.messagePreview === "welcome" ? " active" : ""}`}
              data-message-preview="welcome"
              onClick={() => update({ messagePreview: "welcome" })}
            >
              Welcome
            </button>
            <button
              type="button"
              className={`preview-tab${data.messagePreview === "completion" ? " active" : ""}`}
              data-message-preview="completion"
              onClick={() => update({ messagePreview: "completion" })}
            >
              Completion
            </button>
          </div>

          <div className="message-bubble">
            <div className="preview-avatar">{initial}</div>
            <div>
              <strong>{data.instructorName || "Instructor"}</strong>
              <p>{preview || "Your message preview appears here."}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export { CourseMessagesPage };
