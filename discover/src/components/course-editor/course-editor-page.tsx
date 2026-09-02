"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconDeviceFloppy, IconSend, IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { generateId } from "@/lib/types";
import type { CourseDraft, SectionDraft, LessonDraft, LessonType } from "@/lib/types";
import { useCourseAutosave } from "@/hooks/use-course-autosave";
import { CurriculumTree } from "./curriculum-tree";
import { LessonEditor } from "./lesson-editor";
import { PublishPanel } from "./publish-panel";
import { getApiBaseUrl } from "@/lib/auth/config";
import { getSessionAccessToken } from "@/lib/auth/session";

function createEmptyCourse(id: string): CourseDraft {
  return {
    id,
    title: "",
    status: "draft",
    sections: [],
    version: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createEmptySection(position: number): SectionDraft {
  return {
    id: generateId(),
    title: "Untitled Section",
    position,
    lessons: [],
  };
}

function createEmptyLesson(sectionId: string, position: number, type: LessonType = "text"): LessonDraft {
  return {
    id: generateId(),
    section_id: sectionId,
    title: "",
    lesson_type: type,
    position,
    is_preview: false,
  };
}

async function publishToBackend(course: CourseDraft): Promise<{ success: boolean; error?: string }> {
  const token = getSessionAccessToken();
  if (!token) {
    return { success: false, error: "You must be signed in to publish." };
  }

  try {
    const baseUrl = getApiBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/api/v1/courses/${course.id}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    });

    if (response.status === 404) {
      return { success: false, error: "Course not found. It may need to be created first." };
    }
    if (response.status === 403) {
      return { success: false, error: "You do not have permission to publish this course." };
    }
    if (response.status === 409) {
      return { success: false, error: "This course is already published." };
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = (payload as { error?: { message?: string } })?.error?.message || "Publish failed. Please try again.";
      return { success: false, error: message };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Unable to reach the server. Check your connection." };
  }
}

export function CourseEditorPage({ courseId }: { courseId?: string }) {
  const router = useRouter();
  const draftId = courseId || generateId();
  const [course, setCourse] = useState<CourseDraft>(() => createEmptyCourse(draftId));
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>();
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [showCurriculum, setShowCurriculum] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleLoad = useCallback((draft: CourseDraft) => {
    setCourse(draft);
  }, []);

  const { saving: autosaving, lastSaved, scheduleAutosave, save } = useCourseAutosave({
    courseId: draftId,
    onLoad: handleLoad,
  });

  useEffect(() => {
    const hasContent = course.title || course.sections.length > 0;
    if (!hasContent) return;
    scheduleAutosave(course);
  }, [course, scheduleAutosave]);

  const selectedLesson = course.sections
    .flatMap((s) => s.lessons)
    .find((l) => l.id === selectedLessonId);

  const handleCourseUpdate = useCallback((updates: Partial<CourseDraft>) => {
    setCourse((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSectionAdd = useCallback(() => {
    setCourse((prev) => {
      const newSection = createEmptySection(prev.sections.length);
      return { ...prev, sections: [...prev.sections, newSection] };
    });
  }, []);

  const handleSectionDelete = useCallback((sectionId: string) => {
    setCourse((prev) => {
      const newSections = prev.sections.filter((s) => s.id !== sectionId);
      const newSelectedId = selectedLessonId
        ? newSections.flatMap((s) => s.lessons).find((l) => l.id === selectedLessonId)?.id
        : undefined;
      setSelectedLessonId(newSelectedId);
      return { ...prev, sections: newSections };
    });
  }, [selectedLessonId]);

  const handleSectionTitleChange = useCallback((sectionId: string, title: string) => {
    setCourse((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      ),
    }));
  }, []);

  const handleLessonAdd = useCallback((sectionId: string) => {
    setCourse((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const newLesson = createEmptyLesson(sectionId, s.lessons.length);
        setSelectedLessonId(newLesson.id);
        return { ...s, lessons: [...s.lessons, newLesson] };
      }),
    }));
  }, []);

  const handleLessonDelete = useCallback((lessonId: string) => {
    setCourse((prev) => {
      const newSections = prev.sections.map((s) => ({
        ...s,
        lessons: s.lessons.filter((l) => l.id !== lessonId),
      }));
      if (selectedLessonId === lessonId) {
        setSelectedLessonId(undefined);
      }
      return { ...prev, sections: newSections };
    });
  }, [selectedLessonId]);

  const handleLessonUpdate = useCallback((lessonId: string, updates: Partial<LessonDraft>) => {
    setCourse((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) =>
          l.id === lessonId ? { ...l, ...updates } : l
        ),
      })),
    }));
  }, []);

  const handleSectionsReorder = useCallback((sectionIds: string[]) => {
    setCourse((prev) => {
      const sectionMap = new Map(prev.sections.map((s) => [s.id, s]));
      const reordered = sectionIds
        .map((id, index) => {
          const section = sectionMap.get(id);
          return section ? { ...section, position: index } : null;
        })
        .filter((s): s is SectionDraft => s !== null);
      return { ...prev, sections: reordered };
    });
  }, []);

  const handleLessonsReorder = useCallback((sectionId: string, lessonIds: string[]) => {
    setCourse((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const lessonMap = new Map(s.lessons.map((l) => [l.id, l]));
        const reordered = lessonIds
          .map((id, index) => {
            const lesson = lessonMap.get(id);
            return lesson ? { ...lesson, position: index } : null;
          })
          .filter((l): l is LessonDraft => l !== null);
        return { ...s, lessons: reordered };
      }),
    }));
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    save(course);
    setTimeout(() => setSaving(false), 300);
  }, [course, save]);

  const handlePublish = useCallback(async () => {
    if (!course.title.trim()) return;
    setPublishError(null);
    setPublishing(true);
    setRetryCount(0);

    const result = await publishToBackend(course);

    if (result.success) {
      setCourse((prev) => ({ ...prev, status: "published" }));
      setPublishing(false);
      router.push("/courses");
    } else {
      setPublishError(result.error || "Publish failed. Please try again.");
      setPublishing(false);
    }
  }, [course, router]);

  const handlePublishRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    setPublishError(null);
    handlePublish();
  }, [handlePublish]);

  return (
    <RequireAuth>
      <CourseEditor
        course={course}
        selectedLessonId={selectedLessonId}
        showPublishPanel={showPublishPanel}
        showCurriculum={showCurriculum}
        saving={saving || autosaving}
        publishing={publishing}
        lastSaved={lastSaved}
        publishError={publishError}
        onCourseUpdate={handleCourseUpdate}
        onSelectLesson={setSelectedLessonId}
        onSectionAdd={handleSectionAdd}
        onSectionDelete={handleSectionDelete}
        onSectionTitleChange={handleSectionTitleChange}
        onLessonAdd={handleLessonAdd}
        onLessonDelete={handleLessonDelete}
        onLessonUpdate={handleLessonUpdate}
        onSectionsReorder={handleSectionsReorder}
        onLessonsReorder={handleLessonsReorder}
        onSave={handleSave}
        onPublish={() => setShowPublishPanel(true)}
        onClosePublishPanel={() => setShowPublishPanel(false)}
        onToggleCurriculum={() => setShowCurriculum(!showCurriculum)}
        onPublishConfirm={handlePublish}
        onPublishRetry={handlePublishRetry}
      />
    </RequireAuth>
  );
}

interface CourseEditorProps {
  course: CourseDraft;
  selectedLessonId?: string;
  showPublishPanel: boolean;
  showCurriculum: boolean;
  saving: boolean;
  publishing: boolean;
  lastSaved: Date | null;
  publishError: string | null;
  onCourseUpdate: (updates: Partial<CourseDraft>) => void;
  onSelectLesson: (lessonId: string) => void;
  onSectionAdd: () => void;
  onSectionDelete: (sectionId: string) => void;
  onSectionTitleChange: (sectionId: string, title: string) => void;
  onLessonAdd: (sectionId: string) => void;
  onLessonDelete: (lessonId: string) => void;
  onLessonUpdate: (lessonId: string, updates: Partial<LessonDraft>) => void;
  onSectionsReorder: (sectionIds: string[]) => void;
  onLessonsReorder: (sectionId: string, lessonIds: string[]) => void;
  onSave: () => void;
  onPublish: () => void;
  onClosePublishPanel: () => void;
  onToggleCurriculum: () => void;
  onPublishConfirm: () => void;
  onPublishRetry: () => void;
}

function CourseEditor({
  course,
  selectedLessonId,
  showPublishPanel,
  showCurriculum,
  saving,
  publishing,
  lastSaved,
  publishError,
  onCourseUpdate,
  onSelectLesson,
  onSectionAdd,
  onSectionDelete,
  onSectionTitleChange,
  onLessonAdd,
  onLessonDelete,
  onLessonUpdate,
  onSectionsReorder,
  onLessonsReorder,
  onSave,
  onPublish,
  onClosePublishPanel,
  onToggleCurriculum,
  onPublishConfirm,
  onPublishRetry,
}: CourseEditorProps) {
  const router = useRouter();
  const selectedLesson = course.sections.flatMap((s) => s.lessons).find((l) => l.id === selectedLessonId);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/courses")}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                aria-label="Back"
              >
                <IconArrowLeft size={20} />
              </button>
              <input
                type="text"
                value={course.title}
                onChange={(e) => onCourseUpdate({ title: e.target.value })}
                placeholder="Untitled Course"
                className="text-sm font-semibold bg-transparent focus:outline-none placeholder:text-muted/30 min-w-[200px]"
              />
            </div>
            <div className="flex items-center gap-2">
              {saving && <span className="text-[11px] text-muted">Saving\u2026</span>}
              {!saving && lastSaved && (
                <span className="text-[11px] text-muted">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={onSave}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                <IconDeviceFloppy size={13} /> Save
              </button>
              <button
                onClick={onPublish}
                disabled={publishing || !course.title.trim()}
                className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? (
                  <span className="animate-spin"><IconSend size={13} /></span>
                ) : (
                  <IconSend size={13} />
                )}
                Publish
              </button>
            </div>
          </div>
          {publishError && (
            <div className="flex items-center gap-2 px-2 py-2 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-900">
              <IconAlertCircle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400 flex-1">{publishError}</p>
              <button
                onClick={onPublishRetry}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <IconRefresh size={12} /> Retry
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {showCurriculum && (
          <aside className="w-80 border-r border-border bg-background flex-shrink-0 overflow-hidden">
            <CurriculumTree
              sections={course.sections}
              selectedLessonId={selectedLessonId}
              onSelectLesson={onSelectLesson}
              onSectionAdd={onSectionAdd}
              onSectionDelete={onSectionDelete}
              onSectionTitleChange={onSectionTitleChange}
              onLessonAdd={onLessonAdd}
              onLessonDelete={onLessonDelete}
              onLessonUpdate={onLessonUpdate}
              onSectionsReorder={onSectionsReorder}
              onLessonsReorder={onLessonsReorder}
              isLoading={publishing}
            />
          </aside>
        )}

        <main className="flex-1 overflow-hidden bg-background">
          {selectedLesson ? (
            <LessonEditor
              lesson={selectedLesson}
              onUpdate={(updates) => onLessonUpdate(selectedLesson.id, updates)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted">Select a lesson to edit</p>
                <p className="text-xs text-muted mt-1">or add a new section to get started</p>
              </div>
            </div>
          )}
        </main>

        {showPublishPanel && (
          <aside className="w-80 border-l border-border bg-background flex-shrink-0 overflow-hidden hidden lg:block">
            <PublishPanel
              course={course}
              onUpdate={onCourseUpdate}
              onPublish={onPublishConfirm}
              onSave={onSave}
              saving={saving}
              publishing={publishing}
            />
          </aside>
        )}
      </div>

      {showPublishPanel && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClosePublishPanel}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl">
            <PublishPanel
              course={course}
              onUpdate={onCourseUpdate}
              onPublish={onPublishConfirm}
              onSave={onSave}
              saving={saving}
              publishing={publishing}
            />
          </div>
        </div>
      )}
    </div>
  );
}
