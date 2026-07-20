"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBook2,
  IconBookmark,
  IconCertificate,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconDeviceLaptop,
  IconLanguage,
  IconPlayerPlay,
  IconShare,
  IconShieldCheck,
  IconStarFilled,
  IconUsers,
} from "@tabler/icons-react";
import type { CourseDetail, CourseListing } from "@/lib/course-data";
import styles from "./course-detail-page.module.css";

interface CourseDetailPageProps {
  course: CourseDetail;
  similarCourses: CourseListing[];
}

export function CourseDetailPage({ course, similarCourses }: CourseDetailPageProps) {
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const enrollLabel = course.price === "Free" ? "Start course" : "Enroll now";

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: course.title, text: course.subtitle, url: window.location.href });
        setStatus("Share options opened.");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setStatus("Course link copied.");
      }
    } catch {
      setStatus("The course link is ready in your address bar.");
    }
  };

  const handleEnroll = () => {
    setStatus(course.price === "Free" ? "Course added. Your first lesson is ready." : "Enrollment checkout opened.");
  };

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <div className={styles.topLine}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/courses"><IconArrowLeft size={16} /> Courses</Link>
            <IconChevronRight size={14} aria-hidden="true" />
            <span>{course.category}</span>
            <IconChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{course.title}</span>
          </nav>
          <div className={styles.topActions}>
            <button type="button" onClick={handleShare}><IconShare size={17} /> Share</button>
            <button type="button" className={saved ? styles.savedAction : undefined} onClick={() => { setSaved((current) => !current); setStatus(saved ? "Removed from saved courses." : "Saved to your courses."); }}>
              <IconBookmark size={17} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <div className={styles.contentColumn}>
            <section className={styles.hero} aria-labelledby="course-title">
              <Image src={course.image} alt={`Cover for ${course.title}`} fill priority unoptimized sizes="(max-width: 980px) 100vw, 900px" />
              <div className={styles.heroScrim} />
              <div className={styles.heroContent}>
                <p>{course.category} / {course.level}</p>
                <h1 id="course-title">{course.title}</h1>
                <span>{course.subtitle}</span>
                <div className={styles.heroMeta}>
                  <span><IconStarFilled size={15} /> {course.rating} ({course.reviewCount} reviews)</span>
                  <span><IconUsers size={15} /> {course.students.toLocaleString("en-US")} learners</span>
                  <span>Created by {course.instructor}</span>
                </div>
              </div>
              <button type="button" className={styles.previewButton} onClick={() => { document.getElementById("curriculum")?.scrollIntoView({ behavior: "smooth" }); setStatus("Course curriculum opened below."); }}>
                <IconPlayerPlay size={17} /> Preview course
              </button>
            </section>

            <section className={styles.factStrip} aria-label="Course details">
              <div><IconClock size={21} /><span><strong>{course.duration}</strong><small>Self-paced video</small></span></div>
              <div><IconBook2 size={21} /><span><strong>{course.lessons} lessons</strong><small>Across {course.curriculum.length} modules</small></span></div>
              <div><IconLanguage size={21} /><span><strong>Language</strong><small>{course.language}</small></span></div>
              <div><IconCertificate size={21} /><span><strong>{course.certificate ? "Certificate included" : "No certificate"}</strong><small>Share your achievement</small></span></div>
            </section>

            <section className={styles.contentSection}>
              <h2>What you will learn</h2>
              <div className={styles.outcomes}>
                {course.outcomes.map((outcome) => <div key={outcome}><IconCheck size={17} />{outcome}</div>)}
              </div>
            </section>

            <section className={styles.contentSection}>
              <h2>About this course</h2>
              {course.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>

            <section id="curriculum" className={styles.contentSection}>
              <div className={styles.sectionHeading}>
                <div><h2>Course curriculum</h2><p>{course.curriculum.length} modules, {course.lessons} lessons, {course.duration} total</p></div>
                <span>Updated {course.updated}</span>
              </div>
              <div className={styles.curriculum}>
                {course.curriculum.map((section, index) => (
                  <details key={section.title} open={index === 0}>
                    <summary>
                      <span><strong>{section.title}</strong><small>{section.lessons.length} lessons / {section.duration}</small></span>
                      <IconChevronDown size={18} />
                    </summary>
                    <ol>
                      {section.lessons.map((lesson, lessonIndex) => (
                        <li key={lesson}><span>{String(lessonIndex + 1).padStart(2, "0")}</span><IconPlayerPlay size={15} />{lesson}</li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </section>

            <section className={`${styles.contentSection} ${styles.requirements}`}>
              <h2>Requirements</h2>
              <ul>{course.requirements.map((requirement) => <li key={requirement}><IconCheck size={16} />{requirement}</li>)}</ul>
            </section>

            <section className={`${styles.contentSection} ${styles.faqSection}`}>
              <h2>Frequently asked questions</h2>
              <p className={styles.faqIntro}>Helpful details before you start learning.</p>
              <div className={styles.faqList}>
                {course.faqs.map((faq, index) => {
                  const isOpen = openFaq === faq.question;
                  const answerId = `course-faq-${index}`;
                  return (
                  <div className={styles.faqItem} key={faq.question}>
                    <button
                      type="button"
                      className={`${styles.faqQuestion} ${isOpen ? styles.faqOpen : ""}`}
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      onClick={() => setOpenFaq(isOpen ? null : faq.question)}
                    >
                      <span>{faq.question}</span>
                      <IconChevronDown size={19} aria-hidden="true" />
                    </button>
                    {isOpen && <div id={answerId} className={styles.faqAnswer} role="region" aria-label={faq.question}><p>{faq.answer}</p></div>}
                  </div>
                  );
                })}
              </div>
            </section>

            <section className={`${styles.contentSection} ${styles.instructorSection}`}>
              <h2>Meet your instructor</h2>
              <div className={styles.instructorProfile}>
                <Image src={course.instructorImage} alt={course.instructor} width={96} height={96} unoptimized />
                <div><h3>{course.instructor}</h3><p>{course.instructorRole}</p><div><span><IconStarFilled size={14} /> {course.rating} instructor rating</span><span><IconUsers size={14} /> {course.students.toLocaleString("en-US")} learners</span></div></div>
              </div>
              <p>{course.instructorBio}</p>
              <button type="button" onClick={() => setStatus("Instructor profile opened.")}>View instructor</button>
            </section>

            <section className={`${styles.contentSection} ${styles.reviewsSection}`}>
              <div className={styles.sectionHeading}>
                <div><h2>Learner reviews</h2><p><IconStarFilled size={14} /> {course.rating} from {course.reviewCount} reviews</p></div>
                <button type="button" onClick={() => setStatus("All course reviews loaded.")}>See all reviews</button>
              </div>
              <div className={styles.reviewGrid}>
                {course.reviews.map((review) => (
                  <article key={review.name}>
                    <div className={styles.reviewer}><Image src={review.avatar} alt="" width={42} height={42} unoptimized /><span><strong>{review.name}</strong><small>{review.date}</small></span></div>
                    <div className={styles.stars} role="img" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: review.rating }).map((_, index) => <IconStarFilled size={14} key={index} />)}</div>
                    <p>{review.body}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className={styles.sidebar} aria-label="Course enrollment">
            <section className={`${styles.sidebarCard} ${styles.enrollCard}`}>
              <div className={styles.price}><strong>{course.price}</strong><span>Full lifetime access</span></div>
              <button type="button" className={styles.primaryButton} onClick={handleEnroll}>{enrollLabel}</button>
              <button type="button" className={styles.secondaryButton} onClick={() => setStatus("Course preview opened.")}><IconPlayerPlay size={16} /> Preview course</button>
              <p className={styles.protection}><IconShieldCheck size={16} /> 30-day satisfaction guarantee for paid courses.</p>
              <div className={styles.includes}>
                <h2>This course includes</h2>
                <ul>
                  <li><IconClock size={16} /> {course.duration} of on-demand lessons</li>
                  <li><IconBook2 size={16} /> {course.lessons} guided lessons</li>
                  <li><IconDeviceLaptop size={16} /> Access on mobile and desktop</li>
                  {course.certificate && <li><IconCertificate size={16} /> Certificate of completion</li>}
                </ul>
              </div>
            </section>

            <section className={`${styles.sidebarCard} ${styles.similarCard}`}>
              <div className={styles.similarHeading}><h2>You may also like</h2><Link href="/courses">See more</Link></div>
              <div className={styles.similarList}>
                {similarCourses.map((item) => (
                  <Link href={`/courses/${item.slug}`} key={item.slug}>
                    <Image src={item.image} alt="" width={78} height={78} unoptimized />
                    <span><strong>{item.title}</strong><small>{item.instructor}</small><small>{item.price}</small></span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>

      <div className={styles.mobileEnrollBar}>
        <div><strong>{course.price}</strong><span>Lifetime access</span></div>
        <button type="button" onClick={handleEnroll}>{enrollLabel}</button>
      </div>
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
    </div>
  );
}
