"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BadgeCheck, Bookmark, Camera, CalendarDays, ChevronDown, Clock, Ellipsis, Heart,
  Image as ImageIcon, Link2, MapPin, MessageCircle, Medal, PanelsTopLeft, Pencil,
  Plus, Repeat2, Send, Share2, Star, Trash2, Trophy, UserRound, UserRoundPlus, UsersRound,
} from "lucide-react";
import "./public-profile.css";
import "./owner-profile.css";

export const samplePublicProfile = {
  name: "Duc Pham",
  role: "Photography Artist",
  location: "Tay Ho, Ha Noi",
  website: "ducpham.photo",
  bio: ["Commercial photographer and exhibition curator.", "Teaching photography for 5+ years."],
  about: "I’ve been behind the lens for over a decade, capturing everything from intimate portraits to sprawling landscapes. My work has been exhibited in galleries across Vietnam and Southeast Asia.",
  avatar: "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=400&q=90",
  cover: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1800&q=90",
  stats: [
    { label: "Learners", value: "1,200", icon: UsersRound },
    { label: "Rating", value: "4.9", icon: Star },
    { label: "Followers", value: "245", icon: UsersRound },
  ],
  skills: ["Photography", "Lightroom", "Photoshop", "Composition"],
  offers: [
    { title: "1-on-1 Photography Sessions", description: "Personalized guidance", icon: UserRound },
    { title: "Photography Workshops", description: "Hands-on learning experience", icon: Camera },
    { title: "Photo Editing & Lightroom", description: "Post-processing techniques", icon: ImageIcon },
  ],
  achievements: [
    { label: "Exhibited in 12+ galleries", icon: Medal },
    { label: "National Geographic Featured", icon: Trophy },
  ],
  sessions: [
    { id: "landscape", category: "course", type: "1:1 Coaching", tone: "violet", title: "Mastering Landscape Photography", duration: "60 min", format: "1:1", price: 89, rating: "5.0", reviews: 72, image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=88" },
    { id: "street", category: "course", type: "1:1 Coaching", tone: "violet", title: "Street Photography: See. Shoot. Tell.", duration: "60 min", format: "1:1", price: 79, rating: "5.0", reviews: 48, image: "https://images.unsplash.com/photo-1494522358652-f30e61a60313?auto=format&fit=crop&w=900&q=88" },
    { id: "walk", category: "workshop", type: "Group Workshop", tone: "mint", title: "Photo Walk & Editing Workshop", duration: "180 min", format: "Small group", price: 129, rating: "4.9", reviews: 36, image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=88" },
    { id: "west-lake-club", category: "community", type: "Community Meetup", tone: "amber", title: "West Lake Golden Hour Photo Club", duration: "90 min", format: "Open community", price: 0, rating: "4.9", reviews: 118, image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=88" },
  ],
  posts: [
    { id: 1, type: "photo", createdAt: "1h ago", image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=90", text: "Golden hour at West Lake today. The light was absolutely incredible 🌅", likes: 142, comments: 8 },
    { id: 2, type: "article", createdAt: "2h ago", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=700&q=90", title: "Five mistakes beginners make when learning photography", text: "After teaching photography workshops for 5 years, I’ve seen the same patterns over and over again.", likes: 234, comments: 18, readTime: "8 min read" },
  ],
};

const tabs = [
  ["Posts", PanelsTopLeft], ["Articles", ImageIcon], ["Sessions", CalendarDays], ["About", UserRound],
];

const similarPeople = [
  { name: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/200/200" },
  { name: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/200/200" },
  { name: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/200/200" },
  { name: "Minh Anh", role: "Public Speaking Coach", avatar: "https://picsum.photos/seed/minh-avatar/200/200" },
];

/**
 * Reusable public profile.
 * Callbacks receive the new value/item and are optional.
 */
export default function PublicProfilePage({
  profile = samplePublicProfile,
  initiallyFollowing = false,
  onFollowChange,
  onMessage,
  onTabChange,
  onPostLike,
  onPostSave,
  onPostShare,
  onSessionSelect,
  onBack,
  onProfileShare,
  onProfileUpdate,
  isOwner = false,
  className = "",
}) {
  const [activeTab, setActiveTab] = useState("Posts");
  const [following, setFollowing] = useState(initiallyFollowing);
  const [profileData, setProfileData] = useState(profile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [managingPosts, setManagingPosts] = useState(false);
  const currentProfile = profileData;
  const visiblePosts = useMemo(
    () => currentProfile.posts.filter((post) => activeTab === "Articles" ? post.type === "article" : post.type !== "article"),
    [activeTab, currentProfile.posts],
  );

  const changeTab = (tab) => { setActiveTab(tab); onTabChange?.(tab); };
  const toggleFollow = () => setFollowing((value) => { onFollowChange?.(!value); return !value; });
  const shareProfile = async () => {
    if (onProfileShare) return onProfileShare(currentProfile);
    if (navigator.share) {
      try { await navigator.share({ title: `${currentProfile.name} — ${currentProfile.role}`, url: window.location.href }); } catch (error) { /* User cancelled. */ }
    }
  };
  const saveProfile = (nextProfile) => {
    setProfileData(nextProfile);
    setEditingProfile(false);
    onProfileUpdate?.(nextProfile);
  };
  const savePosts = (posts) => {
    saveProfile({ ...currentProfile, posts });
    setManagingPosts(false);
    changeTab("Posts");
  };

  return (
    <main className={`public-profile ${className}`.trim()}>
      <article className="pp-shell">
        <div className="pp-cover">
          <img src={currentProfile.cover} alt="" />
          <div className="pp-cover-tools">
            <button type="button" onClick={() => onBack ? onBack() : window.history.back()} aria-label="Go back"><ArrowLeft /></button>
            <span><button type="button" onClick={shareProfile} aria-label="Share profile"><Share2 /></button><button type="button" aria-label="More profile options"><Ellipsis /></button></span>
          </div>
        </div>
        <div className="pp-body">
          <header className="pp-summary">
            <div className="pp-identity">
              <img className="pp-avatar" src={currentProfile.avatar} alt={`${currentProfile.name}'s profile`} />
              <div className="pp-intro">
                <h1>{currentProfile.name} <BadgeCheck className="pp-verified" aria-label="Verified profile" /></h1>
                <p className="pp-role">{currentProfile.role}</p>
                <div className="pp-meta"><span><MapPin />{currentProfile.location}</span>{currentProfile.website && <a href={`https://${currentProfile.website}`} target="_blank" rel="noreferrer"><Link2 />{currentProfile.website}</a>}</div>
                <div className="pp-bio">{currentProfile.bio.map((line) => <p key={line}>{line}</p>)}</div>
              </div>
            </div>
            <div className="pp-actions">
              {isOwner ? <><button className="pp-button pp-button-dark" onClick={() => setEditingProfile(true)}><Pencil />Edit profile</button><button className="pp-button pp-button-light" onClick={() => setManagingPosts(true)}><PanelsTopLeft />Dashboard</button></> : <><button className={following ? "pp-button pp-button-light" : "pp-button pp-button-dark"} onClick={toggleFollow}><UserRoundPlus />{following ? "Following" : "Follow"}</button><button className="pp-button pp-button-light" onClick={() => onMessage?.(currentProfile)}><MessageCircle />Message</button><button className="pp-icon-button" aria-label="More profile options"><Ellipsis /></button></>}
            </div>
          </header>

          <div className={`pp-layout ${activeTab === "Sessions" ? "is-sessions" : ""}`}>
            <div className="pp-main">
              <section className="pp-stats" aria-label="Profile statistics">{currentProfile.stats.map(({ label, value, icon: Icon }) => <div className="pp-stat" key={label}><Icon /><span><strong>{value}</strong><small>{label}</small></span></div>)}</section>
              <section className="pp-skills"><h2>Skills</h2><div>{currentProfile.skills.map((skill) => <span key={skill}>{skill === "Lightroom" ? <b>Lr</b> : skill === "Photoshop" ? <b>Ps</b> : <Camera />}{skill}</span>)}</div></section>
              <nav className="pp-tabs" aria-label="Profile sections">{tabs.map(([label, Icon]) => <button key={label} aria-current={activeTab === label ? "page" : undefined} onClick={() => changeTab(label)}><Icon />{label}</button>)}</nav>
              {(activeTab === "Posts" || activeTab === "Articles") ? <section className="pp-feed">{visiblePosts.length ? visiblePosts.map((post) => <PostCard key={post.id} post={post} profile={currentProfile} onLike={onPostLike} onSave={onPostSave} onShare={onPostShare} />) : <Empty label={activeTab} />}</section> : activeTab === "Sessions" ? <Sessions sessions={currentProfile.sessions || []} tutorName={currentProfile.name} onSelect={onSessionSelect} /> : <section className="pp-empty"><h2>About {currentProfile.name}</h2><p>{currentProfile.about}</p></section>}
            </div>
            <aside className="pp-sidebar">
              <InfoCard title={`About ${currentProfile.name.split(" ")[0]}`}><p>{currentProfile.about}</p><button className="pp-text-button">Show more <ChevronDown /></button></InfoCard>
              <InfoCard title="What I offer"><div className="pp-offers">{currentProfile.offers.map(({ title, description, icon: Icon }) => <div key={title}><Icon /><span><strong>{title}</strong><small>{description}</small></span></div>)}</div></InfoCard>
              <InfoCard title="Achievements"><div className="pp-achievements">{currentProfile.achievements.map(({ label, icon: Icon }) => <div key={label}><Icon />{label}</div>)}</div></InfoCard>
            </aside>
          </div>
          <SimilarPeople people={similarPeople} />
        </div>
      </article>
      {editingProfile && <EditProfileDialog profile={currentProfile} onCancel={() => setEditingProfile(false)} onSave={saveProfile} />}
      {managingPosts && <ManagePostsDialog posts={currentProfile.posts} onCancel={() => setManagingPosts(false)} onSave={savePosts} />}
    </main>
  );
}

function SimilarPeople({ people }) {
  return <section className="pp-similar" aria-labelledby="similar-people-title">
    <div><p>Keep exploring</p><h2 id="similar-people-title">Similar people</h2></div>
    <div className="pp-similar-grid">{people.map((person) => <a key={person.name} href={`/profile-preview.html?name=${encodeURIComponent(person.name)}`}>
      <img src={person.avatar} alt={`${person.name}, ${person.role}`} loading="lazy" />
      <span><strong>{person.name}</strong><small>{person.role}</small></span>
      <span aria-hidden="true">→</span>
    </a>)}</div>
  </section>;
}

function ManagePostsDialog({ posts, onCancel, onSave }) {
  const [draftPosts, setDraftPosts] = useState(posts.map((post) => ({ ...post })));
  const updatePost = (index, field, value) => setDraftPosts((current) => current.map((post, postIndex) => postIndex === index ? { ...post, [field]: value } : post));
  const removePost = (index) => setDraftPosts((current) => current.filter((_, postIndex) => postIndex !== index));
  const addPost = () => setDraftPosts((current) => [{
    id: `post-${Date.now()}`,
    type: "photo",
    createdAt: "Just now",
    image: "",
    text: "",
    likes: 0,
    comments: 0,
  }, ...current]);
  const submit = (event) => {
    event.preventDefault();
    onSave(draftPosts.map((post) => ({ ...post, text: post.text.trim(), title: post.title?.trim() })).filter((post) => post.text || post.title));
  };
  return <div className="pp-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="pp-edit-dialog pp-post-manager" role="dialog" aria-modal="true" aria-labelledby="manage-posts-title">
      <header><div><p>Profile owner controls</p><h2 id="manage-posts-title">Manage posts</h2></div><button type="button" onClick={onCancel} aria-label="Close post manager">×</button></header>
      <form onSubmit={submit}>
        <div className="pp-post-manager-toolbar"><p>{draftPosts.length} {draftPosts.length === 1 ? "post" : "posts"}</p><button type="button" className="pp-button pp-button-dark" onClick={addPost}><Plus />New post</button></div>
        <div className="pp-managed-posts">
          {draftPosts.length ? draftPosts.map((post, index) => <article className="pp-managed-post" key={post.id}>
            <div className="pp-managed-post-heading"><label><span>Post type</span><select value={post.type} onChange={(event) => updatePost(index, "type", event.target.value)}><option value="photo">Photo post</option><option value="article">Article</option></select></label><button type="button" onClick={() => removePost(index)} aria-label={`Delete post ${index + 1}`}><Trash2 />Delete</button></div>
            {post.type === "article" && <label><span>Title</span><input required value={post.title || ""} onChange={(event) => updatePost(index, "title", event.target.value)} placeholder="Article title" /></label>}
            <label><span>{post.type === "article" ? "Summary" : "Caption"}</span><textarea required rows="3" value={post.text} onChange={(event) => updatePost(index, "text", event.target.value)} placeholder="Write something about this post" /></label>
            <label><span>Image URL</span><input required type="url" value={post.image || ""} onChange={(event) => updatePost(index, "image", event.target.value)} placeholder="https://example.com/photo.jpg" /></label>
          </article>) : <div className="pp-manager-empty"><PanelsTopLeft /><h3>No posts yet</h3><p>Create your first post to share it on your profile.</p></div>}
        </div>
        <footer><button type="button" className="pp-button pp-button-light" onClick={onCancel}>Cancel</button><button type="submit" className="pp-button pp-button-dark">Save posts</button></footer>
      </form>
    </section>
  </div>;
}

function PostCard({ post, profile, onLike, onSave, onShare }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const toggleLike = () => setLiked((v) => { onLike?.(post, !v); return !v; });
  const toggleSave = () => setSaved((v) => { onSave?.(post, !v); return !v; });
  const sharePost = async () => {
    if (onShare) return onShare(post);
    if (navigator.share) {
      try { await navigator.share({ title: post.title || `${profile.name}'s post`, text: post.text, url: window.location.href }); } catch (error) { /* User cancelled the share sheet. */ }
    }
  };
  return <article className="pp-post pp-thread-post">
    <div className="pp-thread-avatar-rail"><img src={profile.avatar} alt={`${profile.name}'s profile`} /><span aria-hidden="true" /></div>
    <div className="pp-thread-content">
      <header><span><strong>{profile.name}</strong><small>· {post.createdAt}</small></span><button aria-label="Post options"><Ellipsis /></button></header>
      <div className="pp-thread-copy">{post.title && <h3>{post.title}</h3>}<p>{post.text}</p>{post.readTime && <small>{post.readTime}</small>}</div>
      {post.image && <img className="pp-post-image" src={post.image} alt={post.title ? `Cover for ${post.title}` : `${profile.name}'s photography post`} />}
      <footer><button className={liked ? "is-active" : ""} onClick={toggleLike} aria-pressed={liked} aria-label="Like post"><Heart />{post.likes + (liked ? 1 : 0)}</button><button aria-label="Reply to post"><MessageCircle />{post.comments}</button><button aria-label="Repost"><Repeat2 />{post.reposts || 1}</button><button onClick={sharePost} aria-label="Share post"><Send />{post.shares || 4}</button></footer>
    </div>
  </article>;
}

function Sessions({ sessions, tutorName, onSelect }) {
  if (!sessions.length) return <Empty label="Sessions" />;
  const groups = [
    { id: "course", title: "Courses", description: "Focused learning paths and private coaching." },
    { id: "workshop", title: "Workshops", description: "Hands-on practice in a small group." },
    { id: "community", title: "Community", description: "Meet, shoot, and learn with local photographers." },
  ];
  return <section className="pp-sessions" aria-label="Available photography sessions">
    <div className="pp-session-heading"><div><p>Learn with {tutorName.split(" ")[0]}</p><h2>Learn, practice, and connect</h2></div><span>{sessions.length} available</span></div>
    {groups.map((group) => {
      const items = sessions.filter((session) => session.category === group.id);
      if (!items.length) return null;
      return <section className="pp-session-section" key={group.id} aria-labelledby={`session-${group.id}`}><header><h3 id={`session-${group.id}`}>{group.title}</h3><p>{group.description}</p></header><div className="pp-session-grid">{items.map((session) => <SessionCard key={session.id} session={session} onSelect={onSelect} />)}</div></section>;
    })}
  </section>;
}

function SessionCard({ session, onSelect }) {
  return <article className="pp-session-card">
    <div className="pp-session-media"><img src={session.image} alt="" loading="lazy" /><span className={`pp-session-badge is-${session.tone}`}>{session.type}</span></div>
    <div className="pp-session-content">
      <h3>{session.title}</h3>
      <div className="pp-session-meta"><span><Clock />{session.duration}</span><span><UsersRound />{session.format}</span></div>
      <div className="pp-session-bottom"><p><strong>{session.price ? `$${session.price}` : "Free"}</strong>{session.price ? " / session" : ""}</p><span><Star />{session.rating} <small>({session.reviews})</small></span></div>
      <button type="button" onClick={() => onSelect?.(session)} aria-label={`View ${session.title}`}>{session.category === "community" ? "Join community" : "View session"}</button>
    </div>
  </article>;
}

function EditProfileDialog({ profile, onCancel, onSave }) {
  const [draft, setDraft] = useState({
    ...profile,
    bioText: profile.bio.join("\n"),
    skillsText: profile.skills.join(", "),
    offers: profile.offers.map((offer) => ({ ...offer })),
    achievements: profile.achievements.map((achievement) => ({ ...achievement })),
  });
  const [cropImage, setCropImage] = useState(null);
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const updateListItem = (field, index, key, value) => setDraft((current) => ({
    ...current,
    [field]: current[field].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));
  const addListItem = (field) => setDraft((current) => ({
    ...current,
    [field]: [...current[field], field === "offers"
      ? { title: "", description: "", icon: Camera }
      : { label: "", icon: Trophy }],
  }));
  const removeListItem = (field, index) => setDraft((current) => ({
    ...current,
    [field]: current[field].filter((_, itemIndex) => itemIndex !== index),
  }));
  const loadImage = (field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImage({ field, src: reader.result });
    reader.readAsDataURL(file);
  };
  const submit = (event) => {
    event.preventDefault();
    const { bioText, skillsText, ...rest } = draft;
    onSave({
      ...rest,
      bio: bioText.split("\n").map((line) => line.trim()).filter(Boolean),
      skills: skillsText.split(",").map((skill) => skill.trim()).filter(Boolean),
      offers: rest.offers
        .map((offer) => ({ ...offer, title: offer.title.trim(), description: offer.description.trim() }))
        .filter((offer) => offer.title),
      achievements: rest.achievements
        .map((achievement) => ({ ...achievement, label: achievement.label.trim() }))
        .filter((achievement) => achievement.label),
    });
  };
  return <div className="pp-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="pp-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <header><div><p>Profile owner controls</p><h2 id="edit-profile-title">Edit profile</h2></div><button type="button" onClick={onCancel} aria-label="Close editor">×</button></header>
      <form onSubmit={submit}>
        <div className="pp-edit-images">
          <div className="pp-edit-image-field"><span>Cover image</span><div><img src={draft.cover} alt="Cover preview" /><label>Change<input type="file" accept="image/*" onChange={(event) => loadImage("cover", event.target.files?.[0])} /></label><button type="button" onClick={() => setCropImage({ field: "cover", src: draft.cover })}>Adjust</button></div></div>
          <div className="pp-edit-image-field"><span>Profile photo</span><div><img className="is-avatar" src={draft.avatar} alt="Profile preview" /><label>Change<input type="file" accept="image/*" onChange={(event) => loadImage("avatar", event.target.files?.[0])} /></label><button type="button" onClick={() => setCropImage({ field: "avatar", src: draft.avatar })}>Adjust</button></div></div>
        </div>
        <div className="pp-edit-grid">
          <label><span>Name</span><input required value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label><span>Professional role</span><input required value={draft.role} onChange={(event) => update("role", event.target.value)} /></label>
          <label><span>Location</span><input value={draft.location} onChange={(event) => update("location", event.target.value)} /></label>
          <label><span>Website</span><input value={draft.website} onChange={(event) => update("website", event.target.value.replace(/^https?:\/\//, ""))} /></label>
          <label className="is-wide"><span>Short bio <small>One line per statement</small></span><textarea rows="3" value={draft.bioText} onChange={(event) => update("bioText", event.target.value)} /></label>
          <label className="is-wide"><span>About</span><textarea rows="4" value={draft.about} onChange={(event) => update("about", event.target.value)} /></label>
          <label className="is-wide"><span>Skills <small>Separate with commas</small></span><input value={draft.skillsText} onChange={(event) => update("skillsText", event.target.value)} /></label>
        </div>
        <fieldset className="pp-edit-collection">
          <legend><span>What I offer</span><small>Services shown on your public profile</small></legend>
          {draft.offers.map((offer, index) => <div className="pp-edit-collection-row is-offer" key={`offer-${index}`}>
            <label><span>Service</span><input required value={offer.title} onChange={(event) => updateListItem("offers", index, "title", event.target.value)} placeholder="Photography workshop" /></label>
            <label><span>Description</span><input value={offer.description} onChange={(event) => updateListItem("offers", index, "description", event.target.value)} placeholder="Hands-on learning experience" /></label>
            <button type="button" onClick={() => removeListItem("offers", index)} aria-label={`Remove ${offer.title || "offering"}`}><Trash2 /></button>
          </div>)}
          <button type="button" className="pp-add-row" onClick={() => addListItem("offers")}><Plus />Add offering</button>
        </fieldset>
        <fieldset className="pp-edit-collection">
          <legend><span>Achievements</span><small>Highlights and recognition</small></legend>
          {draft.achievements.map((achievement, index) => <div className="pp-edit-collection-row" key={`achievement-${index}`}>
            <label><span>Achievement</span><input required value={achievement.label} onChange={(event) => updateListItem("achievements", index, "label", event.target.value)} placeholder="Exhibited in 12+ galleries" /></label>
            <button type="button" onClick={() => removeListItem("achievements", index)} aria-label={`Remove ${achievement.label || "achievement"}`}><Trash2 /></button>
          </div>)}
          <button type="button" className="pp-add-row" onClick={() => addListItem("achievements")}><Plus />Add achievement</button>
        </fieldset>
        <footer><button type="button" className="pp-button pp-button-light" onClick={onCancel}>Cancel</button><button type="submit" className="pp-button pp-button-dark">Save changes</button></footer>
      </form>
    </section>
    {cropImage && <ImageCropDialog image={cropImage} onCancel={() => setCropImage(null)} onApply={(src) => { update(cropImage.field, src); setCropImage(null); }} />}
  </div>;
}

function ImageCropDialog({ image, onCancel, onApply }) {
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [dragging, setDragging] = useState(null);
  const [description, setDescription] = useState("");
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const isAvatar = image.field === "avatar";
  useEffect(() => {
    const preview = new Image();
    preview.onload = () => setImageSize({ width: preview.naturalWidth, height: preview.naturalHeight });
    preview.src = image.src;
  }, [image.src]);
  const frameAspect = isAvatar ? 1 : 1600 / 520;
  const imageAspect = imageSize.width / imageSize.height;
  const fillZoom = Math.max(frameAspect / imageAspect, imageAspect / frameAspect);
  const maxZoom = Math.max(3, Math.ceil(fillZoom * 1.75 * 10) / 10);
  const clamp = (value) => Math.max(-1, Math.min(1, value));
  const startDrag = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging({ clientX: event.clientX, clientY: event.clientY, x, y });
  };
  const moveDrag = (event) => {
    if (!dragging) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setX(clamp(dragging.x + ((event.clientX - dragging.clientX) / bounds.width) * 3));
    setY(clamp(dragging.y + ((event.clientY - dragging.clientY) / bounds.height) * 3));
  };
  const moveWithKeys = (event) => {
    const amount = event.shiftKey ? .15 : .05;
    if (event.key === "ArrowLeft") setX((value) => clamp(value - amount));
    else if (event.key === "ArrowRight") setX((value) => clamp(value + amount));
    else if (event.key === "ArrowUp") setY((value) => clamp(value - amount));
    else if (event.key === "ArrowDown") setY((value) => clamp(value + amount));
    else return;
    event.preventDefault();
  };
  const applyCrop = () => {
    const outputWidth = isAvatar ? 600 : 1600;
    const outputHeight = isAvatar ? 600 : 520;
    const source = new Image();
    source.crossOrigin = "anonymous";
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      // Start from the entire original image (contain), then apply only the
      // zoom and positioning explicitly chosen in the editor.
      const scale = Math.min(outputWidth / source.naturalWidth, outputHeight / source.naturalHeight) * zoom;
      const width = source.naturalWidth * scale;
      const height = source.naturalHeight * scale;
      const travelX = Math.abs(width - outputWidth);
      const travelY = Math.abs(height - outputHeight);
      const drawX = (outputWidth - width) / 2 + x * travelX / 2;
      const drawY = (outputHeight - height) / 2 + y * travelY / 2;
      context.fillStyle = "#202327";
      context.fillRect(0, 0, outputWidth, outputHeight);
      context.drawImage(source, drawX, drawY, width, height);
      try { onApply(canvas.toDataURL("image/jpeg", .9)); } catch (error) { onApply(image.src); }
    };
    source.onerror = () => onApply(image.src);
    source.src = image.src;
  };
  return <div className={`pp-crop-overlay ${isAvatar ? "is-avatar-editor" : "is-cover-editor"}`}>
    <section className={`pp-crop-dialog ${isAvatar ? "is-avatar-editor" : "is-cover-editor"}`} role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <header><div><p>{isAvatar ? "" : "Your cover photo is visible to everyone"}</p><h2 id="crop-title">{isAvatar ? "Choose profile picture" : "Reposition cover photo"}</h2></div>{isAvatar ? <button type="button" onClick={onCancel} aria-label="Close crop editor">×</button> : <span><button type="button" className="pp-button pp-button-light" onClick={onCancel}>Cancel</button><button type="button" className="pp-button pp-button-dark" onClick={applyCrop}>Save changes</button></span>}</header>
      {isAvatar && <textarea className="pp-avatar-description" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" aria-label="Profile picture description" />}
      <div className={`pp-crop-stage ${isAvatar ? "is-avatar" : "is-cover"}`} tabIndex="0" onKeyDown={moveWithKeys} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} aria-label="Drag the image or use arrow keys to reposition it"><img src={image.src} alt="Crop preview" draggable="false" style={{ transform: `translate(${x * 16}%, ${y * 16}%) scale(${zoom})` }} /><span aria-hidden="true" />{!isAvatar && <div className="pp-crop-instruction">Drag the photo or use the arrow keys to reposition it</div>}</div>
      {isAvatar ? <><div className="pp-avatar-zoom"><span aria-hidden="true">−</span><input aria-label="Zoom profile picture" type="range" min="1" max={maxZoom} step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><span aria-hidden="true">+</span></div><div className="pp-avatar-options"><button type="button" onClick={() => { setZoom(1); setX(0); setY(0); }}>Fit image</button><button type="button" onClick={() => setZoom(fillZoom)}>Fill circle</button></div><p className="pp-avatar-privacy">Your profile picture is visible to everyone.</p></> : <div className="pp-crop-controls is-cover"><div className="pp-cover-zoom-actions"><button type="button" onClick={() => { setZoom(1); setX(0); setY(0); }}>Fit entire image</button><button type="button" onClick={() => setZoom(fillZoom)}>Fill cover</button></div><label><span>Zoom <output>{Math.round(zoom * 100)}%</output></span><input type="range" min="1" max={maxZoom} step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label></div>}
      {isAvatar && <footer><span /><span><button type="button" className="pp-button pp-button-light" onClick={onCancel}>Cancel</button><button type="button" className="pp-button pp-button-dark" onClick={applyCrop}>Save</button></span></footer>}
    </section>
  </div>;
}

function InfoCard({ title, children }) { return <section className="pp-card"><h2>{title}</h2>{children}</section>; }
function Empty({ label }) { return <section className="pp-empty"><h2>{label}</h2><p>No {label.toLowerCase()} have been added yet.</p></section>; }
