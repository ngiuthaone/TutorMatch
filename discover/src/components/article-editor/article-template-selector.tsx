"use client";

import { IconTemplate, IconBook2, IconSchool, IconBrain, IconBulb, IconBooks } from "@tabler/icons-react";

interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  structure: Record<string, unknown>;
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "tutorial", title: "Step-by-step tutorial", description: "Teach something practical with clear steps",
    icon: IconSchool,
    structure: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What you will learn" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "What you will need" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Step 1" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Step 2" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Common mistakes" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Final takeaway" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
  {
    id: "learning-story", title: "Personal learning story", description: "Share your journey and what helped you",
    icon: IconBook2,
    structure: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Where I started" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What was difficult" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What helped" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What changed" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What I would tell a beginner" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
  {
    id: "beginners-guide", title: "Beginner\u2019s guide", description: "Introduce a topic to people just starting out",
    icon: IconBrain,
    structure: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What this is" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why it matters" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Key concepts" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "How to get started" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Next steps" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
  {
    id: "case-study", title: "Case study", description: "Analyse a real situation and share lessons",
    icon: IconBulb,
    structure: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "The challenge" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "My approach" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What happened" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Key lessons" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
  {
    id: "opinion", title: "Opinion or insight", description: "Share a perspective worth considering",
    icon: IconBulb,
    structure: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "The idea" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why I think it matters" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A different perspective" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "My conclusion" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
  {
    id: "resources", title: "Resource collection", description: "Curate useful resources for a topic",
    icon: IconBooks,
    structure: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Who this is for" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Recommended resources" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "How to use them" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What to start with" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
];

interface ArticleTemplateSelectorProps {
  onSelect: (structure: Record<string, unknown>) => void;
}

export function ArticleTemplateSelector({ onSelect }: ArticleTemplateSelectorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <IconTemplate size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">What would you like to create?</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => onSelect(t.structure)}
              className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 hover:bg-surface transition-all text-left">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t.title}</p>
                <p className="text-xs text-muted mt-0.5">{t.description}</p>
              </div>
            </button>
          );
        })}
        <button onClick={() => onSelect({ type: "doc", content: [{ type: "paragraph", content: [] }] })}
          className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-border bg-transparent hover:border-primary/30 hover:bg-surface transition-all text-left">
          <div className="p-2 rounded-lg bg-surface text-muted shrink-0">
            <IconTemplate size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Start from blank</p>
            <p className="text-xs text-muted mt-0.5">Begin with an empty editor</p>
          </div>
        </button>
      </div>
    </div>
  );
}
