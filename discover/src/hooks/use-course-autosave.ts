"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CourseDraft } from "@/lib/types";

const COURSE_DRAFT_KEY = "tutoria_course_draft";
const AUTOSAVE_DELAY = 2000;

export interface UseCourseAutosaveOptions {
  courseId: string;
  onLoad?: (draft: CourseDraft) => void;
}

export function useCourseAutosave({ courseId, onLoad }: UseCourseAutosaveOptions) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem(`${COURSE_DRAFT_KEY}_${courseId}`);
    if (stored) {
      try {
        const draft = JSON.parse(stored) as CourseDraft;
        versionRef.current = draft.version;
        onLoad?.(draft);
      } catch {
        // Invalid stored data, ignore
      }
    }
  }, [courseId, onLoad]);

  const save = useCallback((course: CourseDraft) => {
    const version = versionRef.current + 1;
    const updated: CourseDraft = { ...course, version, updated_at: new Date().toISOString() };
    localStorage.setItem(`${COURSE_DRAFT_KEY}_${courseId}`, JSON.stringify(updated));
    versionRef.current = version;
    setLastSaved(new Date());
    return updated;
  }, [courseId]);

  const scheduleAutosave = useCallback((course: CourseDraft) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setSaving(true);
      save(course);
      setTimeout(() => setSaving(false), 300);
    }, AUTOSAVE_DELAY);
  }, [save]);

  const cancelAutosave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelAutosave();
    };
  }, [cancelAutosave]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(`${COURSE_DRAFT_KEY}_${courseId}`);
    versionRef.current = 0;
  }, [courseId]);

  return {
    saving,
    lastSaved,
    scheduleAutosave,
    save,
    clearDraft,
  };
}
