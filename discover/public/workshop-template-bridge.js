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

  const imageSources = (event) => [...new Set([event.image, event.galleryImage, ...(event.plan || []).map((item) => item.image)].filter(Boolean))];

  const formatPrice = (price) => price === "Free" ? "Free" : price;

  const profileHrefFor = (name) => `/user/${encodeURIComponent(name)}`;

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

  const applyEvent = (event) => {
    setupHeader();

    const session = event.sessions?.[0];
    const time = session?.times?.[0] || event.time;
    const images = imageSources(event);
    const heroImages = document.querySelectorAll(".gallery-image");
    const planImages = document.querySelectorAll("[data-plan-preview]");
    const primaryImage = images[0] || event.image;
    const formattedPrice = formatPrice(event.price);

    document.title = `${event.title} | Tutoria`;
    setText("h1", event.title);
    setText("main > section p.text-\\[17px\\]", event.subtitle);
    setText(".text-\\[24px\\].font-semibold", formattedPrice);
    setText("#bookingSessionSummary", session?.date || event.date);
    setText("#bookingSessionTime", time);
    setText("#mobileSessionSummary", `${event.date} · ${time}`);
    setText("#workshopPlanPreviewTitle", event.plan?.[0]?.title);
    setText("#workshopPlanPreviewTime", event.plan?.[0]?.duration);
    setText("#workshopPlanPreviewCopy", event.plan?.[0]?.description);

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
    planImages.forEach((image, index) => {
      image.src = event.plan?.[index]?.image || images[index % Math.max(images.length, 1)] || primaryImage;
      image.alt = `${event.title} workshop plan`;
    });

    const galleryMain = document.querySelector(".gallery-image");
    if (galleryMain) galleryMain.src = primaryImage;
    const hostImage = document.querySelector("#host-location img");
    if (hostImage) {
      hostImage.src = event.hostImage;
      hostImage.alt = event.host;
    }
    setupHostProfileLinks(event);

    const factValues = document.querySelectorAll("#details .rounded-\\[32px\\] .text-\\[15px\\].font-medium");
    [event.type, event.duration, event.languages?.join(", "), event.minimumAge].forEach((value, index) => {
      if (factValues[index] && value) factValues[index].textContent = value;
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

    const planList = document.getElementById("workshopPlanList");
    if (planList && event.plan?.length) {
      planList.querySelectorAll("[data-plan-step]").forEach((step, index) => {
        const item = event.plan[index];
        if (!item) return;
        const title = step.querySelector("h3");
        const paragraphs = step.querySelectorAll("p");
        const image = step.querySelector("img");
        if (title) title.textContent = item.title;
        if (paragraphs[0]) paragraphs[0].textContent = item.description;
        if (paragraphs[1]) paragraphs[1].textContent = item.duration;
        if (image) {
          image.src = item.image || images[index % Math.max(images.length, 1)] || primaryImage;
          image.alt = `${event.title} - ${item.title}`;
        }
      });
    }
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
