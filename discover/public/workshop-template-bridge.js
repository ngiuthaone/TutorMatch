(() => {
  const replaceEverywhere = (from, to) => {
    if (!from || !to) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach((text) => {
      if (text.nodeValue?.includes(from)) text.nodeValue = text.nodeValue.split(from).join(to);
    });
  };

  const setText = (selector, value, index = 0) => {
    const target = document.querySelectorAll(selector)[index];
    if (target && value) target.textContent = value;
  };

  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character]);

  const imageSources = (event) => [...new Set([event.image, event.galleryImage, ...(event.plan || []).map((item) => item.image)].filter(Boolean))];

  const formatPrice = (price) => price === "Free" ? "Free" : price;

  const profileHrefFor = (name) => `/user/${encodeURIComponent(name)}`;

  const currentAccountId = () => {
    try {
      const account = JSON.parse(window.localStorage.getItem("tutoria_signup") || "{}");
      return account.completed && account.email ? String(account.email).trim().toLowerCase() : "";
    } catch {
      return "";
    }
  };

  const setupOwnerEditButton = (event) => {
    document.getElementById("ownerEditWorkshop")?.remove();
    const creatorId = event.creatorId ? String(event.creatorId).trim().toLowerCase() : "";
    if (!creatorId || creatorId !== currentAccountId()) return;

    const actions = document.querySelector("header .flex.items-center.gap-2");
    if (!actions) return;

    const editButton = document.createElement("a");
    editButton.id = "ownerEditWorkshop";
    editButton.href = `/events/new?edit=${encodeURIComponent(event.slug)}`;
    editButton.target = "_top";
    editButton.className = "flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-muted hover:bg-white/[0.06] hover:text-white sm:px-4";
    editButton.setAttribute("aria-label", `Edit ${event.title}`);
    editButton.innerHTML = '<i data-lucide="pencil" class="h-4 w-4"></i><span class="hidden sm:inline">Edit</span>';
    actions.prepend(editButton);
    window.lucide?.createIcons();
  };

  const makeProfileTrigger = (element, href, label) => {
    if (!element) return;
    element.setAttribute("role", "link");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", label);
    element.style.cursor = "pointer";
    element.onclick = () => {
      window.parent.location.href = href;
    };
    element.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.parent.location.href = href;
    };
  };

  const setupHostProfileLinks = (event) => {
    const href = profileHrefFor(event.host);
    const hostSection = document.getElementById("host-location");
    const hostImage = hostSection?.querySelector("img");
    const hostName = hostSection?.querySelector("h2");
    const viewProfileButton = Array.from(hostSection?.querySelectorAll("button") || []).find((button) => button.textContent?.trim() === "View profile");

    makeProfileTrigger(hostImage, href, `View ${event.host} profile`);
    makeProfileTrigger(hostName, href, `View ${event.host} profile`);

    if (viewProfileButton) {
      const link = document.createElement("a");
      link.href = href;
      link.target = "_top";
      link.className = viewProfileButton.className;
      link.textContent = "View profile";
      link.setAttribute("aria-label", `View ${event.host} profile`);
      viewProfileButton.replaceWith(link);
    }
  };

  const setupHeader = () => {
    const exploreLink = document.querySelector("header a");
    if (exploreLink) {
      exploreLink.href = "/events";
      exploreLink.target = "_top";
      exploreLink.rel = "noopener";
      exploreLink.setAttribute("aria-label", "Back to events");
      exploreLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.parent.location.href = "/events";
      });
    }

    if (!document.getElementById("tutoria-responsive-event-header")) {
      const style = document.createElement("style");
      style.id = "tutoria-responsive-event-header";
      style.textContent = `
        @media (max-width: 520px) {
          header > div {
            height: 56px !important;
            padding-left: 14px !important;
            padding-right: 14px !important;
          }

          header a[aria-label="Back to events"] {
            min-width: 0;
            max-width: 42vw;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          header button {
            width: 40px;
            height: 40px;
            flex: 0 0 40px;
          }

          header #saveBtn {
            width: 40px;
            padding-left: 0;
            padding-right: 0;
            justify-content: center;
          }

          header #saveBtn span {
            display: none;
          }

          main > section:first-child {
            padding-top: 28px !important;
          }

          main > section.sticky {
            top: 56px !important;
          }
        }
      `;
      document.head.append(style);
    }
  };

  const syncWorkshopPlanHeight = () => {
    const planList = document.getElementById("workshopPlanList");
    const previewCard = document.getElementById("workshopPlanPreview")?.parentElement;
    const previewImage = document.getElementById("workshopPlanPreview");
    const steps = planList?.querySelectorAll("[data-plan-step]");
    if (!planList || !previewCard || !previewImage || !steps?.length) return;

    planList.style.removeProperty("display");
    planList.style.removeProperty("grid-template-rows");
    planList.style.removeProperty("gap");
    planList.style.removeProperty("height");
    steps.forEach((step) => {
      step.style.removeProperty("height");
      step.style.removeProperty("margin-top");
    });

    previewCard.style.removeProperty("display");
    previewCard.style.removeProperty("height");
    previewImage.style.removeProperty("aspect-ratio");
    previewImage.style.removeProperty("flex");

    if (!window.matchMedia("(min-width: 1024px)").matches) {
      return;
    }

    previewCard.style.display = "flex";
    previewCard.style.flexDirection = "column";
    previewCard.style.height = `${planList.getBoundingClientRect().height}px`;
    previewImage.style.aspectRatio = "auto";
    previewImage.style.flex = "1 1 0%";
  };

  const renderWorkshopPlan = (event, primaryImage) => {
    const plan = event.plan || [];
    const planList = document.getElementById("workshopPlanList");
    const preview = document.getElementById("workshopPlanPreview");
    const title = document.getElementById("workshop-plan-title");
    const intro = document.getElementById("workshopPlanIntro");
    const duration = document.getElementById("workshopPlanDuration");
    const previewTitle = document.getElementById("workshopPlanPreviewTitle");
    const previewTime = document.getElementById("workshopPlanPreviewTime");
    const previewCopy = document.getElementById("workshopPlanPreviewCopy");

    if (!planList || !preview || !plan.length) return;

    if (title) title.textContent = event.subtitle || event.title;
    if (intro) intro.textContent = event.about?.[0] || event.note || event.subtitle || "";
    if (duration) duration.textContent = event.duration || "";

    planList.innerHTML = plan.map((item, index) => {
      const image = item.image || primaryImage || "";
      return `<article tabindex="0" data-plan-step="${index + 1}" data-active="${index === 0}" class="workshop-plan-step rounded-[24px] border border-line bg-white/[0.02] p-4 sm:p-5 cursor-pointer outline-none focus:ring-2 focus:ring-white/20">
        <div class="flex gap-4">
          <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white/[0.025] text-sm font-semibold text-white workshop-plan-number">${String(index + 1).padStart(2, "0")}</div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex items-center gap-3">
                  <h3 class="text-lg font-medium tracking-[-0.02em] text-white">${escapeHtml(item.title)}</h3>
                  <span class="workshop-plan-arrow hidden text-accent sm:inline-flex">↗</span>
                </div>
                <p class="mt-2 text-sm leading-7 text-muted">${escapeHtml(item.description)}</p>
              </div>
              <div class="flex items-center gap-3 sm:ml-4 sm:block sm:text-right">
                <div class="h-14 w-20 overflow-hidden rounded-2xl border border-white/10">
                  <img src="${escapeHtml(image)}" alt="${escapeHtml(`${event.title} - ${item.title}`)}" class="h-full w-full object-cover" />
                </div>
                <p class="mt-2 text-sm font-medium text-muted">${escapeHtml(item.duration)}</p>
              </div>
            </div>
          </div>
        </div>
      </article>`;
    }).join("");

    const previewOverlay = preview.querySelector(".absolute.inset-x-0.bottom-0");
    preview.querySelectorAll("[data-plan-preview]").forEach((image) => image.remove());
    plan.forEach((item, index) => {
      const image = document.createElement("img");
      image.src = item.image || primaryImage || "";
      image.alt = `${event.title} - ${item.title}`;
      image.className = `workshop-plan-preview-image${index === 0 ? " is-active" : ""}`;
      image.dataset.planPreview = String(index + 1);
      preview.insertBefore(image, previewOverlay);
    });

    const activate = (stepId) => {
      const index = Number(stepId) - 1;
      const item = plan[index];
      if (!item) return;
      planList.querySelectorAll("[data-plan-step]").forEach((step) => {
        step.dataset.active = String(step.dataset.planStep === String(stepId));
      });
      preview.querySelectorAll("[data-plan-preview]").forEach((image) => {
        image.classList.toggle("is-active", image.dataset.planPreview === String(stepId));
      });
      if (previewTitle) previewTitle.textContent = item.title;
      if (previewTime) previewTime.textContent = item.duration;
      if (previewCopy) previewCopy.textContent = item.description;
    };

    planList.querySelectorAll("[data-plan-step]").forEach((step) => {
      const select = () => activate(step.dataset.planStep);
      step.addEventListener("mouseenter", select);
      step.addEventListener("focus", select);
      step.addEventListener("click", select);
    });
    activate(1);
  };

  const renderSchedule = (event) => {
    return;
    const section = document.getElementById("schedule");
    const panel = section?.querySelector(":scope > div");
    const sessions = event.sessions || [];
    if (!section || !panel) return;

    const parseDate = (value) => {
      const vietnameseDate = String(value).match(/(\d{1,2})\s*thg\s*(\d{1,2}),?\s*(\d{4})/i);
      if (vietnameseDate) return new Date(Number(vietnameseDate[3]), Number(vietnameseDate[2]) - 1, Number(vietnameseDate[1]));
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const datedSessions = sessions.map((session, index) => ({ ...session, index, dateObject: parseDate(session.date) })).filter((session) => session.dateObject);
    if (!datedSessions.length) {
      panel.innerHTML = `<div class="border-b border-line pb-8"><p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Schedule</p><h2 class="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Choose a session.</h2></div><p class="mt-8 text-sm text-muted">Session details will be shared by the host.</p>`;
      return;
    }

    const monthKeys = [...new Set(datedSessions.map((session) => `${session.dateObject.getFullYear()}-${session.dateObject.getMonth()}`))];
    const calendars = monthKeys.map((monthKey) => {
      const [year, month] = monthKey.split("-").map(Number);
      const first = new Date(year, month, 1);
      const offset = (first.getDay() + 6) % 7;
      const totalDays = new Date(year, month + 1, 0).getDate();
      const days = Array.from({ length: offset + totalDays }, (_, index) => index - offset + 1);
      const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(first);
      return `<div class="rounded-[24px] border border-line bg-white/[0.02] p-4 sm:p-5"><p class="mb-4 text-center text-base font-semibold text-white">${label}</p><div class="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.12em] text-quiet"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="mt-3 grid grid-cols-7 gap-1">${days.map((day) => {
        if (day < 1) return '<span class="min-h-14"></span>';
        const matches = datedSessions.filter((session) => session.dateObject.getFullYear() === year && session.dateObject.getMonth() === month && session.dateObject.getDate() === day);
        if (!matches.length) return `<span class="min-h-14 rounded-xl p-2 text-xs text-quiet">${day}</span>`;
        return `<button type="button" data-created-session="${matches[0].index}" class="min-h-14 rounded-xl border border-accent/35 bg-accent/10 p-2 text-left text-white transition hover:bg-accent/20"><span class="block text-sm font-semibold">${day}</span><span class="mt-1 block truncate text-[10px] text-accent">${escapeHtml(matches[0].times?.[0] || "Available")}</span></button>`;
      }).join("")}</div></div>`;
    }).join("");

    panel.innerHTML = `<div class="border-b border-line pb-8"><p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Schedule</p><h2 class="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Choose a session.</h2><p class="mt-3 max-w-2xl text-sm leading-6 text-muted">Only dates published by the host are available.</p></div><div class="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><div class="grid gap-4 sm:grid-cols-2">${calendars}</div><aside id="createdSessionDetail" class="rounded-[24px] border border-line bg-white/[0.02] p-5 lg:sticky lg:top-24"></aside></div>`;
    const detail = panel.querySelector("#createdSessionDetail");
    const selectSession = (index) => {
      const session = sessions[index];
      if (!session || !detail) return;
      detail.innerHTML = `<p class="text-[10px] uppercase tracking-[0.16em] text-quiet">Selected session</p><h3 class="mt-3 text-xl font-semibold text-white">${escapeHtml(session.date)}</h3><div class="mt-5 flex flex-wrap gap-2">${(session.times || []).map((time) => `<span class="rounded-full border border-line px-3 py-1.5 text-sm text-muted">${escapeHtml(time)}</span>`).join("")}</div>`;
      panel.querySelectorAll("[data-created-session]").forEach((button) => button.dataset.active = String(button.dataset.createdSession === String(index)));
    };
    panel.querySelectorAll("[data-created-session]").forEach((button) => button.addEventListener("click", () => selectSession(Number(button.dataset.createdSession))));
    selectSession(datedSessions[0].index);
  };

  const renderReviews = (event) => {
    const section = document.getElementById("reviews");
    const navLink = document.querySelector('[data-section-link][href="#reviews"]');
    const reviews = event.reviews || [];
    if (!section) return;
    if (!reviews.length) {
      section.remove();
      navLink?.remove();
      return;
    }
    section.innerHTML = `<div class="rounded-[32px] border border-line bg-white/[0.03] p-6 sm:p-8"><p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Reviews</p><div class="mt-6 grid gap-4 md:grid-cols-2">${reviews.map((review) => `<article class="rounded-[24px] border border-line bg-white/[0.02] p-5"><p class="text-sm leading-7 text-muted">“${escapeHtml(review.body)}”</p><p class="mt-5 text-sm font-semibold text-white">${escapeHtml(review.name)}</p><p class="mt-1 text-xs text-muted">${escapeHtml(review.attended)}</p></article>`).join("")}</div></div>`;
  };

  const renderHostAndLocation = (event) => {
    const section = document.getElementById("host-location");
    if (!section) return;
    const hostCard = section.querySelector(":scope > div > div:first-child");
    const locationCard = section.querySelector(":scope > div > div:nth-child(2)");
    const hostInfo = hostCard?.querySelector(".mt-7 > div");
    const hostImage = hostCard?.querySelector("img");
    if (hostImage) {
      hostImage.src = event.hostImage || "";
      hostImage.alt = event.host;
    }
    if (hostInfo) hostInfo.innerHTML = `<h2 class="text-[26px] font-semibold">${escapeHtml(event.host)}</h2><p class="mt-1 text-sm text-muted">${escapeHtml(event.hostRole || "")}</p><p class="mt-5 text-sm leading-7 text-muted">${escapeHtml(event.hostBio || "")}</p><div class="mt-5 flex gap-2"><a href="${profileHrefFor(event.host)}" target="_top" class="rounded-full border border-line px-4 py-2.5 text-xs">View profile</a></div>`;
    if (locationCard) {
      const heading = locationCard.querySelector("h2");
      const copy = locationCard.querySelector("h2 + p");
      if (heading) heading.textContent = event.studioName || event.location;
      if (copy) copy.textContent = event.address || event.location;
    }
  };

  const renderGallery = (event, images) => {
    const gallery = document.getElementById("galleryModal")?.querySelector("div");
    if (!gallery) return;
    gallery.innerHTML = images.map((source, index) => `<img src="${escapeHtml(source)}" alt="${escapeHtml(`${event.title} photo ${index + 1}`)}" class="${index === 0 ? "w-full rounded-xl sm:col-span-2" : "h-96 w-full rounded-xl object-cover"}" />`).join("");
  };

  const configureBooking = (event) => {
    window.tutoriaWorkshopTemplate?.configureBooking({
      price: event.price,
      capacity: event.capacity,
      date: event.sessions?.[0]?.date || event.date,
      time: event.sessions?.[0]?.times?.[0] || event.time,
      sessions: event.sessions || [],
    });
    const cancellation = event.cancellation?.[0] || "";
    document.querySelectorAll(".text-xs.leading-5.text-muted").forEach((paragraph) => {
      if (/Free cancellation up to|Cancel at least 24 hours/.test(paragraph.textContent || "")) paragraph.textContent = cancellation;
    });
    const participantCopy = document.querySelector("#bookingStep1 .rounded-\\[24px\\] .text-xs.text-muted");
    if (participantCopy) participantCopy.textContent = `Up to ${event.capacity} participant${event.capacity === 1 ? "" : "s"} per booking.`;
    const terms = document.querySelector("#bookingTermsCheckbox + span");
    if (terms) terms.textContent = cancellation || "I agree to the event cancellation policy.";
    const policyTitle = Array.from(document.querySelectorAll(".rounded-\\[20px\\] p.text-xs.font-semibold.text-white")).find((item) => item.textContent?.trim() === "Free cancellation");
    if (policyTitle) policyTitle.textContent = "Cancellation policy";
    const checkoutImage = document.querySelector("#bookingFlowModal img");
    if (checkoutImage) { checkoutImage.src = event.image; checkoutImage.alt = event.title; }
  };

  const applyEvent = (event) => {
    setupHeader();
    setupOwnerEditButton(event);

    const session = event.sessions?.[0];
    const time = session?.times?.[0] || event.time;
    const images = imageSources(event);
    const heroImages = document.querySelectorAll(".gallery-image");
    const primaryImage = images[0] || event.image;
    const formattedPrice = formatPrice(event.price);

    document.title = `${event.title} | Tutoria`;
    setText("h1", event.title);
    setText("main > section p.text-\\[17px\\]", event.subtitle);
    setText(".text-\\[24px\\].font-semibold", formattedPrice);
    setText("#bookingSessionSummary", session?.date || event.date);
    setText("#bookingSessionTime", time);
    setText("#mobileSessionSummary", `${event.date} · ${time}`);
    setText("#heroFormatBadge", event.type);
    setText("#heroLevelBadge", event.level);
    if (!event.reviewCount) {
      document.querySelector('i[data-lucide="star"]')?.closest("span.flex")?.remove();
      const checkoutRating = document.querySelector("#bookingFlowModal .min-w-0 .mt-1\\.5");
      if (checkoutRating) checkoutRating.remove();
    }

    replaceEverywhere("Pizza 4P’s Pizza-Making Workshop", event.title);
    replaceEverywhere("Stretch, top, bake, and enjoy your own artisan pizza with the Pizza 4P’s team.", event.subtitle);
    replaceEverywhere("Pizza 4P's Bao Khanh", event.studioName);
    replaceEverywhere("Pizza 4P’s Bao Khanh", event.studioName);
    replaceEverywhere("Hoan Kiem, Ha Noi", event.location);
    replaceEverywhere("650,000 đ", formattedPrice);
    replaceEverywhere("715.000 đ", formattedPrice);
    replaceEverywhere("6 spots", `${event.spotsLeft} spots`);
    replaceEverywhere("2.5 hours", event.duration);
    replaceEverywhere("4.9", String(event.rating));
    replaceEverywhere("214 reviews", `${event.reviewCount} reviews`);
    replaceEverywhere("Pizza 4P’s Workshop Team", event.host);
    replaceEverywhere("Pizza chefs and facilitators", event.hostRole);
    replaceEverywhere("The team guides each participant through dough stretching, topping balance, baking, and tasting.", event.hostBio);
    replaceEverywhere("In person", event.type);
    replaceEverywhere("Vietnamese and English", event.languages?.join(" and "));
    replaceEverywhere("10+", event.minimumAge);

    heroImages.forEach((image, index) => {
      image.src = images[index % Math.max(images.length, 1)] || primaryImage;
      image.alt = `${event.title} gallery image ${index + 1}`;
    });

    const galleryMain = document.querySelector(".gallery-image");
    if (galleryMain) galleryMain.src = primaryImage;
    renderGallery(event, images.length ? images : [primaryImage]);
    renderHostAndLocation(event);

    const factValues = document.querySelectorAll("#details .rounded-\\[32px\\] .text-\\[15px\\].font-medium");
    [event.type, event.duration, event.languages?.join(", "), event.minimumAge].forEach((value, index) => {
      if (factValues[index] && value) factValues[index].textContent = value;
    });
    const factRows = document.querySelectorAll("#details .rounded-\\[32px\\] .space-y-6 > div");
    [event.studioName, "", "", ""].forEach((copy, index) => {
      const detail = factRows[index]?.querySelectorAll("p")[2];
      if (detail) { detail.textContent = copy; detail.hidden = !copy; }
    });

    const overview = document.querySelector("#overview .space-y-5");
    if (overview && event.about?.length) overview.innerHTML = event.about.map((paragraph) => `<p>${paragraph}</p>`).join("");
    const overviewHeading = document.querySelector("#overview h2");
    if (overviewHeading) overviewHeading.textContent = event.note || event.subtitle;

    const lists = document.querySelectorAll("#details ul");
    [event.learn, event.included].forEach((items, index) => {
      if (lists[index] && items?.length) lists[index].innerHTML = items.map((item) => `<li>✓ ${item}</li>`).join("");
    });
    const bring = document.querySelector("#details .md\\:col-span-2 .mt-6");
    if (bring && event.bring?.length) bring.innerHTML = event.bring.map((item) => `<span>${item}</span>`).join("");

    const faqList = document.getElementById("faqList");
    if (faqList && event.faqs?.length) {
      faqList.innerHTML = event.faqs.map((faq, index) => `<article class="faq-item border-b border-line last:border-0" data-open="${index === 0}"><button class="flex w-full items-center justify-between py-6 text-left"><span class="text-[15px] font-medium">${faq.question}</span><span class="faq-icon text-lg leading-none text-muted">+</span></button><div class="faq-body"><div><p class="pb-6 text-sm leading-6 text-muted">${faq.answer}</p></div></div></article>`).join("");
      faqList.querySelectorAll(".faq-item > button").forEach((button) => button.onclick = () => {
        const item = button.closest(".faq-item");
        item.dataset.open = String(item.dataset.open !== "true");
      });
    }

    renderWorkshopPlan(event, primaryImage);
    renderReviews(event);
    configureBooking(event);
    window.requestAnimationFrame(() => {
      syncWorkshopPlanHeight();
      window.setTimeout(syncWorkshopPlanHeight, 100);
    });
    window.parent.postMessage({ type: "tutoria-workshop-height", height: document.documentElement.scrollHeight }, window.location.origin);
  };

  window.addEventListener("message", (message) => {
    if (message.origin !== window.location.origin || message.data?.type !== "tutoria-event-data") return;
    applyEvent(message.data.event);
  });

  new ResizeObserver(() => window.parent.postMessage({ type: "tutoria-workshop-height", height: document.documentElement.scrollHeight }, window.location.origin)).observe(document.body);
  window.addEventListener("resize", syncWorkshopPlanHeight);
})();
