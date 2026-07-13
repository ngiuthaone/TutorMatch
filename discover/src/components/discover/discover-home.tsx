import Image from "next/image";
import Link from "next/link";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconBook2,
  IconClock,
  IconMapPin,
  IconMessageCircle,
  IconSearch,
  IconSparkles,
  IconStarFilled,
  IconUsers,
} from "@tabler/icons-react";

import styles from "./discover-home.module.css";

const paths = [
  { label: "People", href: "/people", note: "Tutors & collaborators" },
  { label: "Courses", href: "/courses", note: "Learn at your pace" },
  { label: "Events", href: "/events", note: "Practice in company" },
  { label: "Communities", href: "/communities", note: "Find your circle" },
];

const discoveries = [
  {
    eyebrow: "Field note · Photography",
    title: "Five mistakes beginners make behind the lens",
    description: "Duc Pham turns a decade of practice into an eight-minute field guide.",
    meta: "8 min read",
    href: "/discussions/blogs/b1",
    image: "https://picsum.photos/seed/tutoria-photo-field/1100/760",
    feature: true,
  },
  {
    eyebrow: "1:1 · Public speaking",
    title: "From nervous to natural",
    description: "A six-session path with Minh Anh.",
    meta: "Next opening · Tue",
    href: "/people?topic=Personal+development",
    image: "https://picsum.photos/seed/tutoria-speaking-room/760/620",
  },
  {
    eyebrow: "Community · Founders",
    title: "Build the idea with people who understand it",
    description: "1,200 makers exchanging feedback, introductions, and momentum.",
    meta: "34 conversations today",
    href: "/communities?topic=Business",
    image: "https://picsum.photos/seed/tutoria-founders-night/760/620",
  },
];

const people = [
  { name: "Minh Anh", role: "Public speaking coach", focus: "Confidence", image: "https://picsum.photos/seed/minh-anh-cosmos/340/420" },
  { name: "Huy Tran", role: "Full-stack mentor", focus: "Technology", image: "https://picsum.photos/seed/huy-tran-cosmos/340/420" },
  { name: "Linh Nguyen", role: "IELTS coach", focus: "Languages", image: "https://picsum.photos/seed/linh-nguyen-cosmos/340/420" },
  { name: "Duc Pham", role: "Photography artist", focus: "Creative practice", image: "https://picsum.photos/seed/duc-pham-cosmos/340/420" },
  { name: "Thu Ha", role: "Culinary teacher", focus: "Cooking", image: "https://picsum.photos/seed/thu-ha-cosmos/340/420" },
  { name: "Bao Long", role: "Business mentor", focus: "Entrepreneurship", image: "https://picsum.photos/seed/bao-long-cosmos/340/420" },
];

const courses = [
  { title: "Complete web development bootcamp", tutor: "Huy Tran", duration: "16 hours", lessons: 48, rating: "4.8", image: "https://picsum.photos/seed/tutoria-web-course/680/430" },
  { title: "IELTS speaking masterclass", tutor: "Linh Nguyen", duration: "8 hours", lessons: 24, rating: "4.9", image: "https://picsum.photos/seed/tutoria-ielts-course/680/430" },
  { title: "Digital photography fundamentals", tutor: "Duc Pham", duration: "12 hours", lessons: 32, rating: "4.8", image: "https://picsum.photos/seed/tutoria-photo-course/680/430" },
  { title: "Public speaking for professionals", tutor: "Minh Anh", duration: "6 hours", lessons: 16, rating: "4.7", image: "https://picsum.photos/seed/tutoria-speaking-course/680/430" },
];

const events = [
  { date: "19", month: "JUL", title: "Beginner pottery workshop", location: "Tay Ho, Ha Noi", time: "2:00 PM", host: "Hosted by Thu Ha", format: "Hands-on workshop", attendance: "12 of 16 seats" },
  { date: "22", month: "JUL", title: "IELTS speaking circle", location: "Online", time: "10:00 AM", host: "Hosted by Linh Nguyen", format: "Live practice room", attendance: "8 learners joined" },
  { date: "24", month: "JUL", title: "Startup networking night", location: "Hoan Kiem, Ha Noi", time: "6:30 PM", host: "Hosted by Bao Long", format: "Community meetup", attendance: "45 attending" },
];

const conversations = [
  {
    author: "Linh Nguyen",
    topic: "Languages",
    text: "The smallest daily practice that changed your learning rhythm?",
    excerpt: "A thread for tiny routines that actually survived busy weeks.",
    replies: 28,
    image: "https://picsum.photos/seed/linh-language-thread/96/96",
  },
  {
    author: "Duc Pham",
    topic: "Photography",
    text: "Film photography taught me to wait. What has slowed you down in a good way?",
    excerpt: "People are trading patient creative rituals, field notes, and beginner-friendly prompts.",
    replies: 22,
    image: "https://picsum.photos/seed/duc-photo-thread/96/96",
  },
  {
    author: "Huy Tran",
    topic: "Technology",
    text: "Share a project you shipped before you felt ready.",
    excerpt: "A generous wall of messy launches, first users, and lessons that arrived after publish.",
    replies: 36,
    image: "https://picsum.photos/seed/huy-tech-thread/96/96",
  },
  {
    author: "Thu Ha",
    topic: "Creative",
    text: "What did you learn from teaching someone your favorite skill?",
    excerpt: "Tutors and learners are comparing the moments where explaining made the idea click.",
    replies: 19,
    image: "https://picsum.photos/seed/thu-creative-thread/96/96",
  },
  {
    author: "Mai Le",
    topic: "Business",
    text: "Which customer question changed the product you were building?",
    excerpt: "Founders are sharing the feedback that quietly rewrote their roadmap.",
    replies: 31,
    image: "https://picsum.photos/seed/mai-business-thread/96/96",
  },
];

export function DiscoverHome() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="discover-heading">
        <div className={styles.heroStars} aria-hidden="true" />
        <Image
          className={styles.heroPlanet}
          src="/brand/tutoria-jupiter-cutout.png"
          alt=""
          width={930}
          height={930}
          priority
        />
        <div className={`${styles.heroInner} tutoria-page-container`}>
          <div className={styles.heroCopy}>
            <p className="tutoria-kicker">Your learning constellation</p>
            <h1 id="discover-heading">
              Follow your curiosity. <em>Find your people.</em>
            </h1>
            <p className={styles.heroLead}>
              Tutoria brings thoughtful teachers, practical courses, live workshops, and generous communities into one orbit.
            </p>

            <form className={styles.search} action="/search" role="search">
              <IconSearch aria-hidden="true" size={21} />
              <label className="sr-only" htmlFor="discover-query">Search Tutoria</label>
              <input id="discover-query" name="q" placeholder="What would you like to learn?" />
              <button type="submit" aria-label="Search">
                <IconArrowRight aria-hidden="true" size={19} />
              </button>
            </form>

            <div className={styles.heroMeta} aria-label="Tutoria activity">
              <span><strong>24k</strong> curious minds</span>
              <span><strong>680</strong> active sharers</span>
              <span><strong>42</strong> rooms live today</span>
            </div>
          </div>

          <div className={styles.orbitStage} aria-label="Ways to explore Tutoria">
            <div className={styles.orbitLine} aria-hidden="true" />
            <div className={`${styles.orbitCard} tutoria-glass`}>
              <div className={styles.orbitHeader}>
                <span><IconSparkles size={16} aria-hidden="true" /> Live orbit</span>
                <span className={styles.liveSignal}>Now</span>
              </div>
              <div className={styles.pathList}>
                {paths.map((path, index) => (
                  <Link href={path.href} key={path.label}>
                    <span className={styles.pathIndex}>0{index + 1}</span>
                    <span>
                      <strong>{path.label}</strong>
                      <small>{path.note}</small>
                    </span>
                    <IconArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="recommended-heading">
        <div className="tutoria-page-container">
          <header className={styles.sectionHeader}>
            <div>
              <p className="tutoria-kicker">Chosen for your orbit</p>
              <h2 id="recommended-heading">Start with something that <em>pulls you in.</em></h2>
            </div>
            <Link className="tutoria-text-link" href="/discover/for-you">All recommendations <IconArrowRight size={16} /></Link>
          </header>

          <div className={styles.discoveryGrid}>
            {discoveries.map((item) => (
              <Link className={item.feature ? styles.discoveryFeature : styles.discoveryCard} href={item.href} key={item.title}>
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes={item.feature ? "(max-width: 720px) 86vw, (max-width: 1000px) 100vw, 58vw" : "(max-width: 720px) 86vw, 32vw"}
                  unoptimized
                />
                <span className={styles.imageShade} aria-hidden="true" />
                <span className={styles.discoveryContent}>
                  <small>{item.eyebrow}</small>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                  <span className={styles.cardMeta}>{item.meta} <IconArrowUpRight size={17} /></span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.peopleSection}`} aria-labelledby="people-heading">
        <div className="tutoria-page-container">
          <header className={styles.sectionHeader}>
            <div>
              <p className="tutoria-kicker">Learn from people</p>
              <h2 id="people-heading">Knowledge feels different when it has a <em>human voice.</em></h2>
            </div>
            <Link className="tutoria-text-link" href="/people">Meet the community <IconArrowRight size={16} /></Link>
          </header>

          <div className={styles.peopleRail}>
            {people.map((person, index) => (
              <Link href={`/profile/${encodeURIComponent(person.name)}`} className={styles.person} key={person.name}>
                <span className={styles.personNumber}>0{index + 1}</span>
                <span className={styles.personPortrait}>
                  <Image src={person.image} alt={person.name} width={340} height={420} unoptimized />
                </span>
                <span className={styles.personCopy}>
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                  <span>{person.focus}</span>
                </span>
                <IconArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.coursesSection}`} aria-labelledby="courses-heading">
        <div className="tutoria-page-container">
          <header className={styles.sectionHeader}>
            <div>
              <p className="tutoria-kicker">Structured journeys</p>
              <h2 id="courses-heading">Go deep, one thoughtful lesson at a time.</h2>
            </div>
            <Link className="tutoria-text-link" href="/courses">Browse courses <IconArrowRight size={16} /></Link>
          </header>

          <div className={styles.courseList}>
            {courses.map((course, index) => (
              <Link href="/courses" className={styles.course} key={course.title}>
                <span className={styles.courseIndex}>0{index + 1}</span>
                <span className={styles.courseImage}><Image src={course.image} alt="" width={680} height={430} unoptimized /></span>
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
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.gatherSection}`} aria-labelledby="gather-heading">
        <div className={`${styles.gatherInner} tutoria-page-container`}>
          <div className={styles.gatherVisual}>
            <Image src="/brand/tutoria-community-sky.png" alt="A Tutoria community gathering under the stars" fill sizes="(max-width: 900px) 100vw, 48vw" />
            <span className={styles.imageShade} aria-hidden="true" />
            <div>
              <p className="tutoria-kicker">Learning happens together</p>
              <h2 id="gather-heading">Meet in the room where ideas become practice.</h2>
              <Link className="tutoria-text-link" href="/communities">Explore communities <IconArrowRight size={16} /></Link>
            </div>
          </div>

          <div className={`${styles.agenda} tutoria-glass`}>
            <div className={styles.agendaHeading}>
              <div>
                <small>This week on Tutoria</small>
                <strong>Gatherings worth showing up for</strong>
              </div>
              <Link href="/events" aria-label="View all events"><IconArrowUpRight size={20} /></Link>
            </div>
            <div className={styles.eventList}>
              {events.map((event) => (
                <Link href="/events" key={event.title}>
                  <span className={styles.dateBlock}><strong>{event.date}</strong><small>{event.month}</small></span>
                  <span className={styles.eventCopy}>
                    <strong>{event.title}</strong>
                    <span className={styles.eventLocation}><IconMapPin size={14} /> {event.location}</span>
                    <span className={styles.eventDetails}>
                      <span>{event.host}</span>
                      <span>{event.format}</span>
                      <span><IconUsers size={13} /> {event.attendance}</span>
                    </span>
                  </span>
                  <span className={styles.eventTime}>{event.time}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.conversationSection}`} aria-labelledby="conversations-heading">
        <div className="tutoria-page-container">
          <header className={styles.sectionHeader}>
            <div>
              <p className="tutoria-kicker">Open conversations</p>
              <h2 id="conversations-heading">A good question can change someone&apos;s direction.</h2>
            </div>
            <Link className="tutoria-text-link" href="/discussions">Enter discussions <IconArrowRight size={16} /></Link>
          </header>

          <div className={styles.conversationMarquee} aria-label="Featured discussion previews">
            <div className={styles.conversationTrack}>
              {[...conversations, ...conversations].map((conversation, index) => (
                <Link
                  href="/discussions"
                  className={styles.conversation}
                  key={`${conversation.text}-${index}`}
                  aria-label={`${conversation.topic} discussion: ${conversation.text}`}
                >
                  <span className={styles.conversationTop}>
                    <span className={styles.conversationTopic}>{conversation.topic}</span>
                    <IconArrowUpRight size={17} aria-hidden="true" />
                  </span>
                  <span className={styles.conversationAuthor}>
                    <Image src={conversation.image} alt="" width={48} height={48} unoptimized />
                    <span>
                      <strong>{conversation.author}</strong>
                      <small>Started the conversation</small>
                    </span>
                  </span>
                  <strong className={styles.conversationQuestion}>{conversation.text}</strong>
                  <span className={styles.conversationExcerpt}>{conversation.excerpt}</span>
                  <span className={styles.conversationMeta}>
                    <span><IconMessageCircle size={15} aria-hidden="true" /> {conversation.replies} replies</span>
                    <span>Join in</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`${styles.ctaInner} tutoria-page-container`}>
          <Image src="/brand/tutoria-human-cutout.png" alt="" width={520} height={620} />
          <div>
            <p className="tutoria-kicker">Your knowledge belongs here too</p>
            <h2>Someone is looking for the thing you already know.</h2>
            <p>Share a field note, host a workshop, teach a course, or open a room for the community.</p>
            <div className={styles.ctaActions}>
              <Link href="/auth/sign-up?intent=creator">Start sharing <IconArrowRight size={17} /></Link>
              <Link href="/articles/new">Write an article</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
