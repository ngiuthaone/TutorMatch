"use client";
import React, { useEffect, useState } from "react";
import {Captions, AudioLines, FileCheck2} from "lucide-react";
type IconProps = { className?: string; "aria-hidden"?: boolean };
const ICON_MAP: Record<string, React.FC<IconProps>> = {
  captions: Captions,
  'audio-lines': AudioLines,
  'file-check-2': FileCheck2,
};

export interface AccessibilityClaimGroup {
  id: string;
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  items: { key: string; label: string; checked: boolean }[];
}

export interface AccessibilityData {
  groups: AccessibilityClaimGroup[]
}

export interface AccessibilityPageProps {
  initialData?: Partial<AccessibilityData>;
  onChange?: (data: AccessibilityData) => void
}



const DEFAULT_GROUPS: AccessibilityClaimGroup[] = [
  {
    id: "captions",
    icon: "captions",
    title: "Captions meet accessibility standards",
    description: "Claim this only after reviewing every published video.",
    enabled: true,
    items: [
      { key: "accurate", label: "Captions accurately represent spoken words", checked: true },
      { key: "synced", label: "Caption timing is synchronized with speech", checked: true },
      { key: "speakers", label: "Speaker changes are identified when needed", checked: false },
      { key: "sounds", label: "Meaningful sounds and music are described", checked: false },
    ],
  },
  {
    id: "audio",
    icon: "audio-lines",
    title: "Audio content is accessible",
    description: "Learners can understand the instruction without relying only on visuals.",
    enabled: true,
    items: [
      { key: "described", label: "Important visual information is explained in narration", checked: true },
      { key: "clear", label: "Speech is clear and understandable", checked: true },
      { key: "noMusic", label: "Background music does not interfere with speech", checked: true },
    ],
  },
  {
    id: "materials",
    icon: "file-check-2",
    title: "Course materials are accessible",
    description: "Slides, articles, and downloads use accessible structure and presentation.",
    enabled: false,
    items: [
      { key: "headings", label: "Documents use meaningful headings and reading order", checked: false },
      { key: "contrast", label: "Text and graphics have sufficient contrast", checked: false },
      { key: "alt", label: "Informative images include text alternatives", checked: false },
      { key: "links", label: "Links use descriptive text instead of raw URLs", checked: false },
    ],
  },
];

export default function AccessibilityPage({ initialData, onChange }: AccessibilityPageProps) {
  const [groups, setGroups] = useState<AccessibilityClaimGroup[]>(
    initialData?.groups ?? DEFAULT_GROUPS
  );

  useEffect(() => {
    onChange?.({ groups });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const toggleEnable = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, enabled: !g.enabled } : g))
    );
  };

  const toggleItem = (groupId: string, key: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) =>
            it.key === key ? { ...it, checked: !it.checked } : it
          ),
        };
      })
    );
  };

  return (
  <>
<div className="stack">
        {groups.map((g) => {
          const confirmed = g.items.filter((i) => i.checked).length;
          return (
            <section key={g.id} className="access-card">
              <div className="access-card-head">
                <div className="row">
                  {(() => { const DynIcon = ICON_MAP[g.icon]; return DynIcon ? <DynIcon className="icon" aria-hidden={true} /> : null; })()}
                  <div>
                    <h2>{g.title}</h2>
                    <p>{g.description}</p>
                  </div>
                </div>
                <label className="access-claim">
                  <input
                    type="checkbox"
                    data-access-enable={g.id}
                    checked={g.enabled}
                    onChange={() => toggleEnable(g.id)}
                  />
                  <span>{g.enabled ? "Claim enabled" : "Not claimed"}</span>
                </label>
              </div>
              <div className="access-progress">
                {confirmed}/{g.items.length} checks confirmed
              </div>
              <div className="access-items">
                {g.items.map((it) => (
                  <label key={it.key} className="check-card">
                    <input
                      type="checkbox"
                      data-access-item={g.id}
                      data-access-key={it.key}
                      checked={it.checked}
                      onChange={() => toggleItem(g.id, it.key)}
                    />
                    <span>
                      <strong>{it.label}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export { AccessibilityPage };
