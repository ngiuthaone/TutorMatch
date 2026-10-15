"use client";
import React, { useEffect, useRef, useState } from "react";
import { UploadCloud, Video, Check, X, AlertCircle, Play, FileVideo, Mic, Sun, Frame, Scissors } from "lucide-react";

export interface VideoSetupData {
  videoFileName?: string;
  videoUrl?: string;
  videoSize?: number;
  videoDuration?: number;
  videoWidth?: number;
  videoHeight?: number;
  status: "empty" | "uploading" | "processing" | "ready" | "failed" | "submitted";
  progress: number;
  error?: string;
  submitted: boolean;
  setupChecks: {
    audio: boolean;
    lighting: boolean;
    video: boolean;
    background: boolean;
  };
}

export interface VideoSetupPageProps {
  initialData?: Partial<VideoSetupData>;
  onChange?: (data: VideoSetupData) => void;
}

const DEFAULTS: VideoSetupData = {
  status: "empty",
  progress: 0,
  submitted: false,
  setupChecks: { audio: true, lighting: true, video: true, background: true },
};

const RECORDING_GUIDANCE = [
  { icon: Mic, title: "Audio", desc: "Use a close mic, reduce echo, keep speech clear and centered." },
  { icon: Sun, title: "Lighting", desc: "Light your face and screen evenly; avoid harsh shadows." },
  { icon: Frame, title: "Framing", desc: "Center yourself, keep background clean and professional." },
  { icon: Scissors, title: "Editing", desc: "Trim pauses and mistakes; keep pacing steady." },
];

const EDITING_GUIDANCE = [
  "Remove unnecessary pauses and repeated takes",
  "Maintain a steady, confident pace",
  "Check audio levels and sync before export",
  "Export at 720p or 1080p, 16:9, MP4 or MOV",
];

const BEFORE_UPLOAD = [
  "Video format is MP4 or MOV",
  "Resolution is 720p or higher",
  "Aspect ratio is 16:9",
  "Duration is 1–3 minutes",
];

function formatDuration(sec?: number): string {
  if (sec == null || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoSetupPage({ initialData, onChange }: VideoSetupPageProps) {
  const [data, setData] = useState<VideoSetupData>({ ...DEFAULTS, ...initialData });
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    onChange?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const update = (patch: Partial<VideoSetupData>) => setData((d) => ({ ...d, ...patch }));

  const toggleCheck = (key: keyof VideoSetupData["setupChecks"]) => {
    update({ setupChecks: { ...data.setupChecks, [key]: !data.setupChecks[key] } });
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const validType = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    if (!validType) {
      update({ status: "failed", error: "Unsupported file type. Choose MP4, MOV, or WebM.", progress: 0 });
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      update({ status: "failed", error: "File exceeds 500 MB limit.", progress: 0 });
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    update({
      videoFileName: file.name,
      videoUrl: url,
      videoSize: file.size,
      status: "uploading",
      progress: 0,
      error: undefined,
      submitted: false,
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  // Simulate upload + processing, then extract metadata
  useEffect(() => {
    if (data.status !== "uploading") return;
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(92, progress + 8 + Math.random() * 12);
      update({ progress });
    }, 140);
    return () => clearInterval(timer);
  }, [data.status]);

  const handleMetadata = () => {
    const v = videoRef.current;
    if (!v || data.status !== "uploading") return;
    const dur = v.duration;
    const w = v.videoWidth;
    const h = v.videoHeight;
    const isValid = !isNaN(dur) && dur > 0;
    if (!isValid) {
      update({ status: "failed", error: "Could not read video metadata. Try another file.", progress: 0 });
      return;
    }
    update({
      status: "ready",
      progress: 100,
      videoDuration: Math.round(dur),
      videoWidth: w,
      videoHeight: h,
      error: undefined,
    });
  };

  const handleSubmit = () => {
    const checks = [
      data.videoWidth != null && data.videoWidth >= 1280 - 10,
      data.videoHeight != null && data.videoHeight >= 720 - 10,
      data.videoDuration != null && data.videoDuration >= 60 && data.videoDuration <= 240,
    ];
    const failed = checks.some((c) => !c);
    if (failed) {
      update({ status: "failed", error: "Fix technical requirements before submitting." });
      return;
    }
    update({ status: "submitted", submitted: true });
  };

  const handleReplace = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    update({
      videoFileName: undefined,
      videoUrl: undefined,
      videoSize: undefined,
      videoDuration: undefined,
      videoWidth: undefined,
      videoHeight: undefined,
      status: "empty",
      progress: 0,
      error: undefined,
      submitted: false,
    });
  };

  const isReady = data.status === "ready";
  const isSubmitted = data.status === "submitted" || data.submitted;
  const canSubmit = isReady && !isSubmitted;

  // Technical validation
  const checks = {
    playback: data.status === "ready" || isSubmitted,
    container: data.videoFileName ? /\.(mp4|mov)$/i.test(data.videoFileName) : false,
    resolution: (data.videoWidth ?? 0) >= 1280 - 10 && (data.videoHeight ?? 0) >= 720 - 10,
    aspect: data.videoWidth && data.videoHeight ? Math.abs(data.videoWidth / data.videoHeight - 16 / 9) < 0.05 : false,
    duration: data.videoDuration != null ? data.videoDuration >= 60 && data.videoDuration <= 240 : false,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Prepare */}
      <section className="section">
        <h2 className="section-title">Prepare your video</h2>
        <p className="section-desc">Get your recording and editing workflow right before you test. This guidance stays visible while you work.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 16 }}>
          {RECORDING_GUIDANCE.map((g) => (
            <div key={g.title} className="panel" style={{ padding: 16 }}>
              <g.icon size={18} style={{ marginBottom: 8, color: "#8f9096" }} />
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{g.title}</div>
              <div className="help" style={{ margin: 0 }}>{g.desc}</div>
            </div>
          ))}
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Editing checklist</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {EDITING_GUIDANCE.map((t) => (
              <li key={t} className="help" style={{ margin: 0 }}>{t}</li>
            ))}
          </ul>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Before you upload — technical requirements</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}><span style={{ color: "#8f9096" }}>Format</span><span style={{ fontWeight: 600 }}>MP4 / MOV</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}><span style={{ color: "#8f9096" }}>Resolution</span><span style={{ fontWeight: 600 }}>720p or higher</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}><span style={{ color: "#8f9096" }}>Aspect ratio</span><span style={{ fontWeight: 600 }}>16:9</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}><span style={{ color: "#8f9096" }}>Duration</span><span style={{ fontWeight: 600 }}>1–3 minutes</span></div>
          </div>
          <div className="help" style={{ marginTop: 8 }}>Playback must be smooth. We check this after you upload.</div>
        </div>
      </section>

      {/* Test */}
      <section className="section">
        <h2 className="section-title">Test your setup</h2>
        <p className="section-desc">Upload a short video to check playback quality and technical requirements before recording your full course.</p>

        {data.status === "empty" && (
          <div
            className="file-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            style={{ marginTop: 12 }}
          >
            <UploadCloud size={28} style={{ color: "#8f9096", marginBottom: 8 }} />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Upload a test video</div>
            <div className="help" style={{ marginBottom: 12 }}>MP4 or MOV · Recommended length: 1–3 minutes</div>
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onFileChange} />
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              Upload test video
            </button>
            <div className="help" style={{ marginTop: 8 }}>Drag and drop also works</div>
          </div>
        )}

        {data.status === "uploading" && (
          <div className="panel" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Processing video…</span>
              <span style={{ fontSize: 12, color: "#8f9096" }}>{Math.round(data.progress)}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${data.progress}%`, height: "100%", background: "#e4e4e5", transition: "width 0.2s" }} />
            </div>
            <div className="help" style={{ marginTop: 8 }}>Extracting metadata, generating thumbnail, validating technical requirements…</div>
            <video
              ref={videoRef}
              src={data.videoUrl}
              preload="metadata"
              muted
              onLoadedMetadata={handleMetadata}
              onError={() => update({ status: "failed", error: "Video processing failed. Try another file." })}
              style={{ display: "none" }}
            />
          </div>
        )}

        {data.status === "failed" && (
          <div className="panel" style={{ marginTop: 12, borderColor: "rgba(255,107,107,0.3)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <AlertCircle size={18} style={{ color: "#ff6b6b", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#ff6b6b" }}>{data.error || "Upload failed"}</div>
                <div className="help" style={{ marginTop: 4 }}>Try a different file or check the requirements above.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-sm" onClick={handleReplace}>
                Choose another file
              </button>
            </div>
          </div>
        )}

        {(data.status === "ready" || isSubmitted) && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="video-setup-ready">
            <div>
              <div style={{ background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <video src={data.videoUrl} controls style={{ width: "100%", height: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "#8f9096" }}>
                  {formatSize(data.videoSize)} · {formatDuration(data.videoDuration)} · {data.videoWidth}×{data.videoHeight}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="panel" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Thumbnail</div>
                <div className="help" style={{ marginBottom: 8 }}>Auto-generated from your video</div>
                <div style={{ background: "#111113", borderRadius: 8, height: 90, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {data.videoUrl ? (
                    <video src={data.videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                  ) : (
                    <span className="help">No thumbnail</span>
                  )}
                </div>
              </div>
              {isSubmitted && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <Check size={16} style={{ color: "#4ade80" }} />
                  <span style={{ fontWeight: 600, fontSize: 12.5, color: "#4ade80" }}>Submitted</span>
                  <span className="help" style={{ marginLeft: 8 }}>Your test video is saved. You can replace it anytime.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`@media(max-width: 760px){ .video-setup-ready{ grid-template-columns: 1fr !important; } }`}</style>
      </section>

      <section className="section">
        <h2 className="section-title">Technical check</h2>
        <p className="section-desc">Validation results for your test video.</p>
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { ok: checks.playback, label: "Playback available" },
              { ok: checks.container, label: "MP4 or MOV container" },
              { ok: checks.resolution, label: checks.resolution ? `Resolution ${data.videoWidth}×${data.videoHeight}` : "Resolution below 720p — re-export at 720p or higher" },
              { ok: checks.aspect, label: "16:9 aspect ratio" },
              { ok: checks.duration, label: `Duration ${formatDuration(data.videoDuration)} (recommended: 1–3 minutes)` },
            ].map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                {c.ok ? <Check size={14} style={{ color: "#4ade80" }} /> : <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 14, width: 14, textAlign: "center" }}>!</span>}
                <span style={{ color: c.ok ? "#e4e4e5" : "#fbbf24" }}>{c.label}</span>
              </div>
            ))}
          </div>
          {data.status === "empty" && <div className="help" style={{ marginTop: 10 }}>Upload a test video to run these checks.</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {!isSubmitted ? (
            <>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleSubmit} disabled={data.status !== "ready" && !isSubmitted}>
                Mark as submitted
              </button>
              <button type="button" className="btn btn-sm" onClick={handleReplace}>
                Choose a different video
              </button>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", flex: 1 }}>
              <Check size={16} style={{ color: "#4ade80" }} />
              <span style={{ fontWeight: 600, fontSize: 12.5, color: "#4ade80" }}>Submitted</span>
              <span className="help" style={{ marginLeft: 8 }}>Your test video is saved. You can replace it anytime.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
