import Image from "next/image";
import Link from "next/link";
import { IconArrowRight, IconArrowUpRight } from "@tabler/icons-react";

import { forYouItems } from "./for-you-data";
import styles from "./recommendation-collage.module.css";

export function RecommendationCollage() {
  return (
    <section className={styles.recommendationScene} aria-labelledby="recommended-heading">
        <div className={styles.recommendationSticky}>
          <div className={styles.recommendationAmbient} aria-hidden="true" />

          <header className={styles.recommendationHeadline}>
            <h2 id="recommended-heading">
              <span>Start with something</span>
              <span>that <em>pulls you in.</em></span>
            </h2>
            <Link href="/discover/for-you" className={styles.recommendationHeaderLink}>
              All recommendations <IconArrowRight size={16} aria-hidden="true" />
            </Link>
          </header>

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

          <Link className={`${styles.recommendationFooterLabel} tutoria-text-link`} href="/discover/for-you">
            Recommended for you <IconArrowRight size={16} aria-hidden="true" />
          </Link>

          <div className={styles.recommendationScrollCue} aria-hidden="true">
            <span /> Scroll to explore
          </div>
        </div>
    </section>
  );
}
