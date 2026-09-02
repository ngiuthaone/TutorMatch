"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import {
  IconBold, IconItalic, IconList, IconListNumbers, IconQuote,
  IconCode, IconLink, IconPhoto, IconMinus, IconHeading,
  IconEye, IconVideo, IconFileText, IconQuestionMark, IconFile,
} from "@tabler/icons-react";
import type { LessonDraft, LessonType } from "@/lib/types";

interface LessonEditorProps {
  lesson: LessonDraft;
  onUpdate: (updates: Partial<LessonDraft>) => void;
}

const lessonTypeOptions: { type: LessonType; label: string; icon: typeof IconVideo }[] = [
  { type: "video", label: "Video", icon: IconVideo },
  { type: "text", label: "Text", icon: IconFileText },
  { type: "quiz", label: "Quiz", icon: IconQuestionMark },
  { type: "resource", label: "Resource", icon: IconFile },
];

function ToolBtn({ onClick, active, label, children }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${active ? "bg-primary/10 text-primary-dark dark:text-primary-light" : "text-muted hover:text-foreground hover:bg-surface"}`}
      aria-label={label} title={label}>
      {children}
    </button>
  );
}

export function LessonEditor({ lesson, onUpdate }: LessonEditorProps) {
  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url || "");
  const [isPreview, setIsPreview] = useState(lesson.is_preview);
  const [lessonType, setLessonType] = useState<LessonType>(lesson.lesson_type);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Write your lesson content\u2026",
      }),
      ImageExtension.configure({
        inline: false,
        allowBase64: true,
      }),
      LinkExtension.configure({
        openOnClick: false,
      }),
    ],
    content: lesson.text_content ? JSON.parse(lesson.text_content) : { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => {
      onUpdate({ text_content: JSON.stringify(editor.getJSON()) });
    },
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(lesson.title);
    setVideoUrl(lesson.video_url || "");
    setIsPreview(lesson.is_preview);
    setLessonType(lesson.lesson_type);
    if (editor && lesson.text_content) {
      try {
        editor.commands.setContent(JSON.parse(lesson.text_content));
      } catch {
        editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
      }
    }
  }, [lesson.id, editor]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    onUpdate({ title: newTitle });
  }, [onUpdate]);

  const handleVideoUrlChange = useCallback((url: string) => {
    setVideoUrl(url);
    onUpdate({ video_url: url });
  }, [onUpdate]);

  const handlePreviewToggle = useCallback(() => {
    const newValue = !isPreview;
    setIsPreview(newValue);
    onUpdate({ is_preview: newValue });
  }, [isPreview, onUpdate]);

  const handleTypeChange = useCallback((type: LessonType) => {
    setLessonType(type);
    onUpdate({ lesson_type: type });
  }, [onUpdate]);

  const addImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        editor?.chain().focus().setImage({ src: url }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  const addLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Edit Lesson</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Preview</span>
          <button
            onClick={handlePreviewToggle}
            className={`w-9 h-5 rounded-full transition-colors relative ${isPreview ? "bg-primary" : "bg-border"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isPreview ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Lesson title"
            className="w-full px-3 py-2 text-lg font-semibold bg-transparent border-b border-border focus:outline-none focus:border-primary placeholder:text-muted/30"
          />
        </div>

        <div className="flex items-center gap-2">
          {lessonTypeOptions.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                lessonType === type ? "bg-primary/10 text-primary border border-primary/30" : "bg-surface text-muted hover:text-foreground border border-transparent"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {lessonType === "video" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Video URL</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => handleVideoUrlChange(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary placeholder:text-muted/30"
            />
            {videoUrl && (
              <div className="aspect-video rounded-lg border border-border bg-surface overflow-hidden">
                <iframe
                  src={videoUrl.replace("watch?v=", "embed/")}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}

        {(lessonType === "text" || lessonType === "quiz") && editor && (
          <div className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-surface/50 flex-wrap">
              <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor.isActive("heading", { level: 2 })} label="Heading 2">
                <IconHeading size={16} />
              </ToolBtn>
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${editor.isActive("heading", { level: 3 }) ? "bg-primary/10 text-primary-dark dark:text-primary-light" : "text-muted hover:text-foreground hover:bg-surface"}`}
                aria-label="Heading 3" title="Heading 3">H3</button>
              <span className="w-px h-5 bg-border mx-1" />
              <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive("bold")} label="Bold">
                <IconBold size={16} />
              </ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive("italic")} label="Italic">
                <IconItalic size={16} />
              </ToolBtn>
              <span className="w-px h-5 bg-border mx-1" />
              <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive("bulletList")} label="Bullet list">
                <IconList size={16} />
              </ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive("orderedList")} label="Numbered list">
                <IconListNumbers size={16} />
              </ToolBtn>
              <span className="w-px h-5 bg-border mx-1" />
              <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive("blockquote")} label="Quote">
                <IconQuote size={16} />
              </ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                active={editor.isActive("codeBlock")} label="Code block">
                <IconCode size={16} />
              </ToolBtn>
              <span className="w-px h-5 bg-border mx-1" />
              <ToolBtn onClick={addImage} label="Image">
                <IconPhoto size={16} />
              </ToolBtn>
              <ToolBtn onClick={addLink} active={editor.isActive("link")} label="Link">
                <IconLink size={16} />
              </ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Divider">
                <IconMinus size={16} />
              </ToolBtn>
            </div>
            <div className="px-5 py-4 min-h-[300px] article-editor-content">
              <EditorContent editor={editor} />
            </div>
          </div>
        )}

        {lessonType === "resource" && (
          <div className="p-4 rounded-lg border border-dashed border-border text-center">
            <p className="text-sm text-muted">Resource attachments coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
