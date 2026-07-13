import Link from "next/link";
import {
  IconArrowUpRight,
  IconBrush,
  IconCode,
  IconLanguage,
  IconMicrophone2,
  IconPlant2,
  IconToolsKitchen2,
} from "@tabler/icons-react";

import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import styles from "./skills.module.css";

const fields = [
  { name: "Technology", count: "148 paths", note: "Build, code, ship", icon: IconCode, href: "/discover/for-you?topic=Technology" },
  { name: "Languages", count: "92 paths", note: "Speak, listen, belong", icon: IconLanguage, href: "/discover/for-you?topic=Languages" },
  { name: "Creative practice", count: "76 paths", note: "Make what you imagine", icon: IconBrush, href: "/discover/for-you?topic=Creative+arts" },
  { name: "Communication", count: "54 paths", note: "Find a confident voice", icon: IconMicrophone2, href: "/discover/for-you?topic=Personal+development" },
  { name: "Food & craft", count: "39 paths", note: "Learn through your hands", icon: IconToolsKitchen2, href: "/courses?topic=Creative+arts" },
  { name: "Personal growth", count: "68 paths", note: "Move with intention", icon: IconPlant2, href: "/discover/for-you?topic=Personal+development" },
];

export default function SkillsPage() {
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <main className={styles.main}>
        <section className={`${styles.hero} tutoria-page-container`}>
          <div>
            <p className="tutoria-kicker">Explore by curiosity</p>
            <h1>Every skill is a new way to see the world.</h1>
          </div>
          <p>Begin with a subject, then meet the people, courses, workshops, and communities already gathered around it.</p>
        </section>

        <section className={`${styles.fields} tutoria-page-container`} aria-label="Skill fields">
          {fields.map((field, index) => (
            <Link href={field.href} key={field.name}>
              <span className={styles.index}>0{index + 1}</span>
              <field.icon size={24} stroke={1.4} aria-hidden="true" />
              <span className={styles.copy}>
                <strong>{field.name}</strong>
                <small>{field.note}</small>
              </span>
              <span className={styles.count}>{field.count}</span>
              <IconArrowUpRight className={styles.arrow} size={20} aria-hidden="true" />
            </Link>
          ))}
        </section>

        <section className={`${styles.prompt} tutoria-page-container`}>
          <p className="tutoria-kicker">Not sure where to begin?</p>
          <h2>Tell Tutoria what you want to become better at.</h2>
          <form action="/search" role="search">
            <label className="sr-only" htmlFor="skills-search">Search skills</label>
            <input id="skills-search" name="q" placeholder="Try “photography,” “IELTS,” or “starting a business”" />
            <button type="submit">Find my path <IconArrowUpRight size={17} /></button>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
}
