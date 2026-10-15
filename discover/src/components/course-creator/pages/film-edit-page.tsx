"use client";
import React, { useEffect, useState } from "react";
import { TEST_FILM_EDIT } from "../test-data";
import {AudioLines, ExternalLink, MonitorPlay, Presentation, Scissors, Video} from "lucide-react";
type IconProps = { className?: string; "aria-hidden"?: boolean };
const ICON_MAP: Record<string, React.FC<IconProps>> = {
  "monitor-play": MonitorPlay,
  "audio-lines": AudioLines,
  presentation: Presentation,
  scissors: Scissors,
};

export interface FilmEditData {
  acknowledged: boolean
}

export interface FilmEditPageProps {
  initialData?: Partial<FilmEditData>;
  onChange?: (data: FilmEditData) => void
}

const DEFAULTS: FilmEditData = { acknowledged: false }


const TIPS = [
  {
    title: "Script or outline each lecture",
    body: "Plan what you will say and show before recording. A clear script or speaking outline keeps delivery concise and reduces editing time.",
  },
  {
    title: "Keep one objective per lecture",
    body: "Make the purpose clear at the start, teach the concept or task, then recap the key takeaway before moving on.",
  },
  {
    title: "Prioritize clear audio",
    body: "Record close to the microphone, reduce echo and background noise, and make sure audio is present in both channels and synchronized with video.",
  },
  {
    title: "Use dynamic, relevant visuals",
    body: "Show the instructor, demonstrations, screencasts, diagrams, or other visuals that directly support the narration. Avoid audio-only video or long static slides.",
  },
  {
    title: "Edit distractions out",
    body: "Remove long pauses, verbal mistakes, repeated takes, and anything that prevents the learner from following the explanation.",
  },
  {
    title: "Export in a learner-ready format",
    body: "Use horizontal 16:9 video at 720p or 1080p. Check readability at normal playback size before uploading.",
  },
  {
    title: "Keep your original files",
    body: "Store recordings, project files, slides, and final exports outside the platform so you can revise or replace lectures later.",
  },
];

const REQUIREMENTS = [
  {
    icon: "monitor-play",
    title: "HD, horizontal video",
    body: "Minimum 720p resolution with a 16:9 aspect ratio.",
  },
  {
    icon: "audio-lines",
    title: "Clear, synchronized audio",
    body: "Speech must be easy to understand, free of distracting noise, and audible through both channels.",
  },
  {
    icon: "presentation",
    title: "Relevant visual instruction",
    body: "Visuals should be dynamic, custom, and clearly connected to what is being taught.",
  },
  {
    icon: "scissors",
    title: "Concise delivery",
    body: "Edit out mistakes, long pauses, tangents, and other distractions.",
  },
];

const RESOURCES = [
  {
    title: "Video standards",
    sub: "Resolution, aspect ratio, and visual-quality requirements",
    href: "https://support.udemy.com/hc/en-us/articles/229232767-Video-standards",
  },
  {
    title: "Audio standards",
    sub: "Clarity, synchronization, and noise guidance",
    href: "https://support.udemy.com/hc/en-us/articles/229232367-Audio-Standards",
  },
  {
    title: "Instructor delivery",
    sub: "Speaking, scripting, pace, and editing recommendations",
    href: "https://support.udemy.com/hc/en-us/articles/229605228-Instructor-delivery-Quality-standards",
  },
  {
    title: "Audio and video tools",
    sub: "Recording, lighting, screencast, and editing options",
    href: "https://teach.udemy.com/wp-content/uploads/2021/07/AudioVideoTools_EN.pdf",
  },
];

export default function FilmEditPage({ initialData, onChange }: FilmEditPageProps) {
  const data: FilmEditData = { ...DEFAULTS, ...initialData }

  const [guideCompleted, setGuideCompleted] = useState(TEST_FILM_EDIT.guideCompleted);
  const [videosRecorded, setVideosRecorded] = useState(TEST_FILM_EDIT.videosRecorded);
  const [editingComplete, setEditingComplete] = useState(TEST_FILM_EDIT.editingComplete);

  useEffect(() => {
    onChange?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.acknowledged]);

  return (
  <>
<section className="udemy-guide-hero">
        <div className="udemy-guide-copy">
          <h2>You&rsquo;re ready to share your knowledge.</h2>
          <p>
            Record with the same setup you tested, keep your delivery clear and direct, and
            edit each lecture so the visuals and audio support the learning objective.
          </p>
          <button
            type="button"
            className="btn"
            data-page-link="setup-test-video"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("course-creator-navigate", {
                    detail: "setup-test-video",
                  })
                );
              }
            }}
          >
            <Video className="icon" aria-hidden={true} />
            Review your test video
          </button>
        </div>
        <div className="udemy-guide-art edit-art" aria-hidden={true}>
          <span className="play-triangle" />
          <span className="wave" />
        </div>
      </section>

      <section className="udemy-guide-section">
        <h2>Tips</h2>
        <p className="section-intro">
          These pages on Udemy are guidance-only. Your actual videos are added from Curriculum,
          individually or with the bulk uploader.
        </p>
        <div className="udemy-guide-list">
          {TIPS.map((tip, i) => (
            <article key={tip.title} className="udemy-guide-row">
              <div className="udemy-guide-index">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <h3>{tip.title}</h3>
                <p>{tip.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="udemy-guide-section">
        <h2>Technical requirements</h2>
        <div className="udemy-requirements">
          {REQUIREMENTS.map((r) => (
            <div key={r.title} className="udemy-requirement">
              {(() => { const DynIcon = ICON_MAP[r.icon]; return DynIcon ? <DynIcon className="icon" aria-hidden={true} /> : null; })()}
              <strong>{r.title}</strong>
              <span>{r.body}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="udemy-guide-section">
        <h2>Resources</h2>
        <div className="udemy-resource-links">
          {RESOURCES.map((r) => (
            <a
              key={r.title}
              className="udemy-resource-link"
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                {r.title}
                <small>{r.sub}</small>
              </span>
              <ExternalLink className="icon" aria-hidden={true} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

export { FilmEditPage }
