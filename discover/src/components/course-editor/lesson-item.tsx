"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical, IconVideo, IconFileText, IconQuestionMark, IconFile, IconTrash, IconEye } from "@tabler/icons-react";
import type { LessonDraft } from "@/lib/types";

interface LessonItemProps {
  lesson: LessonDraft;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const lessonTypeIcons = {
  video: IconVideo,
  text: IconFileText,
  quiz: IconQuestionMark,
  resource: IconFile,
};

export function LessonItem({ lesson, isSelected, onSelect, onDelete }: LessonItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = lessonTypeIcons[lesson.lesson_type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-surface border border-transparent"
      }`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 rounded text-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <IconGripVertical size={14} />
      </button>

      <Icon size={14} className="text-muted" />

      <span className="flex-1 text-sm text-foreground truncate">{lesson.title || "Untitled lesson"}</span>

      {lesson.is_preview && (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
          <IconEye size={10} /> Preview
        </span>
      )}

      {lesson.lesson_type === "video" && lesson.video_url && (
        <span className="text-[10px] text-muted">Video</span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-1 rounded text-muted hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
      >
        <IconTrash size={12} />
      </button>
    </div>
  );
}
