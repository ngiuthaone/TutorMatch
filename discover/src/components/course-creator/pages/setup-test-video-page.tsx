"use client";
import React, { useEffect, useRef, useState } from "react";
import { TEST_SETUP_TEST_VIDEO } from "../test-data";
import {MessageSquareCheck, UploadCloud, Video} from "lucide-react";
type IconProps = { className?: string; "aria-hidden"?: boolean };
const ICON_MAP: Record<string, React.FC<IconProps>> = {
  "message-square-check": MessageSquareCheck,
  "upload-cloud": UploadCloud,
  video: Video,
};

export interface SetupTestVideoData {
  videoFileName?: string;
  setupChecks: {
    audio: boolean;
    lighting: boolean;
    video: boolean;
    background: boolean
  }
  submitted: boolean;
}

export interface SetupTestVideoPageProps {
  initialData?: Partial<SetupTestVideoData>;
  onChange?: (data: SetupTestVideoData) => void
}

const DEFAULTS: SetupTestVideoData = {
  videoFileName: undefined,
  setupChecks: { audio: true, lighting: true, video: true, background: true },
  submitted: false,
}

export default function SetupTestVideoPage({ initialData, onChange }: SetupTestVideoPageProps) {
  const [data, setData] = useState<SetupTestVideoData>({
    ...DEFAULTS,
    ...initialData,
    setupChecks: { ...DEFAULTS.setupChecks, ...(initialData?.setupChecks ?? {}) },
  });

  const [guideCompleted, setGuideCompleted] = useState(TEST_SETUP_TEST_VIDEO.guideCompleted);
  const [videoUploaded, setVideoUploaded] = useState(TEST_SETUP_TEST_VIDEO.videoUploaded);
  const [qualityConfirmed, setQualityConfirmed] = useState(TEST_SETUP_TEST_VIDEO.qualityConfirmed);

  useEffect(() => {
    onChange?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<SetupTestVideoData>) =>
    setData((d) => ({ ...d, ...patch }));

  const toggleCheck = (key: keyof SetupTestVideoData["setupChecks"]) => {
    update({
      setupChecks: { ...data.setupChecks, [key]: !data.setupChecks[key] },
    });
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    update({ videoFileName: f.name });
    setVideoUploaded(true);
  }

  return (
  <>
<div className="info">
        <video className="icon" aria-hidden="true" />
        <div>
          <strong>Test your real setup</strong>
          <div className="help">
            Record 1–3 minutes with the camera, microphone, lighting, and screen-capture
            settings you plan to use. A test video is optional, but it can prevent costly
            production problems.
          </div>
        </div>
      </div>

      <section className="section" style={{ marginTop: 28 }}>
        <div className="grid-2">
          <div>
            <div className="file-drop">
              <UploadCloud className="icon" aria-hidden={true} />
              <div style={{ fontWeight: 700, margin: "10px 0 6px" }}>
                {data.videoFileName || "Drop a test video here"}
              </div>
              <div className="help">
                MP4 or MOV · 720p minimum · 1–3 minutes recommended
              </div>
              <input
                id="testVideoFile"
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFile}
              />
              <button
                type="button"
                className="btn btn-sm"
                data-file-button="testVideoFile"
                style={{ marginTop: 14 }}
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </button>
            </div>

            {data.videoFileName ? (
              <div className="panel panel-soft" style={{ marginTop: 12 }}>
                <div className="row between">
                  <div>
                    <strong>{data.videoFileName}</strong>
                    <div className="help">
                      {data.submitted ? "Submitted for feedback" : "Ready to submit"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    data-submit-test
                    disabled={data.submitted}
                    onClick={() => update({ submitted: true })}
                  >
                    {data.submitted ? "Submitted" : "Submit"}
                  </button>
                </div>
              </div>
            ) : null}

            {data.submitted ? (
              <div className="info success" style={{ marginTop: 12 }}>
                <MessageSquareCheck className="icon" aria-hidden={true} />
                <div>
                  <strong>Video feedback</strong>
                  <div className="help">Framing and resolution pass.</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="stack">
            <label className="check-card">
              <input
                type="checkbox"
                data-check-group="setupChecks"
                data-check-key="audio"
                checked={data.setupChecks.audio}
                onChange={() => toggleCheck("audio")}
              />
              <span>
                <strong>Audio is clear and free from distracting echo</strong>
              </span>
            </label>
            <label className="check-card">
              <input
                type="checkbox"
                data-check-group="setupChecks"
                data-check-key="lighting"
                checked={data.setupChecks.lighting}
                onChange={() => toggleCheck("lighting")}
              />
              <span>
                <strong>The presenter and screen are well lit</strong>
              </span>
            </label>
            <label className="check-card">
              <input
                type="checkbox"
                data-check-group="setupChecks"
                data-check-key="video"
                checked={data.setupChecks.video}
                onChange={() => toggleCheck("video")}
              />
              <span>
                <strong>The export is 720p or 1080p</strong>
              </span>
            </label>
            <label className="check-card">
              <input
                type="checkbox"
                data-check-group="setupChecks"
                data-check-key="background"
                checked={data.setupChecks.background}
                onChange={() => toggleCheck("background")}
              />
              <span>
                <strong>The frame is clean and professional</strong>
              </span>
            </label>
          </div>
        </div>
      </section>
    </>
  );
}

export { SetupTestVideoPage }
