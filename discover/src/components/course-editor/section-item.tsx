"use client";

import { useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical, IconChevronDown, IconChevronRight, IconTrash, IconPlus } from "@tabler/icons-react";
import type { SectionDraft } from "@/lib/types";
import { LessonItem } from "./lesson-item";

interface SectionItemProps {
  section: SectionDraft;
  selectedLessonId?: string;
  onSelectLesson: (lessonId: string) => void;
  onLessonDelete: (lessonId: string) => void;
  onAddLesson: (sectionId: string) => void;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
}

export function SectionItem({
  section,
  selectedLessonId,
  onSelectLesson,
  onLessonDelete,
  onAddLesson,
  onTitleChange,
  onDelete,
}: SectionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);
  const [expanded, setExpanded] = useState(true);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTitleSubmit = () => {
    onTitleChange(editTitle.trim() || "Untitled Section");
    setIsEditing(false);
  };

  const lessonIds = section.lessons.map((l) => l.id);

  return (
    <div ref={setNodeRef} style={style} className="select-none">
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-surface/50 border border-border">
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded text-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <IconGripVertical size={16} />
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded text-muted hover:text-foreground"
        >
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </button>

        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSubmit();
              if (e.key === "Escape") {
                setEditTitle(section.title);
                setIsEditing(false);
              }
            }}
            className="flex-1 px-2 py-1 text-sm font-medium bg-background border border-border rounded focus:outline-none focus:border-primary"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium text-foreground cursor-text"
            onDoubleClick={() => {
              setEditTitle(section.title);
              setIsEditing(true);
            }}
          >
            {section.title || "Untitled Section"}
          </span>
        )}

        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-border/50 text-muted">
          {section.lessons.length} {section.lessons.length === 1 ? "lesson" : "lessons"}
        </span>

        <button
          onClick={() => onAddLesson(section.id)}
          className="p-1 rounded text-muted hover:text-primary hover:bg-primary/10"
          title="Add lesson"
        >
          <IconPlus size={14} />
        </button>

        <button
          onClick={onDelete}
          className="p-1 rounded text-muted hover:text-red-500 hover:bg-red-50"
          title="Delete section"
        >
          <IconTrash size={14} />
        </button>
      </div>

      {expanded && (
        <div className="ml-6 mt-1 space-y-1">
          <SortableContext items={lessonIds} strategy={verticalListSortingStrategy}>
            {section.lessons.map((lesson) => (
              <LessonItem
                key={lesson.id}
                lesson={lesson}
                isSelected={selectedLessonId === lesson.id}
                onSelect={() => onSelectLesson(lesson.id)}
                onDelete={() => onLessonDelete(lesson.id)}
              />
            ))}
          </SortableContext>
          {section.lessons.length === 0 && (
            <p className="text-xs text-muted italic px-3 py-2">No lessons yet</p>
          )}
        </div>
      )}
    </div>
  );
}
