(function () {
  const params = new URLSearchParams(window.location.search);
  const profiles = (() => {
    try {
      return JSON.parse(document.documentElement.dataset.tutorProfiles || "[]");
    } catch {
      return [];
    }
  })();
  const profileName = decodeURIComponent(String(params.get("name") || "").replace(/\+/g, " ")).trim();
  const profile = profiles.find((item) => item.name === profileName) || window.TUTORIA_GET_TUTOR_PROFILE?.(params.get("name")) || profiles[0];
  if (!profile) return;

  const firstName = profile.name.split(" ")[0];
  const number = new Intl.NumberFormat("vi-VN");
  const formatVnd = (value) => `${number.format(value)} đ`;
  const roundToTen = (value) => Math.round(value / 10000) * 10000;
  const prices = {
    "20 minutes": formatVnd(roundToTen(profile.price * 0.4)),
    "30 minutes": formatVnd(roundToTen(profile.price * 0.6)),
    "50 minutes": formatVnd(roundToTen(profile.price * 0.85)),
    "60 minutes": formatVnd(profile.price),
    "90 minutes": formatVnd(roundToTen(profile.price * 1.4)),
  };
  const teachingSpaceFormat = `At ${firstName}'s teaching space`;

  const activeTutorProfile = {
    ...profile,
    firstName,
    prices,
    selectedPrice: prices["60 minutes"],
    consultationPrice: prices["20 minutes"],
    teachingSpaceFormat,
    formatOptions: [
      { value: "Online", label: "Online", icon: "video", detail: "Tutoria classroom" },
      { value: teachingSpaceFormat, label: `${firstName}'s space`, icon: "house", detail: profile.location },
      { value: "At your location", label: "Your location", icon: "navigation", detail: "Enter an address" },
      { value: "Public place", label: "Public place", icon: "building-2", detail: "Choose a meeting place" },
    ],
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
  const chips = (items) =>
    items.map((item) => `<span class="rounded-full bg-canvas px-3 py-2 text-sm">${item}</span>`).join("");
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

  const images = [...document.images].filter((image) => image.alt.includes("Thu Ha") || image.alt === "Thu Ha");
  images.forEach((image) => {
    image.src = profile.image;
    image.alt = `${profile.name}, ${profile.role}`;
  });

  setText(document.querySelector("h1"), profile.name);
  setText(findText("span", profile.name), profile.name);
  setText(findText("span", profile.role), profile.role);
  setText(document.querySelector(".mt-6.max-w-3xl.text-base"), profile.tagline);

  const aboutCopy = document.querySelector("#panel-about .space-y-4");
  if (aboutCopy) aboutCopy.innerHTML = profile.about.map((paragraph) => `<p>${paragraph}</p>`).join("");

  const languageLabel = findText("p", "Languages");
  const languageRow = languageLabel?.nextElementSibling;
  if (languageRow) {
    languageRow.innerHTML = profile.languages
      .map((language) => {
        const match = language.match(/^(.*?)\s*\((.*?)\)$/);
        return match
          ? `<span class="rounded-full border border-line bg-white px-3 py-2 text-sm">${match[1]} <span class="text-muted">(${match[2]})</span></span>`
          : `<span class="rounded-full border border-line bg-white px-3 py-2 text-sm">${language}</span>`;
      })
      .join("");
  }

  const factItems = [...document.querySelectorAll("#panel-about .border-t.border-line.pt-6 span")];
  setText(factItems[1]?.lastChild, profile.languages.map(plainLanguage).join(" and "));
  setText(factItems[2]?.lastChild, `${profile.location} and online`);

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
          <p class="font-medium">${outcome}</p>
        </li>
      `)
      .join("");
  }
  const typicalLessonHeading = findText("h2", "Typical lesson");
  setText(typicalLessonHeading?.parentElement?.querySelector("p"), profile.typicalLesson);

  document.querySelectorAll(".rate-card").forEach((card) => {
    const duration = card.dataset.duration;
    if (!duration || !prices[duration]) return;
    card.dataset.price = prices[duration];
    setText(card.querySelector(".text-2xl"), prices[duration].replace(/\s*đ$/, ""));
  });
  document.querySelectorAll(".sidebar-duration").forEach((button) => {
    const duration = button.dataset.duration;
    if (duration && prices[duration]) button.dataset.price = prices[duration];
  });
  setText(document.getElementById("sidebarPrice"), prices["60 minutes"]);
  setText(document.getElementById("mobilePrice"), prices["60 minutes"]);
  setText(document.getElementById("reviewTotal"), prices["60 minutes"]);

  const firstLessonOriginal = findText(".line-through", "180.000 đ");
  setText(firstLessonOriginal, prices["30 minutes"]);
  setText(document.querySelector(".price-signal"), formatVnd(roundToTen(roundToTen(profile.price * 0.6) * 0.88)));
  setText(findText("span", "20 minutes"), "20 minutes");
  const consultationPrice = [...document.querySelectorAll(".text-3xl.font-semibold.tracking-tight")].find((element) => element.textContent.trim() === "120.000 đ");
  setText(consultationPrice, prices["20 minutes"]);

  document.querySelectorAll("select option").forEach((option) => {
    if (option.textContent.trim() === "At Thu's teaching space") option.textContent = teachingSpaceFormat;
  });

  const summaryMeta = [...document.querySelectorAll("#bookingSummary p")].find((element) => element.textContent.includes("·"));
  setText(summaryMeta, `${profile.role} · ${profile.rating}`);
})();
