"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import { IconX, IconPhoto, IconDeviceFloppy, IconSend } from "@tabler/icons-react";
import type { CourseDraft } from "@/lib/types";

interface PublishPanelProps {
  course: CourseDraft;
  onUpdate: (updates: Partial<CourseDraft>) => void;
  onPublish: () => void;
  onSave: () => void;
  saving: boolean;
  publishing: boolean;
}

export function PublishPanel({ course, onUpdate, onPublish, onSave, saving, publishing }: PublishPanelProps) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description || "");
  const [coverUrl, setCoverUrl] = useState(course.cover_url || "");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write a course description\u2026",
      }),
      ImageExtension.configure({
        inline: false,
        allowBase64: true,
      }),
      LinkExtension.configure({
        openOnClick: false,
      }),
    ],
    content: description ? JSON.parse(description) : { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => {
      setDescription(JSON.stringify(editor.getJSON()));
    },
  });

  const handleTitleBlur = () => {
    onUpdate({ title: title.trim() || "Untitled Course" });
  };

  const handleDescriptionBlur = () => {
    onUpdate({ description });
  };

  const handleCoverUrlBlur = () => {
    onUpdate({ cover_url: coverUrl.trim() || undefined });
  };

  const canPublish = title.trim().length > 0;

  const sectionCount = course.sections.length;
  const lessonCount = course.sections.reduce((acc, s) => acc + s.lessons.length, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Course Settings</h2>
        <button
          onClick={() => onUpdate({ status: "draft" })}
          className="p-1 rounded text-muted hover:text-foreground"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Course Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Enter course title"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary placeholder:text-muted/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Cover Image URL</label>
          <input
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            onBlur={handleCoverUrlBlur}
            placeholder="https://..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary placeholder:text-muted/30"
          />
          {coverUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-surface border border-border">
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Description</label>
          {editor && (
            <div className="rounded-lg border border-border bg-background overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-surface/50">
                <span className="text-[11px] text-muted">Rich text description</span>
              </div>
              <div className="px-4 py-3 min-h-[150px]">
                <EditorContent editor={editor} />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-surface/50 border border-border">
          <h3 className="text-xs font-semibold text-foreground mb-2">Course Summary</h3>
          <div className="space-y-1 text-xs text-muted">
            <p>{sectionCount} {sectionCount === 1 ? "section" : "sections"}</p>
            <p>{lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}</p>
            <p>Status: <span className="capitalize">{course.status}</span></p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-surface transition-colors disabled:opacity-50"
        >
          <IconDeviceFloppy size={15} /> {saving ? "Saving\u2026" : "Save draft"}
        </button>
        <button
          onClick={onPublish}
          disabled={!canPublish || publishing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconSend size={15} /> {publishing ? "Publishing\u2026" : "Publish course"}
        </button>
        {!canPublish && (
          <p className="text-[11px] text-muted text-center">Add a title to publish.</p>
        )}
      </div>
    </div>
  );
}
