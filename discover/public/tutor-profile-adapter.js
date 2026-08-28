const revealTutorProfile = () => {
  delete document.documentElement.dataset.profilePending;
  try {
    const activeProfile = JSON.parse(document.documentElement.dataset.activeTutorProfile || "null");
    window.parent?.postMessage({ type: "tutoria-tutor-profile-ready", name: activeProfile?.name || "" }, window.location.origin);
  } catch {
    window.parent?.postMessage({ type: "tutoria-tutor-profile-ready", name: "" }, window.location.origin);
  }
};

(async function () {
  const params = new URLSearchParams(window.location.search);
  const profiles = (() => {
    try {
      return JSON.parse(document.documentElement.dataset.tutorProfiles || "[]");
    } catch {
      return [];
    }
  })();
  const profileName = decodeURIComponent(String(params.get("name") || "").replace(/\+/g, " ")).trim();
  const liveProfile = (() => {
    try {
      const encoded = params.get("profile");
      if (!encoded) return null;
      const json = decodeURIComponent(escape(atob(String(encoded).replace(/-/g, "+").replace(/_/g, "/"))));
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object" || !parsed.name) return null;
      return parsed;
    } catch {
      return null;
    }
  })();
  const submittedProfile = (() => {
    try {
      const submission = JSON.parse(window.localStorage.getItem("tutoria_tutor_profile_submission") || "null");
      if (!submission || !["pending_review", "published"].includes(String(submission.status)) || !submission.displayName?.trim() || submission.displayName.trim() !== profileName) return null;
      const sessionLength = submission.displayDuration || submission.sessionLengths?.[0] || 60;
      const price = Number(submission.rates?.[String(sessionLength)] || 0);
      return {
        name: submission.displayName.trim(),
        role: submission.role?.trim() || "Independent tutor",
        tagline: submission.headline?.trim() || "A new tutor on Tutoria.",
        image: submission.photoUrl || "/images/tutor-profile-thu-ha.png",
        rating: 0,
        reviewCount: 0,
        lessons: 0,
        responseTime: "—",
        location: submission.location?.trim() || "Location not set",
        price,
        languages: submission.languages?.filter(Boolean) || [],
        subjects: submission.skills?.filter(Boolean) || [],
        about: [submission.about?.trim(), submission.professionalBackground?.trim()].filter(Boolean),
        learnerLevels: submission.learnerLevels?.filter(Boolean) || [],
        ageGroups: submission.ageGroups?.filter(Boolean) || [],
        teachingStyles: submission.teachingStyles?.filter(Boolean) || [],
        outcomes: submission.goals?.filter(Boolean) || [],
        typicalLesson: submission.lessonDescription?.trim() || "Each lesson is tailored to the learner’s goal, pace, and experience.",
        credentials: submission.credentials?.filter(Boolean) || [],
        portfolioUrl: submission.portfolioUrl?.trim() || "",
        sessionLengths: submission.sessionLengths?.filter((value) => Number.isFinite(Number(value))) || [],
        rates: submission.rates || {},
        displayDuration: submission.displayDuration,
        lessonFormat: submission.lessonFormat?.filter(Boolean) || [],
        availability: submission.availability?.filter(Boolean) || [],
        timeZone: submission.timeZone?.trim() || "",
        sameDayBooking: Boolean(submission.sameDayBooking),
        learnerCancellation: submission.learnerCancellation?.trim() || "",
        lateCancellation: submission.lateCancellation?.trim() || "",
        noShowPolicy: submission.noShowPolicy?.trim() || "",
        consultationEnabled: Boolean(submission.consultationEnabled),
        consultationDuration: submission.consultationDuration?.trim() || "",
        consultationPrice: submission.consultationPrice?.trim() || "",
        consultationPurpose: submission.consultationPurpose?.trim() || "",
        faqs: submission.faqs?.filter((faq) => faq?.question && faq?.answer) || [],
        introVideoName: submission.introVideoName?.trim() || "",
      };
    } catch {
      return null;
    }
  })();
  const storedProfile = (() => {
    try {
      const stored = window.sessionStorage.getItem("tutoria_active_tutor_profile");
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object" || !parsed.name || parsed.name.trim() !== profileName) return null;
      window.sessionStorage.removeItem("tutoria_active_tutor_profile");
      return parsed;
    } catch {
      return null;
    }
  })();
  const serverProfile = (liveProfile || storedProfile) ? null : await fetch("/api/tutors")
    .then((response) => response.ok ? response.json() : { tutors: [] })
    .then((payload) => {
      const submission = Array.isArray(payload.tutors)
        ? payload.tutors.find((item) => ["pending_review", "published"].includes(String(item?.status)) && item?.displayName?.trim() === profileName)
        : null;
      if (!submission) return null;
      const sessionLength = submission.displayDuration || submission.sessionLengths?.[0] || 60;
      return {
        name: submission.displayName.trim(),
        role: submission.role?.trim() || "Independent tutor",
        tagline: submission.headline?.trim() || "A new tutor on Tutoria.",
        image: submission.photoUrl || "/images/tutor-profile-thu-ha.png",
        rating: 0,
        reviewCount: 0,
        lessons: 0,
        responseTime: "—",
        location: submission.location?.trim() || "Location not set",
        price: Number(submission.rates?.[String(sessionLength)] || 0),
        languages: submission.languages?.filter(Boolean) || [],
        subjects: submission.skills?.filter(Boolean) || [],
        about: [submission.about?.trim(), submission.professionalBackground?.trim()].filter(Boolean),
        learnerLevels: submission.learnerLevels?.filter(Boolean) || [],
        ageGroups: submission.ageGroups?.filter(Boolean) || [],
        teachingStyles: submission.teachingStyles?.filter(Boolean) || [],
        outcomes: submission.goals?.filter(Boolean) || [],
        typicalLesson: submission.lessonDescription?.trim() || "Each lesson is tailored to the learner’s goal, pace, and experience.",
        credentials: submission.credentials?.filter(Boolean) || [],
        portfolioUrl: submission.portfolioUrl?.trim() || "",
        sessionLengths: submission.sessionLengths?.filter((value) => Number.isFinite(Number(value))) || [],
        rates: submission.rates || {},
        displayDuration: submission.displayDuration,
        lessonFormat: submission.lessonFormat?.filter(Boolean) || [],
        availability: submission.availability?.filter(Boolean) || [],
        timeZone: submission.timeZone?.trim() || "",
        sameDayBooking: Boolean(submission.sameDayBooking),
        learnerCancellation: submission.learnerCancellation?.trim() || "",
        lateCancellation: submission.lateCancellation?.trim() || "",
        noShowPolicy: submission.noShowPolicy?.trim() || "",
        consultationEnabled: Boolean(submission.consultationEnabled),
        consultationDuration: submission.consultationDuration?.trim() || "",
        consultationPrice: submission.consultationPrice?.trim() || "",
        consultationPurpose: submission.consultationPurpose?.trim() || "",
        faqs: submission.faqs?.filter((faq) => faq?.question && faq?.answer) || [],
        introVideoName: submission.introVideoName?.trim() || "",
      };
    })
    .catch(() => null);
  const profile = liveProfile || storedProfile || submittedProfile || serverProfile || profiles.find((item) => item.name === profileName) || window.TUTORIA_GET_TUTOR_PROFILE?.(params.get("name")) || profiles[0];
  if (!profile) {
    revealTutorProfile();
    return;
  }
  const isCreatorProfile = Boolean(liveProfile || storedProfile || submittedProfile || serverProfile);
  const safeEvidenceUrl = (value) => {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };
  const credentialItems = (profile.credentials || []).map((credential) => typeof credential === "string"
    ? { title: credential, evidenceUrl: "" }
    : { title: credential?.title || "Credential", evidenceUrl: safeEvidenceUrl(credential?.evidenceUrl) }
  ).filter((credential) => credential.title);
  const isImageProof = (url) => /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url);

  const createProofViewer = () => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[100] hidden items-center justify-center bg-black/70 p-4 sm:p-8";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "proof-viewer-title");

    const panel = document.createElement("section");
    panel.className = "flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-2xl";
    const header = document.createElement("header");
    header.className = "flex items-start justify-between gap-6 border-b border-line px-5 py-5 sm:px-7";
    const titleGroup = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "text-xs font-semibold uppercase tracking-[0.16em] text-muted";
    eyebrow.textContent = "Tutor-provided evidence";
    const title = document.createElement("h2");
    title.id = "proof-viewer-title";
    title.className = "mt-1 text-xl font-semibold tracking-tight sm:text-2xl";
    titleGroup.append(eyebrow, title);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-canvas text-xl leading-none transition hover:border-ink";
    close.setAttribute("aria-label", "Close proof viewer");
    close.textContent = "×";
    header.append(titleGroup, close);

    const content = document.createElement("div");
    content.className = "min-h-0 flex-1 bg-canvas p-3 sm:p-5";
    const footer = document.createElement("footer");
    footer.className = "flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7";
    const note = document.createElement("p");
    note.className = "text-sm text-muted";
    note.textContent = "Evidence is supplied by the tutor.";
    const openOriginal = document.createElement("a");
    openOriginal.className = "inline-flex shrink-0 items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90";
    openOriginal.target = "_blank";
    openOriginal.rel = "noreferrer";
    openOriginal.textContent = "Open original ↗";
    footer.append(note, openOriginal);
    panel.append(header, content, footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let returnFocus = null;
    const closeViewer = () => {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
      document.body.style.overflow = "";
      returnFocus?.focus();
    };
    close.addEventListener("click", closeViewer);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closeViewer(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeViewer();
    });

    return (credential, trigger) => {
      returnFocus = trigger;
      title.textContent = credential.title;
      openOriginal.href = credential.evidenceUrl;
      content.replaceChildren();
      if (isImageProof(credential.evidenceUrl)) {
        const image = document.createElement("img");
        image.src = credential.evidenceUrl;
        image.alt = `Proof for ${credential.title}`;
        image.className = "h-full max-h-[540px] w-full rounded-xl object-contain";
        image.addEventListener("error", () => {
          content.replaceChildren(createEmbedFallback(credential.evidenceUrl));
        }, { once: true });
        content.appendChild(image);
      } else {
        content.appendChild(createEmbedFallback(credential.evidenceUrl));
      }
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      close.focus();
    };
  };
  const createEmbedFallback = (url) => {
    const frame = document.createElement("iframe");
    frame.src = url;
    frame.title = "Tutor credential evidence";
    frame.className = "h-[min(540px,calc(100vh-13rem))] w-full rounded-xl border border-line bg-white";
    frame.setAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
    return frame;
  };
  const openProofViewer = createProofViewer();

  const firstName = profile.name.split(" ")[0];
  const number = new Intl.NumberFormat("vi-VN");
  const formatVnd = (value) => `${number.format(value)} đ`;
  const roundToTen = (value) => Math.round(value / 10000) * 10000;
  const derivedPrices = {
    "20 minutes": formatVnd(roundToTen(profile.price * 0.4)),
    "30 minutes": formatVnd(roundToTen(profile.price * 0.6)),
    "50 minutes": formatVnd(roundToTen(profile.price * 0.85)),
    "60 minutes": formatVnd(profile.price),
    "90 minutes": formatVnd(roundToTen(profile.price * 1.4)),
  };
  const publishedDurations = Array.isArray(profile.sessionLengths) && profile.sessionLengths.length
    ? profile.sessionLengths.map(Number).filter(Number.isFinite)
    : [30, 50, 60, 90];
  const primaryDuration = publishedDurations.includes(Number(profile.displayDuration))
    ? Number(profile.displayDuration)
    : publishedDurations.includes(60) ? 60 : publishedDurations[0];
  const prices = profile.rates
    ? Object.fromEntries(publishedDurations.map((duration) => [`${duration} minutes`, formatVnd(Number(profile.rates[String(duration)] || 0))]))
    : derivedPrices;
  const teachingSpaceFormat = `At ${firstName}'s teaching space`;
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const submittedAvailability = (profile.availability || []).map(String).map((slot) => {
    const [start, , dayIndex] = slot.split("-");
    return { start, day: dayNames[Number(dayIndex)] };
  }).filter((slot) => slot.start && slot.day);
  const availabilityLabel = liveProfile
    ? (Array.isArray(profile.bookableSessions) && profile.bookableSessions.length ? "Available Sessions" : "No bookable Sessions")
    : submittedAvailability.length
    ? `Available ${[...new Set(submittedAvailability.map((slot) => slot.day))].join(" & ")}`
    : "Availability not set";
  const timeZoneLabel = (() => {
    const [gmt] = String(profile.timeZone || "").split(" - ");
    const city = String(profile.location || "").split(",")[0].trim();
    return city && gmt ? `${city} time, ${gmt}` : profile.timeZone || "Time zone not set";
  })();
  const selectedFormats = profile.lessonFormat?.length ? profile.lessonFormat : ["Online"];
  const supportsOnline = selectedFormats.includes("Online");
  const supportsInPerson = selectedFormats.some((format) => format !== "Online");
  const formatLocationSummary = supportsOnline && supportsInPerson
    ? `${profile.location} and online`
    : supportsOnline
      ? "Online"
      : profile.location;
  const formatDefinitions = {
    Online: { value: "Online", label: "Online", icon: "video", detail: "Tutoria classroom" },
    "At my teaching space": { value: teachingSpaceFormat, label: `${firstName}'s space`, icon: "house", detail: profile.location },
    "At learners' location": { value: "At your location", label: "Your location", icon: "navigation", detail: "Enter an address" },
    "Public place": { value: "Public place", label: "Public place", icon: "building-2", detail: "Choose a meeting place" },
  };

  const activeTutorProfile = {
    ...profile,
    firstName,
    prices,
    selectedPrice: prices[`${primaryDuration} minutes`],
    consultationPrice: prices["20 minutes"],
    teachingSpaceFormat,
    formatOptions: selectedFormats.map((format) => formatDefinitions[format]).filter(Boolean),
  };
  try {
    window.TUTORIA_ACTIVE_TUTOR_PROFILE = activeTutorProfile;
  } catch {
    // Some embedded browser contexts keep window non-extensible.
  }
  document.documentElement.dataset.activeTutorProfile = JSON.stringify(activeTutorProfile);

  const setText = (element, value) => {
    if (element && value !== undefined && value !== null) element.textContent = String(value);
  };
  const findText = (selector, text) =>
    [...document.querySelectorAll(selector)].find((element) => element.textContent.trim() === text);
  const SHOW_TEXT = 4;
  const replaceExact = (from, to) => {
    const walker = document.createTreeWalker(document.body, SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.nodeValue.trim() === from) node.nodeValue = node.nodeValue.replace(from, to);
    });
  };
  const replacePhrase = (from, to) => {
    const walker = document.createTreeWalker(document.body, SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.nodeValue.includes(from)) node.nodeValue = node.nodeValue.replaceAll(from, to);
    });
  };
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character]));
  const chips = (items) =>
    items.map((item) => `<span class="rounded-full bg-canvas px-3 py-2 text-sm">${escapeHtml(item)}</span>`).join("");
  const setChipGroup = (headingText, items) => {
    const heading = findText("h3", headingText);
    const row = heading?.closest(".grid")?.querySelector(".flex.flex-wrap.gap-2");
    if (row) row.innerHTML = chips(items);
  };
  const plainLanguage = (language) => language.replace(/\s*\((.*?)\)\s*$/, "");
  const displayResponse = profile.responseTime
    .replace(/^about\s+/i, "~")
    .replace(/^under\s+/i, "< ")
    .replace(/^within\s+/i, "< ");

  document.title = `${profile.name} - Charcoal & Gray Theme | Tutoria`;
  replaceExact("Thu Ha", profile.name);
  replaceExact("Cooking instructor", profile.role);
  replaceExact("Cooking Instructor", profile.role);
  replaceExact("Cooking", profile.subjects[0] || profile.role);
  replaceExact("4.9", String(profile.rating));
  replaceExact("(203 reviews)", `(${number.format(profile.reviewCount)} reviews)`);
  replaceExact("Reviews (203)", `Reviews (${number.format(profile.reviewCount)})`);
  replaceExact("203 reviews from completed lessons", `${number.format(profile.reviewCount)} reviews from completed lessons`);
  replaceExact("View all 203 reviews", `View all ${number.format(profile.reviewCount)} reviews`);
  replaceExact("648", number.format(profile.lessons));
  replaceExact("648 lessons taught", `${number.format(profile.lessons)} lessons taught`);
  replaceExact("~1 hour", displayResponse);
  replaceExact("Hoan Kiem, Ha Noi", profile.location);
  replaceExact("Practical guidance for confident, independent cooking.", `${firstName}'s approach to learning`);

  replaceExact("About Thu", `About ${firstName}`);
  replaceExact("Meet Thu and see how lessons work", `Meet ${firstName} and see how lessons work`);
  replaceExact("What learning with Thu looks like", `What learning with ${firstName} looks like`);
  replacePhrase("Thu’s teaching style", `${firstName}'s teaching style`);
  replacePhrase("whether Thu is the right fit", `whether ${firstName} is the right fit`);
  replacePhrase("with Thu.", `with ${firstName}.`);
  replacePhrase("Thu will send", `${firstName} will send`);
  replaceExact("Book with Thu", `Book with ${firstName}`);
  replaceExact("Message Thu", `Message ${firstName}`);
  replacePhrase("Thu usually replies", `${firstName} usually replies`);
  replacePhrase("sessions with Thu are booked", `sessions with ${firstName} are booked`);
  replacePhrase("Note for Thu", `Note for ${firstName}`);
  replacePhrase("Your booking request has been sent to Thu Ha.", `Your booking request has been sent to ${profile.name}.`);

  const images = [...document.images].filter((image) => image.alt.includes("Thu Ha") || image.alt === "Thu Ha");
  images.forEach((image) => {
    image.src = profile.image;
    image.alt = `${profile.name}, ${profile.role}`;
  });

  setText(document.querySelector("h1"), profile.name);
  setText(findText("span", profile.name), profile.name);
  setText(findText("span", profile.role), profile.role);
  setText(document.getElementById("bookingSummaryTutorName"), profile.name);
  setText(document.getElementById("bookingSummaryTutorMeta"), `${profile.role}${profile.rating ? ` · ${profile.rating}` : ""}`);
  setText(document.getElementById("bookingRequestSentTitle"), `Your booking request has been sent to ${profile.name}.`);
  setText(document.querySelector(".mt-6.max-w-3xl.text-base"), profile.tagline);

  const aboutCopy = document.querySelector("#panel-about .space-y-4");
  if (aboutCopy) aboutCopy.innerHTML = profile.about.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  if (aboutCopy && (credentialItems.length || profile.portfolioUrl)) {
    const creatorDetails = document.createElement("section");
    creatorDetails.className = "border-t border-line pt-10";
    if (credentialItems.length) {
      const eyebrow = document.createElement("p");
      eyebrow.className = "text-xs font-semibold uppercase tracking-[0.16em] text-muted";
      eyebrow.textContent = "Credentials";
      const heading = document.createElement("h3");
      heading.className = "mt-3 text-3xl font-semibold tracking-[-0.03em]";
      heading.textContent = "Credentials & highlights";
      const list = document.createElement("div");
      list.className = "mt-5 grid gap-3 md:grid-cols-2";
      credentialItems.forEach((credential) => {
        const item = credential.evidenceUrl ? document.createElement("button") : document.createElement("span");
        item.className = "group flex min-h-[84px] items-center justify-between gap-4 rounded-2xl border border-line bg-canvas px-4 py-4 text-left transition hover:border-ink";
        const copy = document.createElement("span");
        copy.className = "min-w-0";
        const title = document.createElement("strong");
        title.className = "block text-sm font-semibold";
        title.textContent = credential.title;
        copy.appendChild(title);
        if (credential.evidenceUrl) {
          item.type = "button";
          item.title = `View proof for ${credential.title}`;
          item.setAttribute("aria-label", `View proof for ${credential.title}`);
          const action = document.createElement("span");
          action.className = "shrink-0 text-xs font-semibold text-muted transition group-hover:text-ink";
          action.textContent = "View proof";
          item.append(copy, action);
          item.addEventListener("click", () => openProofViewer(credential, item));
        } else {
          item.append(copy);
        }
        list.appendChild(item);
      });
      creatorDetails.append(eyebrow, heading, list);
    }
    if (profile.portfolioUrl) {
      const link = document.createElement("a");
      link.href = profile.portfolioUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "mt-5 inline-flex items-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold transition hover:border-ink";
      link.textContent = "View portfolio and teaching materials ↗";
      creatorDetails.appendChild(link);
    }
    aboutCopy.closest("section")?.after(creatorDetails);
  }

  const languageLabel = findText("p", "Languages");
  const languageRow = languageLabel?.nextElementSibling;
  if (languageRow) {
    languageRow.innerHTML = profile.languages
      .map((language) => {
        const match = language.match(/^(.*?)\s*\((.*?)\)$/);
        return match
          ? `<span class="rounded-full border border-line bg-white px-3 py-2 text-sm">${escapeHtml(match[1])} <span class="text-muted">(${escapeHtml(match[2])})</span></span>`
          : `<span class="rounded-full border border-line bg-white px-3 py-2 text-sm">${escapeHtml(language)}</span>`;
      })
      .join("");
  }

  const factItems = [...document.querySelectorAll("#panel-about .border-t.border-line.pt-6 span")];
  setText(factItems[1]?.lastChild, profile.languages.map(plainLanguage).join(" and "));
  setText(factItems[2]?.lastChild, formatLocationSummary);

  setChipGroup("Skills & specialties", profile.subjects);
  setChipGroup("Learner levels", profile.learnerLevels);
  setChipGroup("Who I teach", profile.ageGroups);
  setChipGroup("Teaching style", profile.teachingStyles);

  const outcomesHeading = findText("h2", "What you can achieve");
  const outcomesList = outcomesHeading?.parentElement?.querySelector("ul");
  if (outcomesList) {
    outcomesList.innerHTML = profile.outcomes
      .map((outcome) => `
        <li class="flex items-center gap-4 py-5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas">
            <i data-lucide="check" class="h-4 w-4"></i>
          </span>
          <p class="font-medium">${escapeHtml(outcome)}</p>
        </li>
      `)
      .join("");
  }
  const typicalLessonHeading = findText("h2", "Typical lesson");
  if (typicalLessonHeading) {
    const container = typicalLessonHeading.parentElement;
    if (container && !String(profile.typicalLesson || "").trim()) {
      container.remove();
    } else {
      setText(container.querySelector("p"), profile.typicalLesson);
    }
  }

  document.querySelectorAll(".rate-card").forEach((card) => {
    const duration = card.dataset.duration;
    if (!duration || !prices[duration]) {
      card.style.display = "none";
      return;
    }
    card.dataset.price = prices[duration];
    setText(card.querySelector(".text-2xl"), prices[duration].replace(/\s*đ$/, ""));
  });
  document.querySelectorAll(".sidebar-duration").forEach((button) => {
    const duration = button.dataset.duration;
    if (!duration || !prices[duration]) {
      button.style.display = "none";
      return;
    }
    button.dataset.price = prices[duration];
  });
  const primaryPrice = prices[`${primaryDuration} minutes`];
  setText(document.getElementById("sidebarPrice"), primaryPrice);
  setText(document.getElementById("mobilePrice"), primaryPrice);
  setText(document.getElementById("reviewTotal"), primaryPrice);

  const firstLessonOriginal = findText(".line-through", "180.000 đ");
  setText(firstLessonOriginal, primaryPrice);
  setText(document.querySelector(".price-signal"), formatVnd(Math.round(profile.price * 0.88)));
  setText(findText("span", "20 minutes"), `${primaryDuration} minutes`);
  const consultationPrice = [...document.querySelectorAll(".text-3xl.font-semibold.tracking-tight")].find((element) => element.textContent.trim() === "120.000 đ");
  setText(consultationPrice, primaryPrice);

  document.querySelectorAll("select option").forEach((option) => {
    if (option.textContent.trim() === "At Thu's teaching space") option.textContent = teachingSpaceFormat;
  });

  if (isCreatorProfile) {
    if (liveProfile) {
    replaceExact("Verified", "Not verified");
      replaceExact("ID verified", profile.disclosure || "Identity not verified");
    } else {
      replaceExact("Verified", "New tutor");
      replaceExact("ID verified", "Profile submitted");
    }
    replaceExact("Available this week", availabilityLabel);
    if (!liveProfile && submittedAvailability[0]) replaceExact("Next: Mon, 09:00", `Next: ${submittedAvailability[0].day}, ${submittedAvailability[0].start}`);

    replaceExact("Ha Noi and online", formatLocationSummary);
    const formatSection = findText("h2", "Choose where learning happens")?.closest("section");
    const formatGrid = formatSection?.querySelector(".mt-7.grid");
    const visibleFormatTitles = new Set(selectedFormats.map((format) => ({
      Online: "Online",
      "At my teaching space": "At my teaching space",
      "At learners' location": "At your location",
      "Public place": "Public place",
    })[format]));
    [...(formatGrid?.children || [])].forEach((card) => {
      const title = card.querySelector("h3")?.textContent?.trim();
      if (!title) return;
      const isOffered = visibleFormatTitles.has(title);
      const icon = card.querySelector("span");
      const label = card.querySelector("h3");
      card.style.opacity = "1";
      card.style.filter = "none";
      card.style.transition = "background-color 160ms ease, box-shadow 160ms ease";
      card.setAttribute("aria-label", isOffered ? `${title} available` : `${title} unavailable`);
      if (isOffered) {
        card.style.backgroundColor = "rgba(255, 255, 255, 0.055)";
        card.style.boxShadow = "none";
        card.style.position = "relative";
        if (icon) icon.style.opacity = "1";
        if (label) label.style.color = "rgb(244, 242, 236)";
        if (!card.querySelector(".format-status")) {
          const status = document.createElement("span");
          status.className = "format-status ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]";
          status.style.backgroundColor = "rgba(244, 242, 236, 0.12)";
          status.style.color = "rgb(244, 242, 236)";
          status.textContent = "Available";
          card.appendChild(status);
        }
      } else {
        card.style.backgroundColor = "rgba(255, 255, 255, 0.012)";
        card.style.boxShadow = "none";
        if (icon) icon.style.opacity = "0.42";
        if (label) label.style.color = "rgba(244, 242, 236, 0.42)";
      }
    });
    if (formatGrid && selectedFormats.length === 1) {
      formatGrid.className = "mt-7 grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-2";
      const formatNote = formatSection?.querySelector(":scope > div span.text-sm.text-muted");
      if (formatNote) formatNote.textContent = `${selectedFormats[0]} only`;
    }
    const formatSelect = document.getElementById("sidebarFormat");
    if (formatSelect) formatSelect.innerHTML = activeTutorProfile.formatOptions.map((format) => `<option>${escapeHtml(format.value)}</option>`).join("");

    if (!profile.introVideoName) {
      const videoButton = document.querySelector('button[aria-label="Play introduction video"], button:has(i[data-lucide="play"])');
      videoButton?.parentElement?.style.setProperty("grid-template-columns", "1fr");
      videoButton?.remove();
    }

    const reviewPanel = document.getElementById("panel-reviews");
    if (reviewPanel && profile.reviewCount === 0) {
      reviewPanel.querySelectorAll("article").forEach((article) => article.remove());
      reviewPanel.querySelectorAll(".mt-7.grid").forEach((summary) => summary.remove());
      const headingSection = reviewPanel.querySelector("section");
      if (headingSection && !headingSection.querySelector(".empty-reviews")) {
        const empty = document.createElement("p");
        empty.className = "empty-reviews mt-7 text-sm text-muted";
        empty.textContent = "Reviews will appear here after completed lessons.";
        headingSection.appendChild(empty);
      }
    }

    const availabilityPanel = document.getElementById("panel-availability");
    if (availabilityPanel) {
      setText(findText("p", "Ha Noi time, GMT+7"), timeZoneLabel);
      if (liveProfile) {
        const sessions = Array.isArray(profile.bookableSessions) ? profile.bookableSessions.filter((session) => session?.startsAt && session?.endsAt) : [];
        const wrapper = availabilityPanel.querySelector(".min-w-\\[780px\\]");
        if (wrapper && sessions.length) {
          const sessionRows = sessions.map((session) => {
            const start = new Date(session.startsAt);
            const end = new Date(session.endsAt);
            const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(start);
            const time = `${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(start)}–${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(end)}`;
            return `<div class="flex items-center justify-between gap-4 border-b border-line p-4"><div><div class="font-medium">${escapeHtml(date)}</div><div class="mt-1 text-xs text-muted">${escapeHtml(time)} · ${escapeHtml(profile.teachingFormat === "online" ? "Online" : formatLocationSummary)}</div></div><span class="rounded-xl bg-accent/55 px-3 py-2 text-xs font-semibold">Open</span></div>`;
          }).join("");
          wrapper.innerHTML = `
            <div class="border-b border-line bg-canvas p-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Bookable Sessions</div>
            ${sessionRows}`;
        } else if (wrapper) {
          wrapper.innerHTML = '<div class="p-6 text-sm text-muted">No bookable Sessions are available for this tutor right now.</div>';
        }
      } else {
        const selectedSlots = new Set((profile.availability || []).map(String));
        const availabilityRows = [...availabilityPanel.querySelectorAll(".availability-cell")];
        ["09:00-12:00", "14:00-18:00", "18:00-21:00"].forEach((slot, rowIndex) => {
          for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            const cell = availabilityRows[rowIndex * 8 + dayIndex + 1];
            if (!cell) continue;
            const isOpen = selectedSlots.has(`${slot}-${dayIndex}`);
            cell.outerHTML = isOpen
              ? '<button class="availability-cell m-2 rounded-xl bg-accent/55 font-semibold hover:bg-accent">Open</button>'
              : '<div class="availability-cell flex items-center justify-center text-muted">—</div>';
          }
        });
      }
    }

    const policySection = findText("h3", "Booking rules & cancellation policy")?.parentElement;
    if (policySection) {
      const policyValues = policySection.querySelectorAll(".text-muted");
      setText(policyValues[0], profile.sameDayBooking ? "Available when the tutor has an open time." : "Not available.");
      setText(policyValues[1], profile.noShowPolicy || "Not set");
      setText(policyValues[2], profile.learnerCancellation || "Not set");
    }

    const firstLessonLabel = findText("span", "First lesson price");
    firstLessonLabel?.closest("section")?.remove();
    const futureSessions = Array.isArray(profile.bookableSessions)
      ? profile.bookableSessions
        .filter((session) => session?.status === undefined || session.status === "scheduled")
        .filter((session) => Number.isFinite(Date.parse(session.startsAt)) && Number.isFinite(Date.parse(session.endsAt)) && Date.parse(session.startsAt) > Date.now() && Date.parse(session.endsAt) > Date.parse(session.startsAt))
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
      : [];
    const firstSession = futureSessions[0] || null;
    if (firstSession?.startsAt) {
      const firstStart = new Date(firstSession.startsAt);
      const nextAvailable = `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(firstStart)} · ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(firstStart)}`;
      if (liveProfile) {
        const availabilitySignal = document.querySelector(".availability-signal");
        const nextSignal = availabilitySignal?.parentElement?.querySelector(".mt-1.text-xs.text-muted");
        setText(nextSignal, `Next: ${new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(firstStart)}, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(firstStart)}`);
      }
      replaceExact("Mon, Jul 27 · 09:00", nextAvailable);
    } else {
      if (liveProfile) {
        const availabilitySignal = document.querySelector(".availability-signal");
        const nextSignal = availabilitySignal?.parentElement?.querySelector(".mt-1.text-xs.text-muted");
        setText(nextSignal, "No bookable Sessions");
      }
      replaceExact("Mon, Jul 27 · 09:00", "No bookable Sessions");
    }
    replaceExact("Shown in Ha Noi time (GMT+7)", `Shown in ${timeZoneLabel}`);
    replaceExact(`${firstName} usually replies within an hour`, "Response time will appear after the first conversations.");

    const consultationLabel = findText("p", "Short consultation");
    const consultationSection = consultationLabel?.closest("section");
    if (consultationSection && !profile.consultationEnabled) consultationSection.remove();
    if (consultationSection && profile.consultationEnabled) {
      const duration = profile.consultationDuration || "Not set";
      const price = profile.consultationPrice || "Not set";
      setText(consultationSection.querySelector("h3"), profile.consultationPurpose || "Short consultation");
      setText(consultationSection.querySelector(".mt-3.max-w-2xl"), `A ${duration.replace(" minutes", "-minute")} consultation with ${firstName}.`);
      consultationSection.querySelector(".mt-6.flex.flex-wrap")?.remove();
      setText(consultationSection.querySelector(".uppercase.tracking-\\[0\\.14em\\]"), "Consultation");
      setText(consultationSection.querySelector(".flex.items-center.justify-between span"), duration);
      setText(consultationSection.querySelector(".text-3xl.font-semibold.tracking-tight"), price);
    }

    const faqPanel = document.getElementById("panel-faq");
    if (faqPanel && Array.isArray(profile.faqs)) {
      const faqItems = [...faqPanel.querySelectorAll(".faq-item")];
      faqItems.forEach((item, index) => {
        const faq = profile.faqs[index];
        if (!faq) {
          item.remove();
          return;
        }
        setText(item.querySelector(".faq-button"), faq.question);
        const icon = document.createElement("i");
        icon.dataset.lucide = "plus";
        icon.className = "faq-icon h-5 w-5 shrink-0 transition";
        item.querySelector(".faq-button")?.appendChild(icon);
        setText(item.querySelector(".faq-answer"), faq.answer);
      });
    }
  }

  const summaryMeta = [...document.querySelectorAll("#bookingSummary p")].find((element) => element.textContent.includes("·"));
  setText(summaryMeta, `${profile.role} · ${profile.rating}`);
  revealTutorProfile();
})().catch(revealTutorProfile);
