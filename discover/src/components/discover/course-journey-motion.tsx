"use client";

import {
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import {
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

interface CourseJourneyMotionProps extends PropsWithChildren {
  className?: string;
  stageClassName?: string;
}

const DESKTOP_QUERY = "(min-width: 901px)";

export function CourseJourneyMotion({
  children,
  className,
  stageClassName,
}: CourseJourneyMotionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef({ start: 0, end: 0 });
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start start", "end end"],
  });
  const trackX = useTransform(scrollYProgress, (progress) => {
    const { start, end } = rangeRef.current;
    return start + (end - start) * progress;
  });
  useMotionValueEvent(trackX, "change", (latest) => {
    rootRef.current?.style.setProperty("--course-track-x", `${latest}px`);
  });

  useEffect(() => {
    const root = rootRef.current;
    const stage = root?.querySelector<HTMLElement>("[data-course-stage]");
    const track = root?.querySelector<HTMLElement>("[data-course-track]");

    if (!root || !stage || !track) return;

    const desktop = window.matchMedia(DESKTOP_QUERY);

    const measure = () => {
      const shouldPin = desktop.matches && !prefersReducedMotion;
      root.dataset.horizontal = shouldPin ? "true" : "false";
      const stageWidth = stage.clientWidth;
      const trackWidth = track.scrollWidth;
      const peek = Math.min(48, Math.max(32, stageWidth * 0.032));
      const start = shouldPin ? stageWidth - peek : 0;
      const end = shouldPin ? stageWidth - trackWidth : 0;
      const scrollDistance = Math.max(0, start - end);
      const progress = scrollYProgress.get();

      rangeRef.current = { start, end };
      root.dataset.horizontal = scrollDistance > 0 ? "true" : "false";
      root.style.setProperty(
        "--course-scroll-distance",
        `${scrollDistance}px`,
      );
      root.style.setProperty(
        "--course-track-x",
        `${start + (end - start) * progress}px`,
      );
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(stage);
    resizeObserver.observe(track);
    desktop.addEventListener("change", measure);

    return () => {
      resizeObserver.disconnect();
      desktop.removeEventListener("change", measure);
      delete root.dataset.horizontal;
      root.style.removeProperty("--course-scroll-distance");
      root.style.removeProperty("--course-track-x");
    };
  }, [prefersReducedMotion, scrollYProgress]);

  return (
    <div ref={rootRef} className={className}>
      <div className={stageClassName} data-course-stage>
        {children}
      </div>
    </div>
  );
}
