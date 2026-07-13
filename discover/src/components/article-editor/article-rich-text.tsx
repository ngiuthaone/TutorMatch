"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import {
  IconBold, IconItalic, IconList, IconListNumbers, IconQuote,
  IconCode, IconLink, IconPhoto, IconMinus, IconHeading,
} from "@tabler/icons-react";
import { generateId } from "@/lib/types";

interface ArticleRichTextProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>, html: string) => void;
}

export function ArticleRichText({ content, onChange }: ArticleRichTextProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing your article\u2026",
      }),
      ImageExtension.configure({
        inline: false,
        allowBase64: true,
      }),
      LinkExtension.configure({
        openOnClick: false,
      }),
    ],
    content: content as Record<string, unknown>,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as Record<string, unknown>, editor.getHTML());
    },
  });

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

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, label, children }: {
    onClick: () => void; active?: boolean; label: string; children: React.ReactNode;
  }) => (
    <button type="button" onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${active ? "bg-primary/10 text-primary-dark dark:text-primary-light" : "text-muted hover:text-foreground hover:bg-surface"}`}
      aria-label={label} title={label}>
      {children}
    </button>
  );

  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden">
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
  );
}
