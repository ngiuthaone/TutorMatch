"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBook2,
  IconBookmark,
  IconCertificate,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDeviceLaptop,
  IconLanguage,
  IconPlayerPlay,
  IconSearch,
  IconShare,
  IconStarFilled,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import type { CourseDetail, CourseListing } from "@/lib/course-data";
import { CourseEnrollButton, CoursePricingBadge } from "./course-enroll-button";
import styles from "./course-detail-page.module.css";

interface CourseDetailPageProps {
  course: CourseDetail;
  similarCourses: CourseListing[];
}

type ModalName = "preview" | "enroll" | null;

export function CourseDetailPage({ course, similarCourses }: CourseDetailPageProps) {
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");
  const [openModal, setOpenModal] = useState<ModalName>(null);
  const [openModules, setOpenModules] = useState(() => new Set([0]));
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(() => new Set());
  const [email, setEmail] = useState("");
  const [isEnrolled, setIsEnrolled] = useState(false);

  const lessonsTotal = course.curriculum.reduce((total, section) => total + section.lessons.length, 0) || course.lessons;
  const enrollLabel = course.price === "Free" ? "Start course" : "Enroll now";
  const allModulesOpen = openModules.size === course.curriculum.length;

  const priceVnd = course.price === "Free" ? 0 : parseInt(course.price.replace(/[^\d]/g, ""), 10) || null;

  useEffect(() => {
    const enrollmentKey = `tutoria_enrollment_${course.slug}`;
    const stored = localStorage.getItem(enrollmentKey);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsEnrolled(true);
    }
  }, [course.slug]);

  const categoryTrail = useMemo(() => {
    const normalized = course.category.toLowerCase();
    if (normalized.includes("language") || normalized.includes("academic")) return "IELTS preparation";
    if (normalized.includes("technology")) return "Development";
    if (normalized.includes("creative")) return "Creative practice";
    return `${course.category} skills`;
  }, [course.category]);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(window.courseToastTimeout);
    window.courseToastTimeout = window.setTimeout(() => setToast(""), 2200);
  };

  const handleShare = async () => {
    const data = { title: course.title, text: `${course.title} on Tutoria`, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Course link copied");
    } catch {
      showToast("Ready to share");
    }
  };

  const toggleSaved = () => {
    setSaved((current) => {
      showToast(current ? "Removed from your list" : "Saved to your learning list");
      return !current;
    });
  };

  const toggleModule = (index: number) => {
    setOpenModules((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllModules = () => {
    setOpenModules(allModulesOpen ? new Set() : new Set(course.curriculum.map((_, index) => index)));
  };

  const toggleFaq = (index: number) => {
    setOpenFaqs((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const continueCheckout = () => {
    if (course.price !== "Free" && !/^\S+@\S+\.\S+$/.test(email)) {
      showToast("Enter a valid email to continue");
      return;
    }
    setOpenModal(null);
    showToast(course.price === "Free" ? "Your first lesson is ready" : "Checkout demo complete");
  };

  const handleEnrolled = () => {
    setIsEnrolled(true);
  };

  return (
    <div className={styles.page}>
      <main>
        <section className={styles.hero}>
          <Image
            src={course.image}
            alt={`Cover for ${course.title}`}
            fill
            priority
            unoptimized
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay} aria-hidden="true" />
          <div className={styles.heroGradient} aria-hidden="true" />
          <div className={styles.heroBottomFade} aria-hidden="true" />

          <div className={styles.container}>
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
              <Link href="/courses"><IconArrowLeft size={15} /> Courses</Link>
              <span>/</span>
              <Link href={`/courses?category=${encodeURIComponent(course.category)}`}>{course.category}</Link>
              <span>/</span>
              <span>{categoryTrail}</span>
            </nav>

            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <div className={styles.badges}>
                  <span className={styles.popularBadge}>Popular</span>
                  <span>{course.level}</span>
                </div>
                <h1 className={styles.heroTitle}>{course.title}</h1>
                <p className={styles.heroSubtitle}>{course.subtitle}</p>
                <div className={styles.ratingRow}>
                  <strong>{course.rating.toFixed(1)}</strong>
                  <span aria-label={`${course.rating} out of 5 stars`}>★★★★★</span>
                  <button type="button" onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}>
                    {course.reviewCount} ratings
                  </button>
                  <span>{course.students.toLocaleString("en-US")} learners</span>
                </div>
                <p className={styles.creatorLine}>Created by <a href="#instructor">{course.instructor}</a></p>
                <div className={styles.metaLine}>
                  <span><IconClock size={16} /> Updated {course.updated}</span>
                  <span><IconLanguage size={16} /> {course.language}</span>
                  {course.certificate && <span><IconCheck size={16} /> Certificate included</span>}
                </div>
              </div>

              <button type="button" className={styles.previewTile} onClick={() => setOpenModal("preview")} aria-label={`Preview ${course.title}`}>
                <span className={styles.previewShade} />
                <span className={styles.previewLabel}>Course preview</span>
                <span className={styles.previewPlay}><IconPlayerPlay size={24} fill="currentColor" /></span>
                <span className={styles.previewCaption}>Watch a free lesson</span>
              </button>
            </div>
          </div>
        </section>

        <div className={`${styles.container} ${styles.bodyGrid}`}>
          <div className={styles.contentColumn}>
            <section id="description" className={styles.section}>
              <h2 className={styles.sectionTitle}>About this course</h2>
              {course.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>

            <section id="overview" className={`${styles.section} ${styles.learnBox}`}>
              <h2 className={styles.sectionTitle}>What you&apos;ll learn</h2>
              <div className={styles.outcomes}>
                {course.outcomes.map((outcome) => (
                  <div key={outcome}><IconCheck size={17} /><span>{outcome}</span></div>
                ))}
              </div>
            </section>

            <section id="curriculum" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Course content</h2>
                  <p>{course.curriculum.length} modules - {lessonsTotal} lessons - {course.duration} total</p>
                </div>
                <button type="button" onClick={toggleAllModules}>{allModulesOpen ? "Collapse all" : "Expand all"}</button>
              </div>

              <div className={styles.modules}>
                {course.curriculum.map((section, index) => {
                  const isOpen = openModules.has(index);
                  return (
                    <article className={`${styles.module} ${isOpen ? styles.moduleOpen : ""}`} key={section.title}>
                      <button type="button" className={styles.moduleToggle} onClick={() => toggleModule(index)} aria-expanded={isOpen}>
                        <IconChevronDown size={18} className={styles.chevron} />
                        <span>
                          <strong>{index + 1}. {section.title}</strong>
                          <small>{section.lessons.length} lessons - {section.duration}</small>
                        </span>
                      </button>
                      {isOpen && (
                        <div className={styles.lessonPanel}>
                          {section.lessons.map((lesson, lessonIndex) => (
                            <div className={styles.lessonRow} key={lesson}>
                              <span><IconPlayerPlay size={13} fill="currentColor" /></span>
                              <span>{lesson}</span>
                              {index === 0 && lessonIndex === 0 && <button type="button" onClick={() => setOpenModal("preview")}>Preview</button>}
                              <small>{String(lessonIndex + 8).padStart(2, "0")}:12</small>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Requirements</h2>
              <ul className={styles.requirements}>
                {course.requirements.map((requirement) => <li key={requirement}><IconCheck size={16} />{requirement}</li>)}
              </ul>
            </section>

            <section id="instructor" className={styles.section}>
              <h2 className={styles.sectionTitle}>Instructor</h2>
              <div className={styles.instructor}>
                <Image src={course.instructorImage} alt={course.instructor} width={112} height={112} unoptimized />
                <div>
                  <h3 className={styles.instructorName}>{course.instructor}</h3>
                  <p>{course.instructorRole}</p>
                  <div>
                    <span><IconStarFilled size={14} fill="currentColor" /> {course.rating} instructor rating</span>
                    <span><IconUsers size={14} /> {course.students.toLocaleString("en-US")} learners</span>
                  </div>
                </div>
              </div>
              <p>{course.instructorBio}</p>
            </section>

            <section id="reviews" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Learner reviews</h2>
                  <p><IconStarFilled size={14} fill="currentColor" /> {course.rating} from {course.reviewCount} reviews</p>
                </div>
              </div>
              <div className={styles.reviewGrid}>
                {course.reviews.map((review) => (
                  <article key={review.name}>
                    <div className={styles.reviewer}>
                      <Image src={review.avatar} alt="" width={44} height={44} unoptimized />
                      <span><strong>{review.name}</strong><small>{review.date}</small></span>
                    </div>
                    <div className={styles.stars}>{Array.from({ length: review.rating }).map((_, index) => <IconStarFilled size={14} fill="currentColor" key={index} />)}</div>
                    <p>{review.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
              <div className={styles.faqList}>
                {course.faqs.map((faq, index) => {
                  const isOpen = openFaqs.has(index);
                  return (
                    <div className={`${styles.faq} ${isOpen ? styles.faqOpen : ""}`} key={faq.question}>
                      <button type="button" onClick={() => toggleFaq(index)} aria-expanded={isOpen}>
                        <span>{faq.question}</span>
                        <IconChevronDown size={18} />
                      </button>
                      {isOpen && <p>{faq.answer}</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            {similarCourses.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>More courses</h2>
                    <p>Continue exploring similar learning paths.</p>
                  </div>
                  <Link href="/courses">See more</Link>
                </div>
                <div className={styles.similarGrid}>
                  {similarCourses.map((item) => (
                    <Link href={`/courses/${item.slug}`} key={item.slug}>
                      <Image src={item.image} alt="" width={96} height={72} unoptimized />
                      <span className={styles.similarCopy}><strong>{item.title}</strong><small>{item.instructor} - {item.price}</small></span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className={styles.sidebar} aria-label="Course enrollment">
            <div className={styles.purchaseCard}>
              <CoursePricingBadge priceVnd={priceVnd} priceDisplay={course.price} />
              <p>Full lifetime access</p>
              <CourseEnrollButton
                slug={course.slug}
                courseId={course.slug}
                priceVnd={priceVnd}
                priceDisplay={course.price}
                isEnrolled={isEnrolled}
              />
              <button type="button" className={styles.tryButton} onClick={() => setOpenModal("preview")}><IconPlayerPlay size={16} fill="currentColor" /> Try a free lesson</button>
              <p className={styles.guarantee}>30-day satisfaction guarantee</p>
              <div className={styles.includes}>
                <h2 className={styles.includesTitle}>This course includes</h2>
                <ul>
                  <li><IconClock size={16} /> {course.duration} on-demand video</li>
                  <li><IconBook2 size={16} /> {lessonsTotal} guided lessons</li>
                  <li><IconDeviceLaptop size={16} /> Mobile and desktop</li>
                  {course.certificate && <li><IconCertificate size={16} /> Certificate of completion</li>}
                </ul>
              </div>
              <div className={styles.cardActions}>
                <button type="button" onClick={handleShare}><IconShare size={15} /> Share</button>
                <button type="button" onClick={toggleSaved} aria-pressed={saved}><IconBookmark size={15} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}</button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className={styles.mobileEnrollBar}>
        <div><strong>{course.price}</strong><span>Lifetime access - 30-day guarantee</span></div>
        <button type="button" onClick={() => setOpenModal("enroll")}>{enrollLabel}</button>
      </div>

      {openModal === "preview" && (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="preview-title" onClick={() => setOpenModal(null)}>
          <div className={styles.previewModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div><p>Course preview</p><h2 id="preview-title" className={styles.modalTitle}>A better way to build your answer</h2></div>
              <button type="button" onClick={() => setOpenModal(null)} aria-label="Close"><IconX size={20} /></button>
            </div>
            <div className={styles.previewArt}>
              <div>
                <span><IconPlayerPlay size={34} fill="currentColor" /></span>
                <p>Preview: {course.curriculum[0]?.lessons[0] || course.title}</p>
                <small>2:34 sample lesson</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {openModal === "enroll" && (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="enroll-title" onClick={() => setOpenModal(null)}>
          <div className={styles.enrollModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalTop}>
              <div><p>You&apos;re almost there</p><h2 id="enroll-title" className={styles.modalTitle}>Start learning today.</h2></div>
              <button type="button" onClick={() => setOpenModal(null)} aria-label="Close"><IconX size={20} /></button>
            </div>
            <div className={styles.checkoutSummary}>
              <span>{course.title}</span>
              <strong>{course.price}</strong>
            </div>
            {course.price !== "Free" && (
              <>
                <label htmlFor="course-email">Email address</label>
                <div className={styles.emailInput}>
                  <IconSearch size={16} />
                  <input id="course-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </div>
              </>
            )}
            <button type="button" className={styles.enrollButton} onClick={continueCheckout}>Continue</button>
            <p className={styles.demoNote}>Demo checkout. No payment will be collected.</p>
          </div>
        </div>
      )}

      <div className={`${styles.toast} ${toast ? styles.toastVisible : ""}`} role="status" aria-live="polite">{toast || "Saved to your list"}</div>
    </div>
  );
}

declare global {
  interface Window {
    courseToastTimeout?: number;
  }
}
