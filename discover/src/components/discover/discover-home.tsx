import Image from "next/image";
import Link from "next/link";
import {
  IconArticle,
  IconArrowRight,
  IconArrowUpRight,
  IconBook2,
  IconBookUpload,
  IconCalendarEvent,
  IconChalkboardTeacher,
  IconClock,
  IconMapPin,
  IconStarFilled,
} from "@tabler/icons-react";

import { ConversationTimeline } from "./conversation-timeline";
import { EventGatherings } from "./event-gatherings";
import { RecommendationCollage } from "./recommendation-collage";
import { TutorFeatureGrid } from "./tutor-feature-grid";
import { CourseJourneyMotion } from "./course-journey-motion";
import { GlassCard } from "../glass-card";
import styles from "./discover-home.module.css";

const people = [
  { name: "Minh Anh", role: "Public speaking coach", image: "https://i.pravatar.cc/150?u=minh-anh", color: "from-orange-500 to-rose-400", availability: "Available", tagline: "Helped 200+ learners speak with confidence", tags: ["Public Speaking", "Communication", "Leadership"], rating: 4.9, studentsCount: 1200, location: "Online", district: "Cầu Giấy", hourlyRate: 250000, currency: "VND" },
  { name: "Huy Tran", role: "Full-stack mentor", image: "https://i.pravatar.cc/150?u=huy-tran", color: "from-sky-600 to-indigo-400", availability: "Available", tagline: "500+ devs launched careers with his mentorship", tags: ["React", "TypeScript", "Node.js"], rating: 4.9, studentsCount: 500, location: "Online", district: "Seoul", hourlyRate: 200000, currency: "VND" },
  { name: "Linh Nguyen", role: "IELTS coach", image: "https://i.pravatar.cc/150?u=linh-nguyen", color: "from-emerald-600 to-teal-400", availability: "Available", tagline: "Helped 300+ learners achieve band 7+", tags: ["IELTS", "Speaking", "Writing"], rating: 4.8, studentsCount: 300, location: "Online", district: "Ha Noi", hourlyRate: 180000, currency: "VND" },
  { name: "Duc Pham", role: "Photography artist", image: "https://i.pravatar.cc/150?u=duc-pham", color: "from-amber-500 to-orange-400", availability: "Available", tagline: "Film and digital, 8 years behind the lens", tags: ["Composition", "Lighting", "Editing"], rating: 4.7, studentsCount: 180, location: "Online", district: "Da Nang", hourlyRate: 200000, currency: "VND" },
  { name: "Thu Ha", role: "Culinary teacher", image: "https://i.pravatar.cc/150?u=thu-ha", color: "from-rose-500 to-pink-400", availability: "Available", tagline: "Vietnamese home cooking, from pho to family feasts", tags: ["Vietnamese", "Baking", "Meal Prep"], rating: 4.9, studentsCount: 250, location: "Online", district: "Hai Phong", hourlyRate: 150000, currency: "VND" },
  { name: "Bao Long", role: "Business mentor", image: "https://i.pravatar.cc/150?u=bao-long", color: "from-violet-600 to-purple-400", availability: "Available", tagline: "Helping founders validate, build, and scale", tags: ["Strategy", "Fundraising", "Growth"], rating: 4.8, studentsCount: 90, location: "Online", district: "HCMC", hourlyRate: 300000, currency: "VND" },
];

const courses = [
  { title: "Complete web development bootcamp", tutor: "Huy Tran", duration: "16 hours", lessons: 48, rating: "4.8", image: "https://picsum.photos/seed/tutoria-web-course/680/430" },
  { title: "IELTS speaking masterclass", tutor: "Linh Nguyen", duration: "8 hours", lessons: 24, rating: "4.9", image: "https://picsum.photos/seed/tutoria-ielts-course/680/430" },
  { title: "Digital photography fundamentals", tutor: "Duc Pham", duration: "12 hours", lessons: 32, rating: "4.8", image: "https://picsum.photos/seed/tutoria-photo-course/680/430" },
  { title: "Public speaking for professionals", tutor: "Minh Anh", duration: "6 hours", lessons: 16, rating: "4.7", image: "https://picsum.photos/seed/tutoria-speaking-course/680/430" },
];

const creatorPaths = [
  {
    title: "Publish a course",
    description: "Shape what you know into a clear learning path people can follow at their own pace.",
    href: "/courses/new",
    icon: IconBookUpload,
  },
  {
    title: "Host an event or workshop",
    description: "Run a live talk, gathering, or hands-on session built around practice and participation.",
    href: "/events/new",
    icon: IconCalendarEvent,
  },
  {
    title: "Become a tutor",
    description: "Offer one-to-one or small-group sessions and help learners make steady progress.",
    href: "/become-a-tutor",
    icon: IconChalkboardTeacher,
  },
  {
    title: "Publish an article or tutorial",
    description: "Turn a useful idea, field note, or process into something the community can return to.",
    href: "/articles/new",
    icon: IconArticle,
  },
];

export function DiscoverHome() {
  return (
    <main className={styles.page}>
      <RecommendationCollage />

      <div className={styles.backgroundSections}>
      <section className={`${styles.section} ${styles.peopleSection}`} aria-label="Tutors and mentors">
        <TutorFeatureGrid />
        <div className="tutoria-page-container">
          <div className={styles.peopleIntroSpace} aria-hidden="true" />

          <div className={styles.peopleMarquee}>
            <div className={styles.peopleMarqueeStage}>
              <div className={styles.peopleMarqueeRows}>
                {[people.slice(0, 3), people.slice(3)].map((row, rowIndex) => (
                  <div className={styles.peopleMarqueeRow} key={`row-${rowIndex}`}>
                    <div className={styles.peopleMarqueeTrack}>
                      {[0, 1, 2, 3].map((duplicateIndex) => (
                        <div className={styles.peopleMarqueeSet} key={`set-${duplicateIndex}`} aria-hidden={duplicateIndex > 0 || undefined}>
                          {row.map((person) => {
                            const full = Math.floor(person.rating);
                            return (
                              <Link
                                href={`/profile/${encodeURIComponent(person.name)}`}
                                className={styles.personCard}
                                key={person.name}
                                tabIndex={duplicateIndex > 0 ? -1 : undefined}
                              >
                                <div className={`${styles.personCardHeader} ${person.color}`}>
                                  <div className={styles.personCardHeaderShade} />
                                  <span className={styles.personCardPortrait}>
                                    <Image src={person.image} alt={person.name} fill sizes="72px" unoptimized />
                                  </span>
                                  <span className={styles.personCardTop}>
                                    <strong className={styles.personCardName}>{person.name}</strong>
                                    <small className={styles.personCardRole}>{person.role.toUpperCase()}</small>
                                  </span>
                                </div>
                                <div className={styles.personCardBody}>
                                  <span className={styles.personCardAvail}>
                                    <span className={styles.availDot} />
                                    {person.availability}
                                  </span>
                                  <p className={styles.personCardTagline}>{person.tagline}</p>
                                  <div className={styles.personCardTags}>
                                    {person.tags.map((tag, i) => (
                                      <span key={tag}>
                                        {tag}
                                        {i < person.tags.length - 1 && <span className={styles.tagSep}>·</span>}
                                      </span>
                                    ))}
                                  </div>
                                  <div className={styles.personCardRating}>
                                    <span className={styles.stars}>{"★".repeat(full)}</span>
                                    <span>{person.rating}</span>
                                    <span className={styles.ratingSep}>·</span>
                                    <span>{person.studentsCount.toLocaleString("en-US")} learners</span>
                                  </div>
                                  <div className={styles.personCardLocation}>
                                    <IconMapPin size={12} aria-hidden="true" />
                                    {person.location}
                                    {person.district && <>, {person.district}</>}
                                  </div>
                                </div>
                                <div className={styles.personCardFooter}>
                                  <span className={styles.personCardPrice}>{person.hourlyRate.toLocaleString("vi-VN")}đ</span>
                                  <span className={styles.personCardUnit}>/ session</span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.peopleSectionAction}>
            <Link className={`${styles.sectionLink} tutoria-text-link`} href="/people">
              See people <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.coursesSection}`} aria-labelledby="courses-heading">
        <CourseJourneyMotion
          className={styles.courseMotionRoot}
          stageClassName={styles.courseStage}
        >
          <header className={`${styles.sectionHeader} tutoria-page-container`}>
            <div className={styles.courseHeaderCopy}>
              <h2 id="courses-heading">Browse course</h2>
            </div>
            <span className={styles.courseBrowseReveal}>
              <Link className={`${styles.sectionLink} tutoria-text-link`} href="/courses">View all course <IconArrowRight size={16} /></Link>
            </span>
          </header>

          <div className={`${styles.courseList} tutoria-page-container`} data-course-track>
            {courses.map((course, index) => (
              <Link href="/courses" className={styles.course} key={course.title}>
                <GlassCard className={styles.courseGlass}>
                  <span className={styles.courseInner}>
                    <span className={styles.courseIndex}>0{index + 1}</span>
                    <span className={styles.courseImage}>
                      <Image
                        src={course.image}
                        alt=""
                        fill
                        sizes="(max-width: 900px) calc(100vw - 3rem), (max-width: 1440px) 32vw, 496px"
                        unoptimized
                      />
                    </span>
                    <span className={styles.courseCopy}>
                      <small>Course by {course.tutor}</small>
                      <strong>{course.title}</strong>
                      <span className={styles.courseFacts}>
                        <span><IconClock size={15} /> {course.duration}</span>
                        <span><IconBook2 size={15} /> {course.lessons} lessons</span>
                        <span><IconStarFilled size={14} /> {course.rating}</span>
                      </span>
                    </span>
                    <IconArrowUpRight className={styles.courseArrow} size={20} aria-hidden="true" />
                  </span>
                </GlassCard>
              </Link>
            ))}
          </div>
        </CourseJourneyMotion>
      </section>

      <EventGatherings />

      <ConversationTimeline />

      <section className={styles.creatorSection} aria-labelledby="creator-heading">
        <div className={styles.creatorFrame}>
          <div className={styles.creatorReferenceGrid} aria-hidden="true">
            <span className={styles.creatorRailTop} />
            <span className={styles.creatorRailMiddle} />
            <span className={styles.creatorRailBottom} />
            <span className={styles.creatorRailQuarter} />
            <span className={styles.creatorRailCenter} />
            <span className={styles.creatorRailThreeQuarter} />
            {[0, 25, 50, 75, 100].flatMap((left) =>
              [0, 62, 100].map((top) => (
                <i
                  className={styles.creatorGridNode}
                  key={`${left}-${top}`}
                  style={{ left: `${left}%`, top: top === 62 ? "466px" : `${top}%` }}
                />
              )),
            )}
          </div>

          <header className={styles.creatorHeader}>
            <p className={styles.creatorIndex}>Tutoria</p>
            <h2 id="creator-heading" className={styles.creatorHeading}>
              <span className={styles.creatorFixed}>Become a</span>
              <span className={styles.creatorWordViewport} aria-hidden="true">
                <span className={styles.creatorWordTrack}>
                  <b>creator</b>
                </span>
              </span>
              <span className={styles.visuallyHidden}>creator</span>
            </h2>
            <div className={styles.creatorNote}>
              <p>Someone is looking for the thing you already know.</p>
              <span>Choose how to share what you know.</span>
            </div>
          </header>

          <div className={styles.creatorCards}>
            {creatorPaths.map((path) => {
              const PathIcon = path.icon;
              return (
                <Link className={styles.creatorCard} href={path.href} key={path.title}>
                  <span className={styles.creatorCardMeta}>
                    <PathIcon size={22} stroke={1.45} aria-hidden="true" />
                  </span>
                  <span className={styles.creatorCardCopy}>
                    <strong>{path.title}</strong>
                    <span>{path.description}</span>
                  </span>
                  <span className={styles.creatorCardAction}>
                    Start sharing <IconArrowUpRight size={17} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
