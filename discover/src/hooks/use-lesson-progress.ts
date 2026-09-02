"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateLessonProgress } from "@/lib/courses/backend-courses-api";

export interface LessonProgress {
  lessonId: string;
  videoPosition: number;
  completed: boolean;
  lastUpdated: string;
}

interface UseLessonProgressOptions {
  lessonId: string;
  courseId: string;
  onProgressUpdate?: (position: number) => void;
  onCompletion?: () => void;
}

const STORAGE_KEY_PREFIX = "tutoria_lesson_progress_";
const DEBOUNCE_MS = 2000;

export function useLessonProgress({
  lessonId,
  courseId,
  onProgressUpdate,
  onCompletion,
}: UseLessonProgressOptions) {
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const pendingPositionRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBeaconRef = useRef<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${lessonId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LessonProgress;
        if (parsed.lessonId === lessonId) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProgress(parsed);
          if (parsed.videoPosition > 0) {
            onProgressUpdate?.(parsed.videoPosition);
          }
        }
      } catch {
        // Invalid stored data
      }
    }
    setIsLoading(false);
  }, [lessonId, onProgressUpdate]);

  const saveProgress = useCallback(
    async (position: number, completed: boolean = false) => {
      if (isSaving) return;

      const progressData: LessonProgress = {
        lessonId,
        videoPosition: position,
        completed,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(`${STORAGE_KEY_PREFIX}${lessonId}`, JSON.stringify(progressData));
      setProgress(progressData);

      try {
        setIsSaving(true);
        await updateLessonProgress(lessonId, completed);
        setIsSaving(false);
      } catch {
        setIsSaving(false);
      }
    },
    [lessonId, isSaving]
  );

  const debouncedSave = useCallback(
    (position: number) => {
      pendingPositionRef.current = position;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (pendingPositionRef.current !== null) {
          saveProgress(pendingPositionRef.current);
          pendingPositionRef.current = null;
        }
      }, DEBOUNCE_MS);
    },
    [saveProgress]
  );

  const updateVideoPosition = useCallback(
    (currentTime: number, duration: number) => {
      const existingProgress = progress;
      if (existingProgress && existingProgress.videoPosition > currentTime) {
        return;
      }

      debouncedSave(currentTime);

      const watchedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
      if (watchedPercent >= 90 && (!existingProgress || !existingProgress.completed)) {
        saveProgress(currentTime, true);
        onCompletion?.();
      }
    },
    [progress, debouncedSave, saveProgress, onCompletion]
  );

  const markAsCompleted = useCallback(async () => {
    await saveProgress(progress?.videoPosition || 0, true);
    onCompletion?.();
  }, [progress, saveProgress, onCompletion]);

  const resetProgress = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${lessonId}`);
    setProgress(null);
  }, [lessonId]);

  useEffect(() => {
    const handleBeacon = () => {
      if (pendingPositionRef.current !== null) {
        const data = JSON.stringify({
          lessonId,
          videoPosition: pendingPositionRef.current,
          completed: progress?.completed || false,
          lastUpdated: new Date().toISOString(),
        });
        navigator.sendBeacon(
          `/api/courses/progress?lessonId=${encodeURIComponent(lessonId)}`,
          data
        );
        saveBeaconRef.current = true;
      }
    };

    const handleBeforeUnload = () => {
      if (pendingPositionRef.current !== null && !saveBeaconRef.current) {
        const data = JSON.stringify({
          lessonId,
          videoPosition: pendingPositionRef.current,
          completed: progress?.completed || false,
          lastUpdated: new Date().toISOString(),
        });
        navigator.sendBeacon(
          `/api/courses/progress?lessonId=${encodeURIComponent(lessonId)}`,
          data
        );
      }
    };

    window.addEventListener("visibilitychange", handleBeacon);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("visibilitychange", handleBeacon);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [lessonId, progress]);

  return {
    progress,
    isLoading,
    isSaving,
    updateVideoPosition,
    markAsCompleted,
    resetProgress,
  };
}
