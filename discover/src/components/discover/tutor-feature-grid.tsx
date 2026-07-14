"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./discover-home.module.css";

const tutorFeaturePanels = [
  {
    index: ".01",
    title: "Find tutors",
    emphasis: "for any subject",
    body: "Search languages, technology, business, creative skills, and more.",
  },
  {
    index: ".02",
    title: "Know who",
    emphasis: "you are booking",
    body: "Review experience, lesson formats, rates, ratings, and availability.",
  },
  {
    index: ".03",
    title: "Learn online",
    emphasis: "or nearby",
    body: "Choose remote sessions or meet tutors in your local area.",
  },
  {
    index: ".04",
    title: "Stay on top",
    emphasis: "of every lesson",
    body: "Keep bookings, messages, notes, and learning goals organized.",
  },
];

const gridColumns = [0, 25, 50, 75, 100];
const gridRows = [0, 50, 100];
const tutorRoleWords = ["TUTOR", "MENTOR", "COACH", "TEACHER"];

export function TutorFeatureGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 1 },
    );

    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`${styles.peopleReferenceGrid} ${isVisible ? styles.peopleReferenceGridVisible : ""}`}
      ref={gridRef}
    >
      {gridRows.flatMap((row) =>
        gridColumns.map((column) => (
          <i
            className={styles.peopleGridNode}
            data-column={column}
            key={`${column}-${row}`}
            style={{ left: `${column}%`, top: `${row}%` }}
          />
        )),
      )}
      {tutorRoleWords.map((word) => (
        <div className={styles.peopleRoleWord} aria-hidden="true" key={word}>
          <span className={styles.peopleRoleWordTrack}>
            <b>{word}</b>
            <b>{word}</b>
          </span>
        </div>
      ))}
      {tutorFeaturePanels.map((panel) => (
        <aside className={styles.peopleFrameCopy} aria-label={`${panel.title} ${panel.emphasis}`} key={panel.index}>
          <div className={styles.peopleFrameLabel}>
            <span>TUTORIA</span>
            <span>{panel.index}</span>
          </div>
          <p className={styles.peopleFrameStatement}>
            {panel.title}<br />
            <em>{panel.emphasis}</em>
          </p>
          <p className={styles.peopleFrameBody}>{panel.body}</p>
        </aside>
      ))}
    </div>
  );
}
