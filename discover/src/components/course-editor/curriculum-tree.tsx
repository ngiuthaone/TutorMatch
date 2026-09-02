"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IconPlus, IconLoader2 } from "@tabler/icons-react";
import type { SectionDraft, LessonDraft } from "@/lib/types";
import { SectionItem } from "./section-item";

interface CurriculumTreeProps {
  sections: SectionDraft[];
  selectedLessonId?: string;
  onSelectLesson: (lessonId: string) => void;
  onSectionAdd: () => void;
  onSectionDelete: (sectionId: string) => void;
  onSectionTitleChange: (sectionId: string, title: string) => void;
  onLessonAdd: (sectionId: string) => void;
  onLessonDelete: (lessonId: string) => void;
  onLessonUpdate: (lessonId: string, updates: Partial<LessonDraft>) => void;
  onSectionsReorder: (sectionIds: string[]) => void;
  onLessonsReorder: (sectionId: string, lessonIds: string[]) => void;
  isLoading?: boolean;
}

export function CurriculumTree({
  sections,
  selectedLessonId,
  onSelectLesson,
  onSectionAdd,
  onSectionDelete,
  onSectionTitleChange,
  onLessonAdd,
  onLessonDelete,
  onLessonUpdate,
  onSectionsReorder,
  onLessonsReorder,
  isLoading = false,
}: CurriculumTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"section" | "lesson" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return rectIntersection(args);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    const isSection = sections.some((s) => s.id === active.id);
    setActiveType(isSection ? "section" : "lesson");
  };

  const handleDragOver = (_event: DragOverEvent) => {};

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeSectionIndex = sections.findIndex((s) => s.id === activeId);
    const overSectionIndex = sections.findIndex((s) => s.id === overId);

    if (activeSectionIndex !== -1 && activeType === "section") {
      if (overSectionIndex !== -1) {
        const newSections = [...sections];
        const [moved] = newSections.splice(activeSectionIndex, 1);
        newSections.splice(overSectionIndex, 0, moved);
        onSectionsReorder(newSections.map((s) => s.id));
      }
    } else if (activeType === "lesson") {
      const activeSection = sections.find((s) => s.lessons.some((l) => l.id === activeId));
      const overSection = sections.find((s) => s.id === overId || s.lessons.some((l) => l.id === overId));

      if (!activeSection) return;

      const activeLessonIndex = activeSection.lessons.findIndex((l) => l.id === activeId);
      let overLessonIndex = -1;
      let targetSectionId = activeSection.id;

      if (overSection) {
        if (overSection.id === activeSection.id) {
          overLessonIndex = overSection.lessons.findIndex((l) => l.id === overId);
          targetSectionId = overSection.id;
        } else {
          if (overId === overSection.id) {
            overLessonIndex = overSection.lessons.length;
          } else {
            overLessonIndex = overSection.lessons.findIndex((l) => l.id === overId);
          }
          targetSectionId = overSection.id;
        }
      }

      if (activeSection.id === targetSectionId) {
        const sectionIndex = sections.findIndex((s) => s.id === targetSectionId);
        const newLessons = [...sections[sectionIndex].lessons];
        const [moved] = newLessons.splice(activeLessonIndex, 1);
        if (overLessonIndex === -1) {
          overLessonIndex = newLessons.length;
        }
        newLessons.splice(overLessonIndex, 0, moved);
        onLessonsReorder(targetSectionId, newLessons.map((l) => l.id));
      } else {
        const sourceSectionIndex = sections.findIndex((s) => s.id === activeSection.id);
        const targetSectionIndex = sections.findIndex((s) => s.id === targetSectionId);
        const newSourceLessons = [...sections[sourceSectionIndex].lessons];
        const [moved] = newSourceLessons.splice(activeLessonIndex, 1);
        const targetLessons = [...sections[targetSectionIndex].lessons];
        if (overLessonIndex === -1 || overLessonIndex >= targetLessons.length) {
          targetLessons.push({ ...moved, section_id: targetSectionId });
        } else {
          targetLessons.splice(overLessonIndex, 0, { ...moved, section_id: targetSectionId });
        }

        const newSections = sections.map((s, i) => {
          if (i === sourceSectionIndex) {
            return { ...s, lessons: newSourceLessons };
          }
          if (i === targetSectionIndex) {
            return { ...s, lessons: targetLessons };
          }
          return s;
        });

        onLessonsReorder(activeSection.id, newSourceLessons.map((l) => l.id));
        onLessonsReorder(targetSectionId, targetLessons.map((l) => l.id));
      }
    }
  };

  const sectionIds = sections.map((s) => s.id);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Curriculum</h2>
        {!isLoading && (
          <button
            onClick={onSectionAdd}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            <IconPlus size={12} /> Section
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-surface/50 border border-border">
                  <div className="w-4 h-4 bg-border rounded" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-border rounded w-3/4" />
                    <div className="h-2 bg-border rounded w-1/2" />
                  </div>
                  <div className="w-8 h-4 bg-border rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
                <IconPlus size={20} className="text-muted" />
              </div>
              <p className="text-sm text-muted">No sections yet</p>
              <button
                onClick={onSectionAdd}
                className="mt-1 text-xs text-primary hover:underline"
              >
                Add your first section
              </button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SectionItem
                  key={section.id}
                  section={section}
                  selectedLessonId={selectedLessonId}
                  onSelectLesson={onSelectLesson}
                  onLessonDelete={onLessonDelete}
                  onAddLesson={onLessonAdd}
                  onTitleChange={(title) => onSectionTitleChange(section.id, title)}
                  onDelete={() => onSectionDelete(section.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
