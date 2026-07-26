(() => {
  const payload = window.__TUTORIA_COURSE_PROFILE__;
  if (!payload) return;

  let course = payload.course;
  try {
    const published = JSON.parse(
      window.localStorage.getItem("tutoria-published-courses") || "[]",
    );
    const savedCourse = Array.isArray(published)
      ? published.find((item) => item.slug === payload.slug)
      : null;
    if (savedCourse) course = savedCourse;
  } catch {
    // Use the server-provided course when browser storage is unavailable.
  }
  if (!course) return;

  const similarCourses = payload.similarCourses || [];
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  const stars = (rating) =>
    "★".repeat(Math.max(1, Math.min(5, Math.round(Number(rating) || 0))));
  const initials = (name) =>
    String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  const formatPrice = (price) => {
    const value = String(price || "Free");
    return value.replace(/\s+đ$/i, "đ");
  };
  const setText = (element, value) => {
    if (element) element.textContent = String(value ?? "");
  };

  document.title = `${course.title} — Tutoria`;
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) descriptionMeta.setAttribute("content", course.subtitle);

  const hero = document.querySelector("main > section");
  const heroImage = hero?.querySelector('div[style*="background-image"]');
  if (heroImage) {
    heroImage.style.backgroundImage = `url("${String(course.image).replaceAll('"', '\\"')}")`;
  }

  const breadcrumb = hero?.querySelector('nav[aria-label="Breadcrumb"]');
  if (breadcrumb) {
    const pieces = breadcrumb.querySelectorAll("a, span");
    setText(pieces[2], course.category);
    setText(pieces[4], `${course.category} learning`);
  }

  const heroGrid = hero?.querySelector(".hero-grid");
  const heroCopy = heroGrid?.firstElementChild;
  if (heroCopy) {
    const badges = heroCopy.querySelectorAll(":scope > div:first-child span");
    setText(badges[1], String(course.level).toUpperCase());

    const title = heroCopy.querySelector("h1");
    setText(title, course.title);
    setText(title?.nextElementSibling, course.subtitle);

    const ratingRow = title?.nextElementSibling?.nextElementSibling;
    if (ratingRow) {
      setText(ratingRow.querySelector("strong"), Number(course.rating).toFixed(1));
      const ratingStars = ratingRow.querySelector(".star-row");
      setText(ratingStars, stars(course.rating));
      ratingStars?.setAttribute("aria-label", `${course.rating} out of 5 stars`);
      setText(ratingRow.querySelector("button"), `${course.reviewCount} ratings`);
      setText(ratingRow.querySelector("span:last-child"), `${Number(course.students).toLocaleString("en-US")} learners`);
    }

    const creator = ratingRow?.nextElementSibling;
    setText(creator?.querySelector("a"), course.instructor);

    const meta = creator?.nextElementSibling;
    const metaItems = meta?.querySelectorAll(":scope > span") || [];
    if (metaItems[0]) {
      const icon = metaItems[0].querySelector("svg");
      metaItems[0].textContent = `Updated ${course.updated}`;
      if (icon) metaItems[0].prepend(icon);
    }
    if (metaItems[1]) {
      const icon = metaItems[1].querySelector("svg");
      metaItems[1].textContent = course.language;
      if (icon) metaItems[1].prepend(icon);
    }
    if (metaItems[2]) {
      metaItems[2].hidden = !course.certificate;
    }
  }

  const description = document.querySelector("#description .space-y-4");
  if (description) {
    description.innerHTML = course.description
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  }

  const outcomes = document.querySelector("#overview > div");
  if (outcomes) {
    outcomes.innerHTML = course.outcomes
      .map(
        (outcome) =>
          `<div class="flex gap-3 text-[15px] leading-6 text-neutral-300"><span class="mt-1 text-[var(--lime)]">✓</span><span>${escapeHtml(outcome)}</span></div>`,
      )
      .join("");
  }

  const lessonTotal = (course.curriculum || []).reduce(
    (total, section) => total + section.lessons.length,
    0,
  );
  const curriculumSummary = document.querySelector("#curriculum h2 + p");
  setText(
    curriculumSummary,
    `${course.curriculum.length} modules · ${lessonTotal || course.lessons} lessons · ${course.duration} total`,
  );

  const modules = document.querySelector("#modules");
  if (modules) {
    modules.innerHTML = course.curriculum
      .map((section, sectionIndex) => {
        const lessonRows = section.lessons
          .map(
            (lesson, lessonIndex) =>
              `<div class="lesson-row flex items-center gap-3 py-4 text-sm"><span class="text-neutral-500">▶</span><span class="flex-1">${escapeHtml(lesson)}</span>${sectionIndex === 0 && lessonIndex === 0 ? '<button class="preview-link text-xs font-semibold underline">Preview</button>' : ""}<span class="text-xs muted">${String(lessonIndex + 8).padStart(2, "0")}:12</span></div>`,
          )
          .join("");
        const border = sectionIndex < course.curriculum.length - 1 ? " border-b hairline" : "";
        return `<article class="module${sectionIndex === 0 ? " open" : ""}${border}"><button class="module-toggle flex w-full items-center gap-4 bg-[#171717] px-5 py-5 text-left hover:bg-[#1d1d1d]" aria-expanded="${sectionIndex === 0}"><svg class="chevron h-4 w-4 shrink-0 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg><span class="min-w-0 flex-1"><strong class="block text-[15px]">${sectionIndex + 1}. ${escapeHtml(section.title)}</strong><span class="mt-1 block text-xs muted">${escapeHtml(section.lessons[0] || section.title)}</span></span><span class="hidden shrink-0 text-xs muted sm:block">${section.lessons.length} lessons · ${escapeHtml(section.duration)}</span></button><div class="module-panel bg-[#0d0d0d] px-5 sm:px-10">${lessonRows}</div></article>`;
      })
      .join("");
  }

  const requirementsSection = document.querySelector("#curriculum")?.nextElementSibling;
  const requirements = requirementsSection?.querySelector("ul");
  if (requirements) {
    requirements.innerHTML = course.requirements
      .map(
        (requirement) =>
          `<li class="flex gap-3"><span>•</span><span>${escapeHtml(requirement)}</span></li>`,
      )
      .join("");
  }

  const faqList = document.querySelector("#faq > div");
  if (faqList) {
    faqList.innerHTML = course.faqs
      .map(
        (faq, index) =>
          `<article class="faq${index === 0 ? " open" : ""}"><button class="faq-toggle flex w-full items-center justify-between gap-4 py-5 text-left font-medium" aria-expanded="${index === 0}"><span>${escapeHtml(faq.question)}</span><span class="plus text-2xl font-light transition-transform">+</span></button><p class="faq-answer pb-5 pr-10 text-sm leading-6 muted">${escapeHtml(faq.answer)}</p></article>`,
      )
      .join("");
  }

  const instructor = document.querySelector("#instructor");
  if (instructor) {
    setText(instructor.querySelector(".h-28.w-28"), initials(course.instructor));
    const instructorLink = instructor.querySelector("a");
    setText(instructorLink, course.instructor);
    setText(instructorLink?.nextElementSibling, course.instructorRole);
    const stats = instructor.querySelectorAll(".grid.grid-cols-2 span");
    setText(stats[0], `★ ${course.rating} instructor rating`);
    setText(stats[1], `◉ ${Number(course.students).toLocaleString("en-US")} learners`);
    setText(stats[2], `▤ ${course.reviewCount} reviews`);
    setText(stats[3], `▶ ${course.curriculum.length} modules`);
    setText(instructor.querySelector(".max-w-xl"), course.instructorBio);
  }

  const reviewsSection = document.querySelector("#reviews");
  if (reviewsSection) {
    const ratingCard = reviewsSection.querySelector(".surface");
    setText(ratingCard?.firstElementChild, Number(course.rating).toFixed(1));
    setText(ratingCard?.querySelector(".star-row"), stars(course.rating));

    const reviewsList = reviewsSection.querySelector(".mt-8.divide-y");
    if (reviewsList) {
      reviewsList.innerHTML = course.reviews
        .map(
          (review, index) =>
            `<article class="py-7"><div class="flex items-start gap-4"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-full ${index % 2 === 0 ? "bg-[#25354c]" : "bg-[#49352a]"} font-semibold">${escapeHtml(initials(review.name))}</span><div><h3 class="font-semibold">${escapeHtml(review.name)}</h3><div class="mt-1 flex gap-3 text-xs"><span class="star-row">${stars(review.rating)}</span><span class="muted">${escapeHtml(review.date)}</span></div><p class="mt-4 text-[15px] leading-6 text-neutral-300">${escapeHtml(review.body)}</p></div></div></article>`,
        )
        .join("");
    }
  }

  const related = reviewsSection?.nextElementSibling?.querySelector(".no-scrollbar");
  if (related && similarCourses.length) {
    const gradients = [
      "bg-[linear-gradient(135deg,#294e58,#8bc0c7)]",
      "bg-[linear-gradient(135deg,#40335f,#9b72d7)]",
      "bg-[linear-gradient(135deg,#4e3b22,#db9e42)]",
    ];
    related.innerHTML = similarCourses
      .map(
        (item, index) =>
          `<article class="w-[230px] shrink-0 snap-start"><a href="/courses/${encodeURIComponent(item.slug)}"><div class="aspect-[16/10] rounded-xl ${gradients[index % gradients.length]} p-4"><span class="text-xs font-bold text-white/80">${escapeHtml(String(item.category).toUpperCase())}</span><div class="mt-7 text-xl font-semibold">${escapeHtml(item.title)}</div></div><h3 class="mt-4 font-semibold">${escapeHtml(item.title)}</h3><p class="mt-1 text-xs muted">${escapeHtml(item.instructor)}</p><p class="mt-2 text-sm"><span class="font-semibold text-[#e8b85d]">${Number(item.rating).toFixed(1)}</span> <span class="star-row text-xs">${stars(item.rating)}</span> <span class="text-xs muted">(${Math.max(48, Math.round(item.students * 0.16))})</span></p><p class="mt-2 font-semibold">${escapeHtml(formatPrice(item.price))}</p></a></article>`,
      )
      .join("");
  }

  const price = formatPrice(course.price);
  const enrollLabel = course.price === "Free" ? "Start course" : "Enroll now";
  const purchaseCard = document.querySelector(".purchase-card");
  setText(purchaseCard?.querySelector(".display"), price);
  setText(purchaseCard?.querySelector(".enroll-trigger"), enrollLabel);
  const includeItems = purchaseCard?.querySelectorAll("ul li span:last-child") || [];
  setText(includeItems[0], `${course.duration} on-demand video`);
  setText(includeItems[1], `${course.lessons} guided lessons`);
  if (includeItems[4]) includeItems[4].parentElement.hidden = !course.certificate;

  const mobileBar = document.querySelector("body > div.fixed.inset-x-0");
  setText(mobileBar?.querySelector("strong"), price);
  setText(mobileBar?.querySelector(".enroll-trigger"), enrollLabel);

  const previewTitle = document.querySelector("#previewTitle");
  setText(previewTitle, course.curriculum[0]?.lessons[0] || course.title);
  setText(
    document.querySelector("#previewModal .preview-art p.text-xl"),
    `Preview: ${course.curriculum[0]?.lessons[0] || course.title}`,
  );

  const enrollModal = document.querySelector("#enrollModal");
  setText(enrollModal?.querySelector(".bg-\\[\\#0e0e0e\\] span"), course.title);
  setText(enrollModal?.querySelector(".bg-\\[\\#0e0e0e\\] strong"), price);
  setText(enrollModal?.querySelector("#continueCheckout"), course.price === "Free" ? "Start learning" : "Continue to checkout");
})();
