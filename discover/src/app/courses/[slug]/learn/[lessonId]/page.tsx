"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconPlayerPlay,
  IconFileText,
  IconQuestionMark,
  IconFile,
  IconDownload,
} from "@tabler/icons-react";
import { VideoPlayer } from "@/components/course-player/video-player";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import type { LessonType } from "@/lib/types";

interface Lesson {
  id: string;
  title: string;
  lesson_type: LessonType;
  position: number;
  section_id: string;
  video_url?: string;
  text_content?: string;
  is_preview: boolean;
}

interface Section {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

interface CoursePlayerPageProps {
  params: Promise<{
    slug: string;
    lessonId: string;
  }>;
}

export default function LessonPlayerPage({ params }: CoursePlayerPageProps) {
  const router = useRouter();
  const [slug, setSlug] = useState<string>("");
  const [lessonId, setLessonId] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [sections, setSections] = useState<Section[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const { progress, updateVideoPosition, markAsCompleted, isLoading: progressLoading } = useLessonProgress({
    lessonId,
    courseId,
    onCompletion: () => {
      setCompletedLessons((prev) => new Set([...prev, lessonId]));
    },
  });

  useEffect(() => {
    params.then((p) => {
      setSlug(p.slug);
      setLessonId(p.lessonId);
    });
  }, [params]);

  useEffect(() => {
    if (!slug) return;

    const loadCourse = async () => {
      try {
        const response = await fetch(`/api/courses/${encodeURIComponent(slug)}/curriculum`);
        if (response.ok) {
          const data = await response.json();
          setCourseId(data.courseId);
          setSections(data.sections || []);

          const allLessons = data.sections?.flatMap((s: Section) => s.lessons) || [];
          const lesson = allLessons.find((l: Lesson) => l.id === lessonId);
          setCurrentLesson(lesson || null);

          const initialOpen = new Set<string>();
          data.sections?.forEach((s: Section) => {
            const hasCurrentLesson = s.lessons.some((l: Lesson) => l.id === lessonId);
            if (hasCurrentLesson) {
              initialOpen.add(s.id);
            }
          });
          setOpenSections(initialOpen);

          const completed = new Set<string>();
          data.completedLessons?.forEach((id: string) => completed.add(id));
          setCompletedLessons(completed);
        }
      } catch (error) {
        console.error("Failed to load course:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCourse();
  }, [slug, lessonId]);

  const handleVideoTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      updateVideoPosition(currentTime, duration);
    },
    [updateVideoPosition]
  );

  const handleVideoEnded = useCallback(() => {
    markAsCompleted();
  }, [markAsCompleted]);

  const handleTextScrolledToBottom = useCallback(() => {
    markAsCompleted();
  }, [markAsCompleted]);

  const handleMarkComplete = useCallback(() => {
    markAsCompleted();
  }, [markAsCompleted]);

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const navigateToLesson = useCallback(
    (lesson: Lesson) => {
      router.push(`/courses/${slug}/learn/${lesson.id}`);
    },
    [router, slug]
  );

  const getAdjacentLessons = useCallback(() => {
    const allLessons = sections.flatMap((s) => s.lessons);
    const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
    return {
      previous: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
      next: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null,
    };
  }, [sections, lessonId]);

  const { previous, next } = getAdjacentLessons();

  const renderLessonContent = () => {
    if (!currentLesson) return null;

    switch (currentLesson.lesson_type) {
      case "video":
        return (
          <VideoPlayer
            src={currentLesson.video_url || ""}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
            initialTime={progress?.videoPosition || 0}
          />
        );

      case "text":
        return (
          <div className="prose prose-invert max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html: currentLesson.text_content || "<p>No content available.</p>",
              }}
              className="min-h-[50vh]"
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
                  handleTextScrolledToBottom();
                }
              }}
            />
          </div>
        );

      case "quiz":
        return (
          <div className="bg-surface rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <IconQuestionMark size={32} className="text-primary" />
              <h2 className="text-xl font-semibold">Quiz</h2>
            </div>
            <p className="text-muted">Quiz content will be displayed here.</p>
            <button
              onClick={handleMarkComplete}
              className="mt-4 px-6 py-2 bg-primary text-background rounded-lg hover:bg-primary/80 transition-colors"
            >
              Submit Quiz
            </button>
          </div>
        );

      case "resource":
        return (
          <div className="bg-surface rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <IconFile size={32} className="text-primary" />
              <h2 className="text-xl font-semibold">Resource</h2>
            </div>
            <p className="text-muted">Resource content will be displayed here.</p>
            <button
              onClick={handleMarkComplete}
              className="mt-4 px-6 py-2 bg-primary text-background rounded-lg hover:bg-primary/80 transition-colors"
            >
              <IconDownload size={18} className="inline mr-2" />
              Download Resource
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const getLessonIcon = (type: LessonType) => {
    switch (type) {
      case "video":
        return <IconPlayerPlay size={14} />;
      case "text":
        return <IconFileText size={14} />;
      case "quiz":
        return <IconQuestionMark size={14} />;
      case "resource":
        return <IconFile size={14} />;
      default:
        return <IconPlayerPlay size={14} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#121214] border-r border-border transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="w-80 h-full flex flex-col">
          <div className="p-4 border-b border-border">
            <Link
              href={`/courses/${slug}`}
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <IconArrowLeft size={16} />
              Back to course
            </Link>
            <h1 className="mt-3 text-lg font-semibold line-clamp-2">
              {sections[0]?.lessons[0]?.title || "Course Title"}
            </h1>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            {sections.map((section) => {
              const isOpen = openSections.has(section.id);
              return (
                <div key={section.id} className="mb-2">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface transition-colors text-left"
                  >
                    <span className="text-sm font-medium">{section.title}</span>
                    {isOpen ? (
                      <IconChevronDown size={16} className="text-muted" />
                    ) : (
                      <IconChevronRight size={16} className="text-muted" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="ml-2">
                      {section.lessons.map((lesson) => {
                        const isActive = lesson.id === lessonId;
                        const isCompleted = completedLessons.has(lesson.id);
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => navigateToLesson(lesson)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left text-sm transition-colors ${
                              isActive
                                ? "bg-primary/10 text-foreground"
                                : "text-muted hover:text-foreground hover:bg-surface"
                            }`}
                          >
                            <span
                              className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                                isCompleted
                                  ? "bg-green-600 border-green-600 text-white"
                                  : isActive
                                  ? "border-primary text-primary"
                                  : "border-border"
                              }`}
                            >
                              {isCompleted ? (
                                <IconCheck size={12} />
                              ) : isActive ? (
                                <IconPlayerPlay size={10} fill="currentColor" />
                              ) : (
                                getLessonIcon(lesson.lesson_type)
                              )}
                            </span>
                            <span className="truncate">{lesson.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className={`flex-1 transition-margin duration-300 ${sidebarOpen ? "ml-80" : "ml-0"}`}>
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <IconChevronRight
                  size={20}
                  className={`transition-transform ${sidebarOpen ? "rotate-180" : ""}`}
                />
              </button>
              {currentLesson && (
                <div>
                  <h2 className="font-medium">{currentLesson.title}</h2>
                  <p className="text-xs text-muted">
                    {currentLesson.lesson_type.charAt(0).toUpperCase() + currentLesson.lesson_type.slice(1)} lesson
                  </p>
                </div>
              )}
            </div>

            {currentLesson && !completedLessons.has(lessonId) && (
              <button
                onClick={handleMarkComplete}
                className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface/80 rounded-lg transition-colors text-sm"
              >
                <IconCheck size={16} />
                Mark as complete
              </button>
            )}

            {currentLesson && completedLessons.has(lessonId) && (
              <span className="flex items-center gap-2 text-sm text-green-500">
                <IconCheck size={16} />
                Completed
              </span>
            )}
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {currentLesson && (
            <div className="mb-8">
              {currentLesson.lesson_type === "video" ? (
                <div className="rounded-lg overflow-hidden border border-border">
                  {renderLessonContent()}
                </div>
              ) : (
                renderLessonContent()
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div>
              {previous ? (
                <button
                  onClick={() => navigateToLesson(previous)}
                  className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <IconArrowLeft size={16} />
                  Previous: {previous.title}
                </button>
              ) : (
                <span className="text-sm text-muted">No previous lesson</span>
              )}
            </div>

            <div>
              {next ? (
                <button
                  onClick={() => navigateToLesson(next)}
                  className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Next: {next.title}
                  <IconChevronRight size={16} />
                </button>
              ) : (
                <span className="text-sm text-muted">Course complete!</span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
