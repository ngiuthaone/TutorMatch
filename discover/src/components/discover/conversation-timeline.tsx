"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  IconArrowRight,
  IconHeart,
  IconMessageCircle,
  IconRepeat,
  IconSend2,
} from "@tabler/icons-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

import styles from "./discover-home.module.css";

type ConversationPost = {
  author: string;
  handle: string;
  time: string;
  avatar: string;
  category: string;
  title: string;
  body: string;
  replies: number;
  likes: number;
  reposts: number;
};

const posts: ConversationPost[] = [
  {
    author: "Linh Pham",
    handle: "@linhlearns",
    time: "12m",
    avatar: "❓",
    category: "Looking for Advice",
    title: "How did you overcome your fear of public speaking?",
    body: "I've been practicing, but I still get nervous in front of people. Any tips or resources that helped you?",
    replies: 18,
    likes: 42,
    reposts: 6,
  },
  {
    author: "Duc Pham",
    handle: "@duc.frames",
    time: "28m",
    avatar: "📷",
    category: "Sharing Knowledge",
    title: "5 photography tips I wish I knew earlier 📷",
    body: "• Learn lighting before buying gear.\n• Practice every day.\n• Focus on composition.\n• Edit less.\n• Shoot what you enjoy.\n\nWhat would you add?",
    replies: 31,
    likes: 126,
    reposts: 22,
  },
  {
    author: "Emi Sato",
    handle: "@emi.studies",
    time: "46m",
    avatar: "🇯🇵",
    category: "Learning Journey",
    title: "30 days into learning Japanese 🇯🇵",
    body: "I can finally hold a simple conversation! Small, consistent practice really works.\n\nWhat's a skill you're learning right now?",
    replies: 24,
    likes: 89,
    reposts: 9,
  },
  {
    author: "Huy Tran",
    handle: "@huybuilds",
    time: "1h",
    avatar: "👋",
    category: "Looking for Collaborators",
    title: "Looking for a UI/UX designer 👋",
    body: "I'm building a platform for learning and communities. If you enjoy clean, minimal design, let's connect!",
    replies: 15,
    likes: 54,
    reposts: 11,
  },
  {
    author: "Mai Le",
    handle: "@maiwanders",
    time: "2h",
    avatar: "📸",
    category: "Events & Workshops",
    title: "Free Photography Walk this Saturday 📸",
    body: "📍 Hoàn Kiếm Lake\n🕘 9:00 AM\n\nAll skill levels are welcome. Bring your camera—or just your phone!",
    replies: 27,
    likes: 97,
    reposts: 18,
  },
  {
    author: "An Nguyen",
    handle: "@an.teaches",
    time: "3h",
    avatar: "🎉",
    category: "Milestones & Achievements",
    title: "I published my first course today! 🎉",
    body: "It isn't perfect, but it's finally live.\n\nSometimes the hardest part is simply getting started.",
    replies: 39,
    likes: 174,
    reposts: 26,
  },
];

const SEQUENCE_START = 0.135;
const SEQUENCE_END = 0.995;
const CARD_SPACING = 0.86;
const LANDING_END = 0.32;
const EXIT_START = 0.55;
const FADE_IN_END = 0.28;
const FADE_OUT_START = 0.58;
const FADE_OUT_END = 0.88;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;
const smoothstep = (value: number) => value * value * (3 - 2 * value);

function PostCardContent({ post }: { post: ConversationPost }) {
  return (
    <>
      <Link
        href="/discussions"
        className={styles.threadPostLink}
        aria-label={`${post.category}: ${post.title}`}
      >
        <span className={styles.threadPostBody}>
          <span className={styles.threadIdentity}>
            <span className={styles.threadAvatar} aria-hidden="true">{post.avatar}</span>
            <span className={styles.threadAuthor}>
              <strong>{post.author}</strong>
              <small>{post.handle} · {post.time}</small>
            </span>
          </span>

          <strong className={styles.threadTitle}>{post.title}</strong>
          <span className={styles.threadCopy}>{post.body}</span>

          <span className={styles.threadActions} aria-hidden="true">
            <span><IconHeart size={18} stroke={1.7} /> {post.likes}</span>
            <span><IconMessageCircle size={18} stroke={1.7} /> {post.replies}</span>
            <span><IconRepeat size={18} stroke={1.7} /> {post.reposts}</span>
            <span><IconSend2 size={18} stroke={1.7} /></span>
          </span>
        </span>
      </Link>

      <aside className={styles.threadCategory} aria-label={`Post category: ${post.category}`}>
        <strong>{post.category}</strong>
      </aside>
    </>
  );
}

function AnimatedPostCard({
  post,
  index,
  progress,
  viewportHeight,
}: {
  post: ConversationPost;
  index: number;
  progress: MotionValue<number>;
  viewportHeight: number;
}) {
  const totalSpan = 1 + (posts.length - 1) * CARD_SPACING;
  const sequenceRange = SEQUENCE_END - SEQUENCE_START;
  const start = SEQUENCE_START + ((index * CARD_SPACING) / totalSpan) * sequenceRange;
  const end = SEQUENCE_START + ((index * CARD_SPACING + 1) / totalSpan) * sequenceRange;
  const duration = end - start;
  const cardHeight = Math.min(304, Math.max(256, viewportHeight * 0.34));
  const entryY = viewportHeight * 0.72;
  const centeredY = (viewportHeight - cardHeight) / 2;
  const exitY = -cardHeight - 24;
  const localProgress = useTransform(progress, (value) =>
    clamp01((value - start) / duration),
  );
  const y = useTransform(localProgress, (value) => {
    if (value <= LANDING_END) {
      return mix(
        entryY,
        centeredY,
        smoothstep(value / LANDING_END),
      );
    }

    if (value <= EXIT_START) return centeredY;

    return mix(
      centeredY,
      exitY,
      smoothstep((value - EXIT_START) / (1 - EXIT_START)),
    );
  });
  const opacity = useTransform(localProgress, (value) => {
    if (value <= FADE_IN_END) {
      return smoothstep(value / FADE_IN_END);
    }

    if (value <= FADE_OUT_START) return 1;
    if (value >= FADE_OUT_END) return 0;

    return 1 - smoothstep(
      (value - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START),
    );
  });
  const scale = useTransform(localProgress, (value) => {
    if (value <= LANDING_END) {
      return mix(0.99, 1, smoothstep(value / LANDING_END));
    }

    if (value <= EXIT_START) return 1;

    return mix(
      1,
      0.985,
      smoothstep((value - EXIT_START) / (1 - EXIT_START)),
    );
  });

  return (
    <motion.article
      className={styles.threadPost}
      data-side={index % 2 === 0 ? "left" : "right"}
      data-animated="true"
      style={{ y, opacity, scale }}
    >
      <PostCardContent post={post} />
    </motion.article>
  );
}

export function ConversationTimeline() {
  const rootRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [desktopMotion, setDesktopMotion] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(900);
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start start", "end end"],
  });
  const introOpacity = useTransform(scrollYProgress, [0, 0.025, 0.12, 0.21], [0, 1, 1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.13, 0.21], [22, 0, -90]);
  const timelineOpacity = useTransform(scrollYProgress, [0.1, 0.16, 0.94, 0.99], [0, 1, 1, 0]);
  const timelineHeight = useTransform(scrollYProgress, [0.14, 0.97], ["0%", "100%"]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1101px)");
    const syncMotionMode = () => {
      setDesktopMotion(desktop.matches && !prefersReducedMotion);
      setViewportHeight(window.innerHeight);
    };

    syncMotionMode();
    desktop.addEventListener("change", syncMotionMode);
    window.addEventListener("resize", syncMotionMode);
    return () => {
      desktop.removeEventListener("change", syncMotionMode);
      window.removeEventListener("resize", syncMotionMode);
    };
  }, [prefersReducedMotion]);

  return (
    <section
      ref={rootRef}
      className={styles.conversationTimeline}
      data-motion={desktopMotion ? "pinned" : "static"}
      aria-labelledby="conversations-heading"
    >
      <div className={styles.conversationStage}>
        <div className={styles.conversationGrid} aria-hidden="true" />
        <div className={styles.conversationScanline} aria-hidden="true" />

        <motion.header
          className={styles.conversationIntro}
          style={desktopMotion ? { opacity: introOpacity, y: introY } : undefined}
        >
          <p className="tutoria-kicker">A safe space to share</p>
          <div>
            <h2 id="conversations-heading">
              <span>There&apos;s more than</span>
              <span>one way to begin.</span>
            </h2>
            <Link className={`${styles.sectionLink} tutoria-text-link`} href="/discussions">
              Enter discussions <IconArrowRight size={16} />
            </Link>
          </div>
        </motion.header>

        {desktopMotion && (
          <motion.div className={styles.conversationTimelineRail} style={{ opacity: timelineOpacity }} aria-hidden="true">
            <span className={styles.conversationTimelineDots} />
            <motion.span className={styles.conversationTimelineProgress} style={{ height: timelineHeight }}>
              <span className={styles.conversationTimelineMarker} />
            </motion.span>
          </motion.div>
        )}

        <div className={styles.threadPostLayer} aria-label="Featured community posts">
          {posts.map((post, index) => desktopMotion ? (
            <AnimatedPostCard
              key={post.title}
              post={post}
              index={index}
              progress={scrollYProgress}
              viewportHeight={viewportHeight}
            />
          ) : (
            <article className={styles.threadPost} data-side={index % 2 === 0 ? "left" : "right"} key={post.title}>
              <PostCardContent post={post} />
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
