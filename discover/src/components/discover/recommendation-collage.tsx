import Image from "next/image";
import Link from "next/link";
import { IconArrowRight, IconArrowUpRight } from "@tabler/icons-react";

import { forYouItems } from "./for-you-data";
import styles from "./recommendation-collage.module.css";

export function RecommendationCollage() {
  return (
    <section className={styles.recommendationScene} aria-label="Recommended for you">
      <div className={styles.recommendationSticky}>
          <div className={styles.recommendationBackdrop} aria-hidden="true" />
          <div className={styles.recommendationAmbient} aria-hidden="true" />
          <div className={styles.referenceGrid} aria-hidden="true">
            <span className={styles.gridRailTop} />
            <span className={styles.gridRailMiddle} />
            <span className={styles.gridRailBottom} />
            <span className={styles.gridRailLeft} />
            <span className={styles.gridRailCenter} />
            <span className={styles.gridRailRight} />
            {[0, 25, 50, 75, 100].map((position) => (
              <i
                className={styles.gridNode}
                key={`top-${position}`}
                style={{ left: `${position}%`, top: 0 }}
              />
            ))}
            {[0, 25, 50, 75, 100].map((position) => (
              <i
                className={styles.gridNode}
                key={`bottom-${position}`}
                style={{ left: `${position}%`, top: "100%" }}
              />
            ))}
            {[0, 25, 50, 75, 100].map((position) => (
              <i
                className={styles.gridNode}
                key={`middle-${position}`}
                style={{ left: `${position}%`, top: "50%" }}
              />
            ))}
          </div>
          <div className={styles.jupiterForeground} aria-hidden="true" />
          <div className={styles.middleGridLine} aria-hidden="true" />

          <div className={styles.heroPrompt} aria-hidden="true">LET&apos;S</div>

          <div className={styles.heroWord} aria-hidden="true">
            <span className={styles.heroWordTrack}>
              <b>DISCOVER</b>
              <b>DISCOVER</b>
            </span>
          </div>

          <aside className={styles.editorialPanel} aria-label="Tutoria introduction">
            <div className={styles.editorialPanelHeader}>
              <span>TUTORIA</span>
            </div>
            <p className={styles.editorialPanelStatement}>
              Be curious.<br />
              <em>Learn beyond limits</em>
            </p>
            <p className={styles.editorialPanelBody}>
              Knowledge shaped by people, practice, and shared experience. Discover
              mentors, ideas, and communities that turn curiosity into something you
              can carry forward.
            </p>
          </aside>

          <div className={styles.cardFocusVeil} aria-hidden="true" />

          <div className={styles.recommendationMosaic} aria-label="Recommendations chosen for you">
            {forYouItems.map((item) => (
              <Link className={styles.recommendationCard} href={item.href} key={item.title}>
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 720px) 50vw, 22vw"
                  unoptimized={item.image.startsWith("http")}
                />
                <span className={styles.recommendationCardShade} aria-hidden="true" />
                <span className={styles.recommendationCardCopy}>
                  <small>{item.typeLabel} · {item.topic}</small>
                  <strong>{item.title}</strong>
                  <span>{item.author}</span>
                  <span className={styles.recommendationCardMeta}>
                    {item.meta}{item.rating !== undefined ? ` · ${item.rating} rating` : ""}
                    <span><IconArrowUpRight size={13} aria-hidden="true" /></span>
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <CuratedTransitionBar />

        </div>
    </section>
  );
}

function CuratedTransitionBar() {
  return (
    <Link className={styles.recommendationFooterLabel} href="/discover/for-you">
      <span>See what we curated for you</span>
      <span className={styles.recommendationFooterArrow} aria-hidden="true">
        <IconArrowRight size={20} />
      </span>
    </Link>
  );
}
