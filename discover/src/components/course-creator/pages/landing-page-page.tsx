"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { TEST_LANDING_PAGE } from "../test-data";
import { X, Info, Image as ImageIcon, PlayCircle } from "lucide-react";
import { getLookupOptions, type LookupOptions } from "@/lib/lookup-api";

const DEFAULT_OPTIONS: LookupOptions = {
  languages: [
    "English", "Vietnamese", "French", "German", "Spanish",
    "Japanese", "Korean", "Portuguese", "Italian", "Indonesian", "Thai",
  ],
  categories: [
    "Development", "Business", "Finance & Accounting", "Food & Beverage",
    "IT & Software", "Office Productivity", "Personal Development", "Design",
    "Marketing", "Lifestyle", "Photography & Video", "Health & Fitness", "Music",
    "Teaching & Academics",
  ],
  levels: ["Beginner Level", "Intermediate Level", "Expert Level", "All Levels"],
};

export interface LandingPageData {
  title: string;
  subtitle: string;
  description: string;
  language: string;
  level: string;
  category: string;
  subcategory: string;
  topics: string[];
  topicDraft: string;
  coverName: string;
  coverUrl: string;
  coverMode: "file" | "url";
  coverUrlInput: string;
  promoName: string;
  promoUrl: string;
  promoMode: "file" | "url" | "skip";
  promoUrlInput: string
}

export interface LandingPagePageProps {
  initialData?: Partial<LandingPageData>;
  courseMode?: "course" | "practice_test";
  onChange?: (data: LandingPageData) => void
}

const EMPTY: LandingPageData = { ...TEST_LANDING_PAGE, topicDraft: "" };

function countWords(text: string): number {
  const t = (text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length
}

export function LandingPagePage({ initialData, courseMode = "course", onChange }: LandingPagePageProps) {
  const [title, setTitle] = useState(initialData?.title ?? EMPTY.title);
  const [subtitle, setSubtitle] = useState(initialData?.subtitle ?? EMPTY.subtitle);
  const [description, setDescription] = useState(initialData?.description ?? EMPTY.description);
  const [language, setLanguage] = useState(initialData?.language ?? EMPTY.language);
  const [level, setLevel] = useState(initialData?.level ?? EMPTY.level);
  const [category, setCategory] = useState(initialData?.category ?? EMPTY.category);
  const [subcategory, setSubcategory] = useState(initialData?.subcategory ?? EMPTY.subcategory);
  const [topics, setTopics] = useState<string[]>(initialData?.topics ?? EMPTY.topics);
  const [topicDraft, setTopicDraft] = useState(initialData?.topicDraft ?? EMPTY.topicDraft);
  const [coverName, setCoverName] = useState(initialData?.coverName ?? EMPTY.coverName);
  const [coverUrl, setCoverUrl] = useState(initialData?.coverUrl ?? EMPTY.coverUrl);
  const [coverMode, setCoverMode] = useState<"file" | "url">(initialData?.coverMode ?? "file");
  const [coverUrlInput, setCoverUrlInput] = useState(initialData?.coverUrlInput ?? EMPTY.coverUrlInput);
  const [promoName, setPromoName] = useState(initialData?.promoName ?? EMPTY.promoName);
  const [promoUrl, setPromoUrl] = useState(initialData?.promoUrl ?? EMPTY.promoUrl);
  const [promoMode, setPromoMode] = useState<"file" | "url" | "skip">(initialData?.promoMode ?? "file");
  const [promoUrlInput, setPromoUrlInput] = useState(initialData?.promoUrlInput ?? EMPTY.promoUrlInput);

  const firstRender = useRef(true);
  const coverFileRef = useRef<HTMLInputElement | null>(null);
  const promoFileRef = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const [lookupOptions, setLookupOptions] = useState<LookupOptions>(DEFAULT_OPTIONS);
  const [lookupLoading, setLookupLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLookupOptions().then((options) => {
      if (!cancelled) {
        setLookupOptions(options);
        setLookupLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const wordCount = useMemo(() => countWords(description), [description]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return
    }
    onChangeRef.current?.({
      title,
      subtitle,
      description,
      language,
      level,
      category,
      subcategory,
      topics,
      topicDraft,
      coverName,
      coverUrl,
      coverMode,
      coverUrlInput,
      promoName,
      promoUrl,
      promoMode,
      promoUrlInput,
    });
  }, [
    title,
    subtitle,
    description,
    language,
    level,
    category,
    subcategory,
    topics,
    topicDraft,
    coverName,
    coverUrl,
    coverMode,
    coverUrlInput,
    promoName,
    promoUrl,
    promoMode,
    promoUrlInput,
  ]);

  const onCoverFile = (file: File) => {
    setCoverName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCoverUrl(String(reader.result || ""));
    reader.readAsDataURL(file)
  };

  const onPromoFile = (file: File) => {
    setPromoName(file.name);
    setPromoUrl(URL.createObjectURL(file))
  };

  const addTopic = (raw: string) => {
    const t = raw.trim();
    if (!t || topics.length >= 4 || topics.includes(t)) return;
    setTopics([...topics, t]);
    setTopicDraft("")
  };

  const removeTopic = (i: number) => {
    setTopics(topics.filter((_, idx) => idx !== i))
  };

  const applyFormat = (kind: "bold" | "italic" | "bullet" | "number") => {
    const ta = descRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = description.slice(0, start);
    const sel = description.slice(start, end);
    const after = description.slice(end);

    let inserted = sel;
    let wrap = "";
    if (kind === "bold") {
      if (sel.startsWith("**") && sel.endsWith("**")) {
        inserted = sel.slice(2, -2)
      } else {
        wrap = "**"
      }
    } else if (kind === "italic") {
      const hasI = sel.startsWith("_") && sel.endsWith("_");
      if (hasI) {
        inserted = sel.slice(1, -1)
      } else {
        wrap = "_"
      }
    } else if (kind === "bullet") {
      const lines = sel.length ? sel.split("\n") : [""];
      inserted = lines.map((l) => (l.startsWith("• ") ? l.slice(2) : `• ${l}`)).join("\n");
    } else if (kind === "number") {
      const lines = sel.length ? sel.split("\n") : [""];
      inserted = lines
        .map((l, idx) =>
          l.match(/^\d+\.\s/) ? l.replace(/^\d+\.\s/, "") : `${idx + 1}. ${l}`,
        )
        .join("\n");
    }

    const next = before + wrap + inserted + wrap + after;
    setDescription(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + wrap + inserted + wrap).length;
      ta.setSelectionRange(pos, pos)
    });
  };

  const landingLabel = courseMode === "course" ? "Course landing page" : "Practice test landing page";

  return (
  <>
<p className="ud-landing-intro">
        The title, subtitle, description, basic information, topics, and course image are required
        before you can submit your course for review.
      </p>

      <section className="ud-form-block">
        <div className="ud-form-label">
          <span className="label">Course title</span>
          <span className="count">{title.length}/60</span>
        </div>
        <input
          className="field"
          maxLength={60}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Complete Guide to Modern Web Development"
        />
        <div className="help">
          Your title should be a mix of attention-grabbing, informative, and optimized for search.
        </div>
      </section>

      <section className="ud-form-block">
        <div className="ud-form-label">
          <span className="label">Course subtitle</span>
          <span className="count">{subtitle.length}/120</span>
        </div>
        <input
          className="field"
          maxLength={120}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="e.g. Master HTML, CSS, JavaScript, React, and Node.js"
        />
        <div className="help">
          Use one or two related keywords and mention 3–4 of the most important areas that you
          cover.
        </div>
      </section>

      <section className="ud-form-block">
        <div className="ud-form-label">
          <span className="label">Course description</span>
          <span className="count">{wordCount} words · 200 required</span>
        </div>
        <div className="ud-rich-wrap">
          <div className="ud-rich-toolbar">
            <button
              type="button"
              title="Bold"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat("bold")}
            >
              B
            </button>
            <button
              type="button"
              title="Italic"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat("italic")}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              title="Bulleted list"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat("bullet")}
            >
              •
            </button>
            <button
              type="button"
              title="Numbered list"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat("number")}
            >
              1.
            </button>
          </div>
          <textarea
            id="courseDescription"
            ref={descRef}
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Insert your course description."
          />
        </div>
        <div className="help">
          Description should have a minimum of 200 words. Do not include coupon codes, referral
          links, or external links.
        </div>
      </section>

      <section className="ud-form-block">
        <h2 className="section-title">Basic info</h2>
        <div className="ud-basic-grid">
          <label>
            <span className="label">Language</span>
              <select
                className="field"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={lookupLoading}
              >
                <option value="">-- Select --</option>
                {lookupOptions.languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
          </label>
          <label>
            <span className="label">Level</span>
            <select className="field" value={level} onChange={(e) => setLevel(e.target.value)} disabled={lookupLoading}>
              <option value="">-- Select --</option>
              {lookupOptions.levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Category</span>
            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={lookupLoading}
            >
              <option value="">-- Select --</option>
              {lookupOptions.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Subcategory</span>
            <input
              className="field"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Select a subcategory"
            />
          </label>
        </div>
      </section>

      <section className="ud-form-block">
        <div className="ud-topic-heading">
          <h2 className="section-title">What is primarily taught in your course?</h2>
          <Info size={16} aria-hidden />
        </div>
        <div className="ud-topic-pills">
          {topics.map((t, i) => (
            <span key={`${t}-${i}`} className="ud-topic-pill">
              {t}
              <button
                type="button"
                onClick={() => removeTopic(i)}
                aria-label={`Remove ${t}`}
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
        <div className="ud-topic-propose">
          <input
            className="field"
            value={topicDraft}
            onChange={(e) => setTopicDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTopic(topicDraft)
              }
            }}
            placeholder="Propose another topic..."
            disabled={topics.length >= 4}
          />
          <button
            type="button"
            className="btn"
            onClick={() => addTopic(topicDraft)}
            disabled={topics.length >= 4 || !topicDraft.trim()}
          >
            Add
          </button>
        </div>
        <div className="help">
          Choose up to four specific topics that accurately represent the majority of the course.
        </div>
      </section>

      <section className="ud-form-block ud-media-section">
        <div className="ud-media-row">
          <div className="ud-media-preview">
            {coverUrl ? (
              <img src={coverUrl} alt="Course image preview" />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ImageIcon size={34} strokeWidth={1.5} />
                <div className="help">750 × 422 px</div>
              </div>
            )}
          </div>
          <div className="ud-media-copy">
            <h2 className="section-title">Course image</h2>
            <p>
              Upload your course image here. It must meet the course image quality standards to
              be accepted. Important guidelines: 750 × 422 pixels; .jpg, .jpeg, .gif, .bmp, or
              .png format; no text on the image.
            </p>
            <div className="ud-upload-tabs">
              <button
                type="button"
                className={`ud-upload-tab ${coverMode === "file" ? "active" : ""}`.trim()}
                onClick={() => setCoverMode("file")}
              >
                Upload file
              </button>
              <button
                type="button"
                className={`ud-upload-tab ${coverMode === "url" ? "active" : ""}`.trim()}
                onClick={() => setCoverMode("url")}
              >
                Paste URL
              </button>
            </div>
            {coverMode === "file" ? (
              <div className="ud-upload-line">
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/*"
                  id="coverFile"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onCoverFile(f)
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => coverFileRef.current?.click()}
                >
                  {coverName ? "Change image" : "Upload file"}
                </button>
              </div>
            ) : (
              <div className="ud-upload-line">
                <input
                  className="field"
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (coverUrlInput) {
                      setCoverUrl(coverUrlInput);
                      setCoverName("")
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            )}
            {coverName ? <span className="ud-file-name">{coverName}</span> : null}
            <div className="ud-policy-note">
              Images used in the course must be properly licensed and appropriate for a general
              audience.
            </div>
          </div>
        </div>

        <div className="ud-media-row">
          <div className="ud-media-preview">
            {promoUrl ? (
              <video src={promoUrl} controls />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PlayCircle size={34} strokeWidth={1.5} />
                <div className="help">Promotional video</div>
              </div>
            )}
          </div>
          <div className="ud-media-copy">
            <h2 className="section-title">Promotional video</h2>
            <p>
              A promotional video can help learners preview your teaching style and understand
              what they will gain from the course. A focused video under two minutes is
              recommended.
            </p>
            <div className="ud-upload-tabs">
              <button
                type="button"
                className={`ud-upload-tab ${promoMode === "file" ? "active" : ""}`.trim()}
                onClick={() => setPromoMode("file")}
              >
                Upload file
              </button>
              <button
                type="button"
                className={`ud-upload-tab ${promoMode === "url" ? "active" : ""}`.trim()}
                onClick={() => setPromoMode("url")}
              >
                Paste URL
              </button>
              <button
                type="button"
                className={`ud-upload-tab ${promoMode === "skip" ? "active" : ""}`.trim()}
                onClick={() => {
                  setPromoMode("skip");
                  setPromoUrl("");
                  setPromoUrlInput("");
                  setPromoName("")
                }}
              >
                Skip for now
              </button>
            </div>
            {promoMode === "file" ? (
              <div className="ud-upload-line">
                <input
                  ref={promoFileRef}
                  type="file"
                  accept="video/*"
                  id="promoFile"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPromoFile(f)
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => promoFileRef.current?.click()}
                >
                  {promoName ? "Replace video" : "Upload file"}
                </button>
              </div>
            ) : promoMode === "url" ? (
              <div className="ud-upload-line">
                <input
                  className="field"
                  value={promoUrlInput}
                  onChange={(e) => setPromoUrlInput(e.target.value)}
                  placeholder="https://example.com/promo.mp4"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (promoUrlInput) {
                      setPromoUrl(promoUrlInput);
                      setPromoName("")
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            ) : (
              <div className="help" style={{ marginTop: 0 }}>
                You can add a promotional video later from your course settings.
              </div>
            )}
            {promoName ? <span className="ud-file-name">{promoName}</span> : null}
          </div>
        </div>
      </section>
    </>
  );
}

export default LandingPagePage;
