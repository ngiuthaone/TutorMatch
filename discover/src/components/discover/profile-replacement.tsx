"use client";

import { useState } from "react";
import {
  BadgeCheck, Camera, CalendarDays, Ellipsis, Heart, Image as ImageIcon,
  Link2, MapPin, Medal, MessageCircle, PanelsTopLeft, Repeat2, Send,
  Star, Trophy, UserRound, UsersRound,
} from "lucide-react";

const profiles: Record<string, {
  name: string; role: string; avatar: string; bio: string;
  location: string; website: string; cover: string; skills: string[];
  learners: number; rating: number; followers: number;
}> = {
  "Duc Pham": {
    name: "Duc Pham", role: "Photography Artist",
    avatar: "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=400&q=90",
    bio: "Commercial photographer and exhibition curator.\nTeaching photography for 5+ years.",
    location: "Tay Ho, Ha Noi", website: "ducpham.photo",
    cover: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1800&q=90",
    skills: ["Photography", "Lightroom", "Photoshop", "Composition"],
    learners: 1200, rating: 4.9, followers: 245,
  },
  "Linh Nguyen": {
    name: "Linh Nguyen", role: "English & IELTS Coach",
    avatar: "https://picsum.photos/seed/linh-avatar/200/200",
    bio: "Helping students achieve their IELTS goals.\n7+ years of teaching experience.",
    location: "Ha Noi", website: "linhnguyen.edu",
    cover: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=90",
    skills: ["IELTS", "English", "Public Speaking"],
    learners: 890, rating: 4.8, followers: 180,
  },
  "Thu Ha": {
    name: "Thu Ha", role: "Cooking Instructor",
    avatar: "https://picsum.photos/seed/thu-avatar/200/200",
    bio: "Home cook turned instructor.\nSharing Vietnamese cuisine with the world.",
    location: "Sai Gon", website: "thuhacooks.com",
    cover: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1800&q=90",
    skills: ["Cooking", "Baking", "Vietnamese Cuisine"],
    learners: 650, rating: 4.7, followers: 320,
  },
  "Huy Tran": {
    name: "Huy Tran", role: "Full-stack Developer",
    avatar: "https://picsum.photos/seed/huy-avatar/200/200",
    bio: "Building products and teaching code.\nFull-stack dev with 8 years experience.",
    location: "Da Nang", website: "huy.dev",
    cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1800&q=90",
    skills: ["React", "TypeScript", "Node.js", "Python"],
    learners: 1100, rating: 4.9, followers: 410,
  },
  "Minh Anh": {
    name: "Minh Anh", role: "Public Speaking Coach",
    avatar: "https://picsum.photos/seed/minh-avatar/200/200",
    bio: "Helping professionals communicate with confidence.\nTEDx speaker and coach.",
    location: "Ha Noi", website: "minhanhspeaks.com",
    cover: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1800&q=90",
    skills: ["Public Speaking", "Presentation Skills", "Communication"],
    learners: 1340, rating: 4.9, followers: 560,
  },
  "Bao Long": {
    name: "Bao Long", role: "Business Strategy Mentor",
    avatar: "https://picsum.photos/seed/bao-avatar/200/200",
    bio: "Startup advisor and strategy consultant.\nFormer founder, current mentor.",
    location: "Sai Gon", website: "baolong.co",
    cover: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1800&q=90",
    skills: ["Business Strategy", "Startups", "Leadership"],
    learners: 720, rating: 4.7, followers: 290,
  },
};

const allPeople = Object.values(profiles);

const offers = [
  ["1-on-1 Coaching Sessions", "Personalized guidance"],
  ["Group Workshops", "Hands-on learning experience"],
  ["Online Resources", "Self-paced materials"],
];

export function ProfileReplacement({ name }: { name?: string }) {
  const [tab, setTab] = useState("Posts");
  const tabs = [["Posts", PanelsTopLeft], ["Articles", ImageIcon], ["Sessions", CalendarDays], ["About", UserRound]] as const;

  const profile = (name && profiles[name]) || profiles["Duc Pham"];
  const firstName = profile.name.split(" ")[0];

  return (
    <main className="tr-profile-page">
      <article className="tr-profile-shell">
        <div className="tr-profile-cover">
          <img src={profile.cover} alt="" />
        </div>
        <div className="tr-profile-body">
          <header className="tr-profile-summary">
            <div className="tr-profile-person">
              <img className="tr-profile-avatar" src={profile.avatar} alt={profile.name} />
              <div>
                <h1>{profile.name} <BadgeCheck aria-label="Verified" /></h1>
                <p className="tr-profile-role">{profile.role}</p>
                <p className="tr-profile-meta">
                  <span><MapPin />{profile.location}</span>
                  <a href={`https://${profile.website}`}><Link2 />{profile.website}</a>
                </p>
                <p className="tr-profile-bio">
                  {profile.bio.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}
                </p>
              </div>
            </div>
            <div className="tr-profile-actions">
              <button>Follow</button>
              <button>Message</button>
            </div>
          </header>

          <div className="tr-profile-layout">
            <div>
              <section className="tr-profile-stats">
                <div><UsersRound /><strong>{profile.learners}</strong><small>Learners</small></div>
                <div><Star /><strong>{profile.rating}</strong><small>Rating</small></div>
                <div><UsersRound /><strong>{profile.followers}</strong><small>Followers</small></div>
              </section>
              <section className="tr-profile-skills">
                <h2>Skills</h2>
                <div>{profile.skills.map(x => <span key={x}><Camera />{x}</span>)}</div>
              </section>
              <nav className="tr-profile-tabs" aria-label="Profile sections">
                {tabs.map(([label, Icon]) => (
                  <button key={label} aria-current={tab === label ? "page" : undefined} onClick={() => setTab(label)}>
                    <Icon />{label}
                  </button>
                ))}
              </nav>

              {tab === "Posts" && (
                <article className="tr-profile-post tr-thread-post">
                  <div className="tr-thread-avatar"><img src={profile.avatar} alt={`${profile.name}'s profile`} /><span aria-hidden="true" /></div>
                  <div className="tr-thread-content">
                    <header><span><strong>{profile.name}</strong><small>· 1h</small></span><button aria-label="Post options"><Ellipsis /></button></header>
                    <p>Sharing something I&apos;ve been working on lately.</p>
                    <img className="tr-profile-post-image" src={profile.cover} alt={`${profile.name}'s latest work`} />
                    <footer><button aria-label="Like post"><Heart />142</button><button aria-label="Reply to post"><MessageCircle />8</button><button aria-label="Repost"><Repeat2 />1</button><button aria-label="Share post"><Send />4</button></footer>
                  </div>
                </article>
              )}
              {tab === "Articles" && (
                <section className="tr-profile-empty">
                  <h2>Articles</h2>
                  <p>Long-form content will appear here.</p>
                </section>
              )}
              {tab === "Sessions" && (
                <section className="tr-profile-empty">
                  <h2>Learn with {firstName}</h2>
                  <p>Private sessions and workshops are available from {firstName}&apos;s profile.</p>
                </section>
              )}
              {tab === "About" && (
                <section className="tr-profile-empty">
                  <h2>About {firstName}</h2>
                  <p>{profile.bio}</p>
                </section>
              )}
            </div>

            <aside className="tr-profile-sidebar">
              <section>
                <h2>About {firstName}</h2>
                <p>{profile.bio}</p>
              </section>
              <section>
                <h2>What I offer</h2>
                {offers.map(([title, desc]) => (
                  <div className="tr-offer" key={title}>
                    <Camera /><span><strong>{title}</strong><small>{desc}</small></span>
                  </div>
                ))}
              </section>
              <section>
                <h2>Achievements</h2>
                <div className="tr-achievement"><Medal />Featured Creator</div>
                <div className="tr-achievement"><Trophy />Top Rated</div>
              </section>
            </aside>
          </div>

          <section className="tr-similar">
            <p>Keep exploring</p>
            <h2>Similar people</h2>
            <div>
              {allPeople.filter(p => p.name !== profile.name).map(person => (
                <a key={person.name} href={`/profile/${encodeURIComponent(person.name)}`}>
                  <img src={person.avatar} alt="" />
                  <span><strong>{person.name}</strong><small>{person.role}</small></span>
                  <b>→</b>
                </a>
              ))}
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
