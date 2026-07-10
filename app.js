(function () {
  const STORAGE_KEY = "tutormatch_mvp_v3";
  const LEGACY_KEY = "tutormatch_mvp_v2";
  const API_BASE_URL = (window.TUTORMATCH_API_BASE_URL || "").replace(/\/$/, "");
  const API_STATE_URL = `${API_BASE_URL}/api/state`;
  const app = document.getElementById("app");
  let backendEnabled = location.protocol !== "file:";
  let cleanupSubjectGallery = null;
  let cleanupHeroCutouts = null;

  const SUBJECTS = ["Toán", "Tiếng Anh", "Vật lý", "Hóa học", "Ngữ văn", "IELTS", "Tin học"];
  const REGIONS = ["Quận 1", "Quận 3", "Quận 7", "Bình Thạnh", "Thủ Đức", "Online"];
  const SLOTS = ["T2 tối", "T3 tối", "T4 chiều", "T5 tối", "T7 sáng", "CN chiều"];
  const CASE_STATUSES = ["pending", "negotiating", "confirmed", "awaiting_payment", "paid", "active", "completed", "cancelled"];
  const SERVICE_FEE_CAP = 500000;

  const labels = {
    student: "Phụ huynh/Học sinh",
    tutor: "Gia sư",
    admin: "Quản trị",
    open: "Đang mở",
    closed: "Đã đóng",
    online: "Online",
    home: "Tại nhà",
    both: "Cả hai",
    pending_review: "Chờ duyệt",
    approved: "Đã xác minh",
    rejected: "Bị từ chối",
    pending: "Chờ phản hồi",
    negotiating: "Đang trao đổi",
    confirmed: "Đã chốt lịch",
    awaiting_payment: "Chờ thanh toán",
    paid: "Đã thanh toán",
    active: "Đang học",
    completed: "Hoàn tất",
    cancelled: "Đã hủy"
  };

  const seed = {
    currentUserId: null,
    users: [
      { id: "u_student", name: "Anh Thư", email: "student@example.com", password: "Pass123!", role: "student", studentKind: "parent", phone: "0901 111 222", address: "Quận 3, TP.HCM", avatarUrl: "assets/profile-review-emily.png", createdAt: "2026-06-01T09:00:00.000Z" },
      { id: "u_tutor", name: "Minh Khang", email: "tutor@example.com", password: "Pass123!", role: "tutor", phone: "0902 333 444", address: "Bình Thạnh, TP.HCM", avatarUrl: "assets/tutor-alex.png", createdAt: "2026-06-01T09:10:00.000Z" },
      { id: "u_tutor_lan", name: "Lê Lan Anh", email: "lan.tutor@example.com", password: "Pass123!", role: "tutor", phone: "0907 222 118", address: "Quận 1, TP.HCM", avatarUrl: "assets/student05-priya.png", createdAt: "2026-06-01T09:12:00.000Z" },
      { id: "u_tutor_khoa", name: "Phạm Minh Khoa", email: "khoa.tutor@example.com", password: "Pass123!", role: "tutor", phone: "0908 667 889", address: "Thủ Đức, TP.HCM", avatarUrl: "assets/student05-daniel.png", createdAt: "2026-06-01T09:14:00.000Z" },
      { id: "u_tutor_pending", name: "Trần Mai Chi", email: "pending.tutor@example.com", password: "Pass123!", role: "tutor", phone: "0905 999 888", address: "Quận 7, TP.HCM", avatarUrl: "assets/tutor-isabella.png", createdAt: "2026-06-01T09:20:00.000Z" },
      { id: "u_tutor_sophia", name: "Nguyễn Phương Linh", email: "sophia.tutor@example.com", password: "Pass123!", role: "tutor", phone: "0909 555 121", address: "Quận 3, TP.HCM", avatarUrl: "assets/profile-sophia.png", createdAt: "2026-06-01T09:24:00.000Z" },
      { id: "u_admin", name: "Admin TutorMatch", email: "admin@example.com", password: "Pass123!", role: "admin", phone: "support@tutormatch.vn", address: "Back office", createdAt: "2026-06-01T09:30:00.000Z" }
    ],
    tutorProfiles: [
      { userId: "u_tutor", subjects: ["Toán", "Vật lý", "IELTS"], regions: ["Quận 1", "Quận 3", "Bình Thạnh", "Online"], format: "both", hourlyRate: 280000, age: 24, educationLevel: "bachelor", availability: ["T3 tối", "T5 tối", "T7 sáng"], bio: "Gia sư 5 năm kinh nghiệm luyện thi chuyển cấp. Dạy theo lộ trình rõ, có bài tập sau mỗi buổi.", credentialFiles: ["bang-su-pham.pdf", "ielts-8.0.jpg"], verificationStatus: "approved", rejectionReason: "", ratingAvg: 4.9 },
      { userId: "u_tutor_lan", subjects: ["Tiếng Anh", "IELTS", "Ngữ văn"], regions: ["Quận 1", "Quận 3", "Online"], format: "both", hourlyRate: 320000, age: 26, educationLevel: "master", availability: ["T2 tối", "T4 chiều", "CN chiều"], bio: "Tập trung phát âm, nền tảng IELTS và kỹ năng viết. Phụ huynh nhận nhận xét sau mỗi buổi.", credentialFiles: ["tesol.pdf"], verificationStatus: "approved", rejectionReason: "", ratingAvg: 4.8 },
      { userId: "u_tutor_khoa", subjects: ["Tin học", "Toán"], regions: ["Thủ Đức", "Online"], format: "online", hourlyRate: 260000, age: 22, educationLevel: "college", availability: ["T3 tối", "T7 sáng"], bio: "Dạy Tin học theo dự án nhỏ để học sinh hiểu bài qua thực hành.", credentialFiles: ["student-card.pdf"], verificationStatus: "approved", rejectionReason: "", ratingAvg: 4.7 },
      { userId: "u_tutor_pending", subjects: ["Hóa học", "Sinh học"], regions: ["Quận 7", "Online"], format: "both", hourlyRate: 300000, age: 20, educationLevel: "college", availability: ["T5 tối"], bio: "Hồ sơ đang chờ duyệt, chưa xuất hiện trong kết quả ghép.", credentialFiles: ["credential.jpg"], verificationStatus: "pending_review", rejectionReason: "", ratingAvg: 0 },
      { userId: "u_tutor_sophia", subjects: ["Toán", "Hóa học"], regions: ["Quận 3", "Bình Thạnh", "Online"], format: "both", hourlyRate: 350000, age: 28, educationLevel: "master", availability: ["T2 tối", "T4 chiều", "CN chiều"], bio: "Giúp học sinh xây nền Toán vững, giải thích chậm, rõ và có kiểm tra tiến bộ.", credentialFiles: ["master-degree.pdf"], verificationStatus: "approved", rejectionReason: "", ratingAvg: 5 }
    ],
    requests: [
      { id: "r_seed", studentId: "u_student", subjects: ["Toán"], grade: "Lớp 10", region: "Bình Thạnh", format: "both", schedule: ["T3 tối", "T7 sáng"], budgetMin: 200000, budgetMax: 350000, studentsCount: 1, note: "Con mất gốc hình học, cần gia sư kiên nhẫn.", status: "open", createdAt: "2026-06-10T10:00:00.000Z" },
      { id: "r_ielts", studentId: "u_student", subjects: ["IELTS"], grade: "Foundation", region: "Online", format: "online", schedule: ["T2 tối", "CN chiều"], budgetMin: 250000, budgetMax: 380000, studentsCount: 1, note: "Muốn bắt đầu từ nghe và đọc.", status: "open", createdAt: "2026-06-12T10:00:00.000Z" }
    ],
    cases: [
      { id: "c_seed", requestId: "r_seed", tutorId: "u_tutor", status: "negotiating", cancelledReason: "", cancelledBy: "", createdAt: "2026-06-11T10:00:00.000Z" },
      { id: "c_paid", requestId: "r_ielts", tutorId: "u_tutor_lan", status: "active", cancelledReason: "", cancelledBy: "", createdAt: "2026-06-12T11:00:00.000Z" }
    ],
    confirmationLetters: [
      { caseId: "c_paid", lessonsCount: 4, schedule: "T2 tối hằng tuần", fee: 320000, format: "online", note: "Buổi đầu kiểm tra nền tảng IELTS.", createdAt: "2026-06-13T11:00:00.000Z" }
    ],
    payments: [
      { id: "p_paid", caseId: "c_paid", payerId: "u_student", amount: 320000, status: "completed", createdAt: "2026-06-13T12:00:00.000Z" }
    ],
    messages: [
      { id: "m1", caseId: "c_seed", senderId: "u_student", content: "Chào thầy, con đang yếu hình học lớp 10.", createdAt: "2026-06-11T11:00:00.000Z" },
      { id: "m2", caseId: "c_seed", senderId: "u_tutor", content: "Mình có thể kiểm tra nền trước rồi lên lộ trình 4 tuần.", createdAt: "2026-06-11T11:05:00.000Z" },
      { id: "m3", caseId: "c_paid", senderId: "u_tutor_lan", content: "Mình đã gửi lịch học IELTS, em xem giúp nhé.", createdAt: "2026-06-13T11:20:00.000Z" }
    ],
    reviews: [
      { id: "rv1", caseId: "c_paid", reviewerId: "u_student", revieweeId: "u_tutor_lan", rating: 5, comment: "Dạy rõ và có nhận xét sau buổi học.", createdAt: "2026-06-20T10:00:00.000Z" }
    ],
    ui: { activeConversationId: "c_seed" }
  };

  let state = loadState();
  hydrate();

  function loadState() {
    if (backendEnabled) {
      try {
        const request = new XMLHttpRequest();
        request.open("GET", API_STATE_URL, false);
        request.setRequestHeader("Accept", "application/json");
        request.send();
        if (request.status >= 200 && request.status < 300) {
          const payload = JSON.parse(request.responseText || "{}");
          if (payload.state) return migrate(payload.state);
          const initial = structuredClone(seed);
          persistBackendState(initial);
          return initial;
        }
        backendEnabled = false;
      } catch (error) {
        backendEnabled = false;
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return structuredClone(seed);
    try {
      return migrate(JSON.parse(raw));
    } catch (error) {
      return structuredClone(seed);
    }
  }

  function migrate(data) {
    const next = { ...structuredClone(seed), ...data };
    next.users = Array.isArray(data.users) ? data.users : structuredClone(seed.users);
    next.tutorProfiles = Array.isArray(data.tutorProfiles) ? data.tutorProfiles : structuredClone(seed.tutorProfiles);
    next.requests = Array.isArray(data.requests) ? data.requests : structuredClone(seed.requests);
    next.cases = Array.isArray(data.cases) ? data.cases : structuredClone(seed.cases);
    next.confirmationLetters = Array.isArray(data.confirmationLetters) ? data.confirmationLetters : structuredClone(seed.confirmationLetters);
    next.payments = Array.isArray(data.payments) ? data.payments : structuredClone(seed.payments);
    next.messages = Array.isArray(data.messages) ? data.messages : structuredClone(seed.messages);
    next.reviews = Array.isArray(data.reviews) ? data.reviews : structuredClone(seed.reviews);
    next.ui ||= { activeConversationId: "c_seed" };
    return next;
  }

  function hydrate() {
    const byId = new Map(state.users.map((user) => [user.id, user]));
    seed.users.forEach((user) => { if (!byId.has(user.id)) state.users.push(user); });
    const profileIds = new Set(state.tutorProfiles.map((profile) => profile.userId));
    seed.tutorProfiles.forEach((profile) => { if (!profileIds.has(profile.userId)) state.tutorProfiles.push(profile); });
    state.users.forEach((user) => {
      if (user.avatarUrl && user.avatarUrl.includes("images.unsplash.com")) {
        user.avatarUrl = user.role === "student" ? "assets/profile-review-emily.png" : "assets/tutor-alex.png";
      }
    });
    save();
  }

  function persistBackendState(nextState) {
    if (!backendEnabled) return;
    const payload = JSON.stringify({ state: nextState });
    try {
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(API_STATE_URL, new Blob([payload], { type: "application/json" }));
        if (sent) return;
      }
    } catch (error) {}
    try {
      fetch(API_STATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    } catch (error) {}
  }

  function save(next = state) {
    state = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
    } catch (error) {}
    persistBackendState(state);
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.currentUserId) || null;
  }

  function userName(id) {
    return state.users.find((user) => user.id === id)?.name || "Người dùng";
  }

  function userOf(id) {
    return state.users.find((user) => user.id === id);
  }

  function profileOf(id) {
    return state.tutorProfiles.find((profile) => profile.userId === id);
  }

  function requestOf(id) {
    return state.requests.find((request) => request.id === id);
  }

  function caseOf(id) {
    return state.cases.find((item) => item.id === id);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function money(value = 0) {
    return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
  }

  function initial(name = "") {
    return escapeHtml(name.trim().split(/\s+/).slice(-1)[0]?.[0] || "T");
  }

  function avatar(user, size = "") {
    const src = user?.avatarUrl || "";
    return src ? `<img class="avatar ${size}" src="${escapeHtml(src)}" alt="${escapeHtml(user.name)}" width="72" height="72" loading="lazy" />` : `<span class="avatar ${size}">${initial(user?.name)}</span>`;
  }

  function icon(name) {
    const paths = {
      search: "M21 21l-4.3-4.3m1.3-5.2a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z",
      shield: "M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3z",
      chat: "M4 5h16v11H8l-4 4V5z",
      calendar: "M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 012 2v12H4V7a2 2 0 012-2z",
      card: "M3 6h18v12H3V6zm0 4h18",
      user: "M20 21a8 8 0 10-16 0m12-11a4 4 0 11-8 0 4 4 0 018 0z",
      check: "M20 6L9 17l-5-5",
      book: "M4 5a3 3 0 013-3h13v17H7a3 3 0 00-3 3V5z",
      arrowRight: "M5 12h14m-6-6 6 6-6 6",
      play: "M8 5v14l11-7-11-7z",
      logout: "M10 17l5-5-5-5m5 5H3m14 7h3V5h-3"
    };
    return `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.check}"/></svg>`;
  }

  function navLink(href, label, active, iconName) {
    return `<a class="${active ? "active" : ""}" href="${href}">${icon(iconName)}<span>${escapeHtml(label)}</span></a>`;
  }

  function publicShell(content, active = "home") {
    const user = currentUser();
    const mobileItems = [
      ["#/student/tutors", "Subjects"],
      ["#about", "About"],
      ["#journal", "Journal"],
      ["#reach-us", "Reach Us"],
      [user ? `#/${user.role === "admin" ? "admin" : user.role}` : "#/auth/login", user ? "Dashboard" : "Sign In"]
    ];
    return `
      <header class="site-header public-header">
        <a class="brand tutoria-brand" href="#/" aria-label="Tutoria home"><span>Tutoria<sup>®</sup></span></a>
        <nav class="site-nav" aria-label="Điều hướng chính">
          <a class="${active === "home" ? "active" : ""}" href="#/">Home</a>
          <a href="#/student/tutors">Subjects</a>
          <a href="#about">About</a>
          <a href="#journal">Journal</a>
          <a href="#reach-us">Reach Us</a>
        </nav>
        <div class="header-actions">
          <a class="reach-link" href="${user ? `#/${user.role === "admin" ? "admin" : user.role}` : "#/auth/login"}">${user ? "Dashboard" : "Sign In"}</a>
          <a class="header-cta" href="#/auth/register/student">Begin Journey</a>
          <button class="mobile-menu-button" type="button" data-action="open-mobile-menu" aria-label="Open menu" aria-controls="mobile-menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>
      <aside class="mobile-menu" id="mobile-menu" aria-hidden="true">
        <div class="mobile-menu-backdrop"></div>
        <div class="mobile-menu-content">
          <header>
            <a class="brand tutoria-brand" href="#/" aria-label="Tutoria home"><span>Tutoria<sup>®</sup></span></a>
            <button class="mobile-menu-close" type="button" data-action="close-mobile-menu" aria-label="Close menu"><span></span><span></span></button>
          </header>
          <nav aria-label="Mobile navigation">
            ${mobileItems.map(([href, label], index) => `<a href="${href}" style="--i:${index}">${escapeHtml(label)}</a>`).join("")}
          </nav>
          <a class="mobile-menu-cta" href="#/auth/register/student">Start Matching</a>
        </div>
      </aside>
      ${content}
    `;
  }

  function pageHome() {
    const approved = approvedTutors().slice(0, 3);
    const subjects = [
      ["Math", "Numbers, logic, exam prep"],
      ["English", "Speaking, grammar, confidence"],
      ["Literature", "Reading, essays, analysis"],
      ["Piano", "Practice, technique, musicality"],
      ["Drawing", "Sketching, color, portfolio"],
      ["Science", "Physics, chemistry, biology"],
      ["Coding", "Projects, logic, creative tech"]
    ];
    return publicShell(`
      <main class="landing tutoria-landing" id="main-content">
        <section class="hero tutoria-hero">
          <div class="hero-bg" aria-hidden="true">
            <span class="hero-scene-layer hero-sky"></span>
            <canvas class="hero-scene-layer hero-video-cutout hero-jupiter-object" data-cutout-video="assets/tutoria-jupiter.mov"></canvas>
            <canvas class="hero-scene-layer hero-video-cutout hero-human-object" data-cutout-video="assets/tutoria-human.mov"></canvas>
          </div>
          <div class="hero-copy">
            <p class="hero-kicker">Personal tutoring, thoughtfully matched</p>
            <h1>
              Beyond <em>ordinary,</em> we shape<br>
              learning for <em>every mind.</em>
            </h1>
            <p class="lede">Tutoria helps students find thoughtful tutors across academics, music, art, and creative skill-building.</p>
            <div class="hero-actions">
              <a class="liquid-glass-btn" href="#/auth/login">Sign In</a>
              <a class="liquid-glass-btn strong" href="#/auth/register/student">Sign Up</a>
            </div>
          </div>
          <div class="subject-orbit" aria-labelledby="subject-orbit-title">
            <h2 id="subject-orbit-title" class="sr-only">Subjects</h2>
            <div class="subject-gallery" data-subject-gallery tabindex="0" aria-label="Scrollable subject gallery">
              <div class="subject-gallery-track">
                ${[...subjects, ...subjects, ...subjects].map(([name, description], index) => `
                  <article class="subject-card" style="--i:${index}" data-loop-index="${index}">
                    <div class="subject-card-surface">
                      <div class="subject-card-media" aria-hidden="true"></div>
                      <div class="subject-card-copy">
                        <h3>${escapeHtml(name)}</h3>
                        <p>${escapeHtml(description)}</p>
                      </div>
                    </div>
                  </article>
                `).join("")}
              </div>
            </div>
          </div>
        </section>
        <section class="section">
          <div class="section-title"><p class="kicker">Cách hoạt động</p><h2>Đủ rõ để phụ huynh yên tâm, đủ gọn để gia sư nhận case nhanh.</h2></div>
          <div class="feature-grid">
            <article><b>01</b><h3>Phụ huynh mô tả nhu cầu</h3><p>Chọn môn, lớp, khu vực, hình thức học, lịch rảnh và ngân sách mong muốn.</p></article>
            <article><b>02</b><h3>Hệ thống chỉ hiện gia sư đã duyệt</h3><p>Gia sư pending hoặc bị reject không xuất hiện trong kết quả ghép.</p></article>
            <article><b>03</b><h3>Chat, chốt lịch, thanh toán</h3><p>Thông tin liên hệ được khóa cho tới khi case đã thanh toán.</p></article>
          </div>
        </section>
        <section class="section">
          <div class="section-title"><p class="kicker">Xem trước</p><h2>Hồ sơ gia sư viết để phụ huynh so sánh nhanh.</h2></div>
          <div class="tutor-grid">${approved.map(({ user, profile }) => tutorListing(user, profile, true)).join("")}</div>
        </section>
      </main>
    `);
  }

  function pageAuth(mode = "login", role = "student") {
    const isLogin = mode === "login";
    return publicShell(`
      <main class="auth-page">
        <section class="auth-story">
          <p class="kicker">${isLogin ? "Quay lại TutorMatch" : "Bắt đầu đúng vai trò"}</p>
          <h1>${isLogin ? "Đăng nhập để tiếp tục quản lý buổi học." : "Một tài khoản, một vai trò rõ ràng cho MVP."}</h1>
          <p>Phụ huynh tạo nhu cầu học. Gia sư nộp hồ sơ xác minh. Cả hai trao đổi và chốt lịch trong app.</p>
        </section>
        <form class="auth-card" data-form="${isLogin ? "login" : "register"}">
          <h2>${isLogin ? "Đăng nhập" : "Đăng ký"}</h2>
          ${isLogin ? "" : `<input type="hidden" name="role" value="${escapeHtml(role)}">${role === "tutor" ? `<div class="role-note">${icon("book")}Bạn đang đăng ký làm gia sư.</div>` : ""}`}
          <label>Email <input name="email" type="email" autocomplete="email" required value="${isLogin ? "student@example.com" : ""}" placeholder="you@example.com"></label>
          ${isLogin ? "" : `<label>Số điện thoại <input name="phone" type="tel" autocomplete="tel" required placeholder="0901 111 222"></label>`}
          <label>Mật khẩu <input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" required value="${isLogin ? "Pass123!" : ""}" placeholder="Tối thiểu 6 ký tự"></label>
          <button class="primary" type="submit">${isLogin ? "Đăng nhập" : "Tạo tài khoản"}</button>
          <p>${isLogin ? `Chưa có tài khoản? <a href="#/auth/register/student">Đăng ký</a>` : `Đã có tài khoản? <a href="#/auth/login">Đăng nhập</a>`}</p>
          ${isLogin ? `<small>Tài khoản thử: student@example.com, tutor@example.com, admin@example.com · Pass123!</small>` : ""}
        </form>
      </main>
    `, "auth");
  }

  function requireUser(role) {
    const user = currentUser();
    if (!user) {
      navigate("#/auth/login");
      return null;
    }
    if (role && user.role !== role) {
      navigate(user.role === "admin" ? "#/admin" : `#/${user.role}`);
      return null;
    }
    return user;
  }

  function appShell(role, active, content) {
    const user = currentUser();
    const nav = role === "student"
      ? [
        ["#/student", "Tổng quan", "book", "dashboard"], ["#/student/tutors", "Gia sư", "search", "tutors"], ["#/student/messages", "Tin nhắn", "chat", "messages"], ["#/student/payments", "Thanh toán", "card", "payments"], ["#/student/sessions", "Buổi học", "calendar", "sessions"], ["#/student/reviews", "Đánh giá", "check", "reviews"], ["#/student/settings", "Cài đặt", "user", "settings"], ["#/student/help", "Hỗ trợ", "shield", "help"]
      ]
      : [
        ["#/tutor", "Tổng quan", "book", "dashboard"], ["#/tutor/open-cases", "Case mở", "search", "requests"], ["#/tutor/messages", "Tin nhắn", "chat", "messages"], ["#/tutor/schedule", "Lịch dạy", "calendar", "schedule"], ["#/tutor/earnings", "Thu nhập", "card", "earnings"], ["#/tutor/profile", "Hồ sơ", "user", "profile"], ["#/tutor/settings", "Cài đặt", "shield", "settings"]
      ];
    return `
      <main class="workspace-shell" id="main-content">
        <aside class="side">
          <a class="brand side-brand" href="#/"><span class="brand-mark">${icon("book")}</span><span>TutorMatch</span></a>
          <nav aria-label="Điều hướng ${role}">${nav.map(([href, label, iconName, key]) => navLink(href, label, active === key, iconName)).join("")}</nav>
          <div class="side-note"><b>${role === "student" ? "Liên hệ được bảo vệ" : "Chỉ nhận case phù hợp"}</b><p>${role === "student" ? "Số điện thoại chỉ mở sau khi thanh toán." : "Hồ sơ đã duyệt mới hiển thị cho phụ huynh."}</p></div>
        </aside>
        <section class="workspace-main">
          <header class="workspace-top">
            <div></div>
            <div class="userbar">${avatar(user, "sm")}<div><b>${escapeHtml(user.name)}</b><span>${labels[user.role]}</span></div><button data-action="logout">${icon("logout")}Đăng xuất</button></div>
          </header>
          <div class="page-pad">${content}</div>
        </section>
      </main>
    `;
  }

  function pageStudentDashboard() {
    const user = requireUser("student");
    if (!user) return "";
    const ownRequests = state.requests.filter((item) => item.studentId === user.id);
    const ownCases = casesForStudent(user.id);
    const activeCases = ownCases.filter((item) => ["paid", "active", "completed"].includes(item.status));
    const paid = state.payments.filter((pay) => pay.payerId === user.id && pay.status === "completed").reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
    return appShell("student", "dashboard", `
      <section class="page-hero">
        <div><p class="kicker">Dashboard phụ huynh</p><h1>Chào ${escapeHtml(user.name.split(" ")[0])}, hôm nay cần theo dõi gì?</h1><p>Xem nhu cầu học, gia sư đang trao đổi, thanh toán và buổi học sắp tới.</p></div>
        <a class="primary" href="#/student/request/new">${icon("search")}Tạo nhu cầu mới</a>
      </section>
      <section class="metric-grid">
        ${metric("Nhu cầu đang mở", ownRequests.filter((r) => r.status === "open").length, "Có thể chat nhiều gia sư")}
        ${metric("Gia sư đang học", activeCases.length, "Đã mở liên hệ")}
        ${metric("Đã thanh toán", money(paid), "Buổi đầu và phí dịch vụ")}
        ${metric("Tin nhắn", state.messages.filter((m) => ownCases.some((c) => c.id === m.caseId)).length, "Lưu lại trong app")}
      </section>
      <section class="split">
        <article class="panel"><div class="panel-title"><h2>Nhu cầu của bạn</h2><a href="#/student/request/new">Tạo mới</a></div>${ownRequests.map(requestRow).join("") || empty("Chưa có nhu cầu học.", "Tạo nhu cầu đầu tiên để nhận gợi ý gia sư.")}</article>
        <article class="panel"><div class="panel-title"><h2>Case đang trao đổi</h2><a href="#/student/messages">Mở tin nhắn</a></div>${ownCases.map(caseRow).join("") || empty("Chưa có case.", "Chọn một gia sư phù hợp để bắt đầu trao đổi.")}</article>
      </section>
    `);
  }

  function pageStudentTutors() {
    const user = requireUser("student");
    if (!user) return "";
    const tutors = approvedTutors();
    return appShell("student", "tutors", `
      <section class="page-hero compact"><div><p class="kicker">Gia sư đã xác minh</p><h1>Tìm người dạy phù hợp.</h1><p>Lọc theo môn, khu vực, học phí và tình trạng hồ sơ.</p></div></section>
      <section class="filters" data-filter-scope="tutors">
        <input data-filter-text placeholder="Tìm theo tên, môn học, khu vực">
        <select data-filter-subject><option value="">Tất cả môn</option>${SUBJECTS.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select>
        <select data-filter-region><option value="">Tất cả khu vực</option>${REGIONS.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select>
      </section>
      <section class="tutor-grid">${tutors.map(({ user: tutor, profile }) => tutorListing(tutor, profile)).join("")}</section>
    `);
  }

  function pageMessages(role = "student") {
    const user = requireUser(role);
    if (!user) return "";
    const cases = role === "student" ? casesForStudent(user.id) : casesForTutor(user.id);
    const active = caseOf(state.ui.activeConversationId) || cases[0];
    const content = cases.length ? `
      <section class="chat-layout">
        <aside class="conversation-list">${cases.map((item) => {
          const other = otherParty(item, user.role);
          const last = state.messages.filter((m) => m.caseId === item.id).slice(-1)[0];
          return `<button class="${active?.id === item.id ? "active" : ""}" data-action="open-conversation" data-case-id="${item.id}">${avatar(other, "sm")}<span><b>${escapeHtml(other.name)}</b><small>${escapeHtml(last?.content || labels[item.status])}</small></span></button>`;
        }).join("")}</aside>
        <article class="chat-window">
          <header>${avatar(otherParty(active, user.role), "sm")}<div><h2>${escapeHtml(otherParty(active, user.role).name)}</h2><p>${labels[active.status]}</p></div></header>
          <div class="messages">${state.messages.filter((m) => m.caseId === active.id).map((m) => `<p class="${m.senderId === user.id ? "mine" : ""}">${escapeHtml(m.content)}<small>${escapeHtml(userName(m.senderId))}</small></p>`).join("")}</div>
          ${active.status === "cancelled" ? `<div class="locked-note">Case đã hủy: ${escapeHtml(active.cancelledReason || "Không còn trao đổi.")}</div>` : `
            <div class="case-actions">
              ${["pending", "negotiating"].includes(active.status) ? `<button class="primary" data-action="confirm-case" data-case-id="${active.id}">Chốt lịch học</button>` : ""}
              ${["confirmed", "awaiting_payment"].includes(active.status) && user.role === "student" ? `<button class="primary" data-action="pay-case" data-case-id="${active.id}">Thanh toán để mở liên hệ</button>` : ""}
              ${["paid", "active", "completed"].includes(active.status) ? `<span>${icon("shield")} Liên hệ trực tiếp đã mở trong trang Buổi học.</span>` : `<span>${icon("shield")} Liên hệ vẫn được giữ kín.</span>`}
            </div>
            <form class="composer" data-form="message" data-case-id="${active.id}"><input name="content" required placeholder="Nhập tin nhắn"><button class="primary" type="submit">Gửi</button></form>
          `}
        </article>
      </section>
    ` : empty("Chưa có cuộc trò chuyện.", role === "student" ? "Vào danh sách gia sư để bắt đầu chat." : "Nhận một case mở để trao đổi với phụ huynh.");
    return appShell(role, "messages", `<section class="page-hero compact"><div><p class="kicker">Tin nhắn trong app</p><h1>Trao đổi trước khi mở liên hệ.</h1><p>Mọi thỏa thuận quan trọng nên được giữ trong app để dễ đối chiếu.</p></div></section>${content}`);
  }

  function pagePayments() {
    const user = requireUser("student");
    if (!user) return "";
    const payments = state.payments.filter((pay) => pay.payerId === user.id);
    const due = casesForStudent(user.id).filter((item) => item.status === "awaiting_payment");
    return appShell("student", "payments", `
      <section class="page-hero compact"><div><p class="kicker">Thanh toán</p><h1>Thanh toán buổi đầu để mở liên hệ.</h1><p>Phí dịch vụ mặc định bằng học phí buổi đầu trong MVP.</p></div></section>
      <section class="metric-grid">${metric("Đã trả", money(payments.reduce((s, p) => s + p.amount, 0)), "Giao dịch hoàn tất")}${metric("Chờ thanh toán", due.length, "Case đã chốt lịch")}${metric("Phương thức", "Thẻ test", "Không thu tiền thật")}</section>
      <section class="panel"><div class="panel-title"><h2>Lịch sử thanh toán</h2></div>${table(["Ngày", "Gia sư", "Số tiền", "Trạng thái", "Thao tác"], [...payments.map(paymentRow), ...due.map(dueRow)])}</section>
    `);
  }

  function pageSessions(role = "student") {
    const user = requireUser(role);
    if (!user) return "";
    const cases = role === "student" ? casesForStudent(user.id) : casesForTutor(user.id);
    const sessions = cases.filter((item) => ["paid", "active", "completed"].includes(item.status));
    return appShell(role, role === "student" ? "sessions" : "schedule", `
      <section class="page-hero compact"><div><p class="kicker">${role === "student" ? "Buổi học" : "Lịch dạy"}</p><h1>${role === "student" ? "Theo dõi buổi học đã chốt." : "Quản lý lịch dạy đã xác nhận."}</h1><p>Liên hệ trực tiếp chỉ hiển thị khi case đã thanh toán.</p></div></section>
      <section class="session-list">${sessions.map(sessionCard).join("") || empty("Chưa có buổi học đã chốt.", "Khi case được thanh toán, lịch học sẽ xuất hiện ở đây.")}</section>
    `);
  }

  function pageReviews() {
    const user = requireUser("student");
    if (!user) return "";
    return appShell("student", "reviews", `
      <section class="page-hero compact"><div><p class="kicker">Đánh giá 2 chiều</p><h1>Feedback giúp nền tảng đáng tin hơn.</h1><p>Đánh giá chỉ hiển thị sau khi đã có buổi học.</p></div></section>
      <section class="review-grid">
        ${state.reviews.map((review) => `<article class="panel"><b>${escapeHtml(userName(review.revieweeId))}</b><span class="stars">${"★".repeat(review.rating)}</span><p>${escapeHtml(review.comment)}</p><small>${new Date(review.createdAt).toLocaleDateString("vi-VN")}</small></article>`).join("") || empty("Chưa có đánh giá.", "Hoàn tất buổi học để gửi đánh giá.")}
      </section>
    `);
  }

  function pageSettings(role = "student") {
    const user = requireUser(role);
    if (!user) return "";
    const profile = profileOf(user.id);
    return appShell(role, "settings", `
      <section class="page-hero compact"><div><p class="kicker">Cài đặt</p><h1>Thông tin tài khoản.</h1><p>Demo MVP lưu dữ liệu vào backend JSON hoặc localStorage.</p></div></section>
      <section class="settings-grid">
        <article class="panel"><h2>Tài khoản</h2>${avatar(user)}<p><b>${escapeHtml(user.name)}</b></p><p>${escapeHtml(user.email)}</p><p>${escapeHtml(user.phone || "")}</p></article>
        <article class="panel"><h2>${role === "tutor" ? "Hồ sơ dạy" : "Ưu tiên học"}</h2>${profile ? `<p>${escapeHtml(profile.subjects.join(", "))}</p><p>${money(profile.hourlyRate)}/buổi</p><p>${labels[profile.verificationStatus]}</p>` : `<p>Toán, Tiếng Anh, Online</p><p>Nhận nhắc lịch qua email</p>`}</article>
        <article class="panel"><h2>Bảo mật</h2><p>Đổi mật khẩu</p><p>Xác thực 2 bước</p><p>Quyền riêng tư</p></article>
      </section>
    `);
  }

  function pageHelp() {
    const user = requireUser("student");
    if (!user) return "";
    const faqs = ["Làm sao để tìm gia sư?", "Khi nào tôi thấy số điện thoại?", "Thanh toán buổi đầu là gì?", "Tôi có thể đổi gia sư không?", "Gia sư pending có xuất hiện không?", "Làm sao hủy case?", "Dữ liệu chat được lưu ở đâu?"];
    return appShell("student", "help", `
      <section class="page-hero compact"><div><p class="kicker">Hỗ trợ</p><h1>Câu hỏi thường gặp.</h1><p>Nội dung viết theo góc nhìn phụ huynh và học sinh, không dùng thuật ngữ nội bộ.</p></div></section>
      <section class="faq-grid">${faqs.map((q) => `<details class="panel"><summary>${escapeHtml(q)}</summary><p>TutorMatch hướng dẫn ngay trong từng bước. Nếu cần hỗ trợ thêm, gửi email support@tutormatch.vn.</p></details>`).join("")}</section>
    `);
  }

  function pageRequestForm() {
    const user = requireUser("student");
    if (!user) return "";
    return appShell("student", "dashboard", `
      <section class="page-hero compact"><div><p class="kicker">Tạo nhu cầu học</p><h1>Nói rõ để nhận đúng gia sư.</h1><p>Yêu cầu vẫn mở nếu chưa có gia sư phù hợp ngay.</p></div></section>
      <form class="form-card" data-form="request">
        ${multi("subjects", "Môn học", SUBJECTS, ["Toán"])}
        <label>Lớp/cấp độ <input name="grade" required placeholder="Ví dụ: Lớp 10, IELTS 5.5"></label>
        ${select("region", "Khu vực", REGIONS, "Bình Thạnh")}
        ${select("format", "Hình thức", ["online", "home", "both"], "both")}
        ${multi("schedule", "Lịch rảnh", SLOTS, ["T3 tối"])}
        <div class="form-row"><label>Học phí tối thiểu <input name="budgetMin" type="number" value="200000" required></label><label>Học phí tối đa <input name="budgetMax" type="number" value="350000" required></label></div>
        <label>Số học sinh <input name="studentsCount" type="number" min="1" value="1" required></label>
        <label>Ghi chú <textarea name="note" placeholder="Ví dụ: con mất gốc hình học, cần học chậm và có bài tập."></textarea></label>
        <button class="primary" type="submit">Tìm gia sư phù hợp</button>
      </form>
    `);
  }

  function pageTutorDetail(tutorId, requestId = "r_seed") {
    const user = requireUser("student");
    if (!user) return "";
    const tutor = userOf(tutorId);
    const profile = profileOf(tutorId);
    if (!tutor || !profile || profile.verificationStatus !== "approved") return appShell("student", "tutors", empty("Gia sư chưa khả dụng.", "Hồ sơ này chưa được duyệt."));
    const paid = state.cases.some((item) => item.tutorId === tutorId && item.status === "paid");
    return appShell("student", "tutors", `
      <section class="profile-page">
        <article class="profile-main">
          <header>${avatar(tutor, "xl")}<div><p class="kicker">Gia sư đã xác minh</p><h1>${escapeHtml(tutor.name)}</h1><p>${escapeHtml(profile.bio)}</p></div></header>
          <div class="chip-row">${profile.subjects.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}${profile.regions.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</div>
          <section class="profile-sections">
            <article><h2>Kinh nghiệm</h2><p>${labels[profile.educationLevel] || "Đã khai học vấn"} · ${profile.age} tuổi · Rating ${profile.ratingAvg || "mới"}</p></article>
            <article><h2>Lịch rảnh</h2><p>${escapeHtml(profile.availability.join(", "))}</p></article>
            <article><h2>Liên hệ</h2>${paid ? `<p>${escapeHtml(tutor.phone)} · ${escapeHtml(tutor.email)}</p>` : `<p>Được giữ kín cho tới khi case đã thanh toán.</p>`}</article>
          </section>
        </article>
        <aside class="profile-aside"><b>${money(profile.hourlyRate)}</b><span>/ buổi</span><button class="primary" data-action="start-chat" data-request-id="${escapeHtml(requestId)}" data-tutor-id="${escapeHtml(tutorId)}">Trao đổi với gia sư</button><a class="ghost-link" href="#/student/messages">Mở tin nhắn</a></aside>
      </section>
    `);
  }

  function pageTutorDashboard() {
    const user = requireUser("tutor");
    if (!user) return "";
    const profile = profileOf(user.id);
    if (!profile || profile.verificationStatus === "pending_review") return tutorStatus("Chờ duyệt hồ sơ", "Sau khi admin duyệt, bạn mới thấy case phù hợp.");
    if (profile.verificationStatus === "rejected") return tutorStatus("Hồ sơ cần sửa", profile.rejectionReason || "Admin đã từ chối hồ sơ này.");
    const open = openRequestsForTutor(user.id);
    const cases = casesForTutor(user.id);
    const income = state.payments.filter((p) => cases.some((c) => c.id === p.caseId)).reduce((s, p) => s + p.amount, 0);
    return appShell("tutor", "dashboard", `
      <section class="page-hero"><div><p class="kicker">Dashboard gia sư</p><h1>Chào ${escapeHtml(user.name.split(" ")[0])}, case nào đáng nhận hôm nay?</h1><p>Chỉ nhận case phù hợp môn, khu vực, hình thức và lịch rảnh của bạn.</p></div><a class="primary" href="#/tutor/open-cases">${icon("search")}Xem case mở</a></section>
      <section class="metric-grid">${metric("Case phù hợp", open.length, "Đang mở")}${metric("Đang trao đổi", cases.filter((c) => c.status === "negotiating").length, "Cần phản hồi")}${metric("Thu nhập", money(income), "Từ case đã trả")}${metric("Rating", profile.ratingAvg || "Mới", "Từ học sinh")}</section>
      <section class="split"><article class="panel"><div class="panel-title"><h2>Case mở phù hợp</h2><a href="#/tutor/open-cases">Xem tất cả</a></div>${open.slice(0, 4).map(openRequestRow).join("") || empty("Chưa có case phù hợp.", "Bạn có thể mở rộng khu vực hoặc hình thức dạy.")}</article><article class="panel"><div class="panel-title"><h2>Case đã nhận</h2><a href="#/tutor/messages">Tin nhắn</a></div>${cases.map(caseRow).join("") || empty("Chưa nhận case.", "Nhận case mở để bắt đầu trao đổi.")}</article></section>
    `);
  }

  function pageOpenCases() {
    const user = requireUser("tutor");
    if (!user) return "";
    const requests = openRequestsForTutor(user.id);
    return appShell("tutor", "requests", `
      <section class="page-hero compact"><div><p class="kicker">Case mở</p><h1>Chọn case bạn thật sự dạy tốt.</h1><p>Nhận case sẽ tạo cuộc trò chuyện riêng với phụ huynh.</p></div></section>
      <section class="panel-list">${requests.map(openRequestRow).join("") || empty("Chưa có yêu cầu phù hợp.", "Yêu cầu không tự xóa; khi phụ huynh mở tiêu chí, case sẽ hiện lại.")}</section>
    `);
  }

  function pageTutorProfile() {
    const user = requireUser("tutor");
    if (!user) return "";
    const profile = profileOf(user.id) || {};
    return appShell("tutor", "profile", `
      <section class="page-hero compact"><div><p class="kicker">Hồ sơ gia sư</p><h1>Thông tin phụ huynh dùng để quyết định.</h1><p>Hồ sơ chỉ xuất hiện trong matching khi đã được duyệt.</p></div></section>
      <form class="form-card" data-form="tutor-profile">
        ${multi("subjects", "Môn dạy", SUBJECTS, profile.subjects || ["Toán"])}
        ${multi("regions", "Khu vực nhận dạy", REGIONS, profile.regions || ["Online"])}
        ${select("format", "Hình thức", ["online", "home", "both"], profile.format || "both")}
        <label>Học phí đề xuất <input name="hourlyRate" type="number" value="${profile.hourlyRate || 280000}" required></label>
        ${multi("availability", "Lịch rảnh", SLOTS, profile.availability || ["T3 tối"])}
        <label>Mô tả bản thân <textarea name="bio" required>${escapeHtml(profile.bio || "")}</textarea></label>
        <label>File minh chứng <input name="credential" placeholder="bang-cap.pdf"></label>
        <button class="primary" type="submit">Lưu và nộp duyệt</button>
      </form>
    `);
  }

  function pageTutorEarnings() {
    const user = requireUser("tutor");
    if (!user) return "";
    const cases = casesForTutor(user.id);
    const payments = state.payments.filter((p) => cases.some((c) => c.id === p.caseId));
    return appShell("tutor", "earnings", `<section class="page-hero compact"><div><p class="kicker">Thu nhập</p><h1>Theo dõi thanh toán từ case đã chốt.</h1></div></section><section class="panel">${table(["Ngày", "Học sinh", "Số tiền", "Trạng thái"], payments.map((p) => { const c = caseOf(p.caseId); return [new Date(p.createdAt).toLocaleDateString("vi-VN"), userName(requestOf(c.requestId).studentId), money(p.amount), p.status]; }))}</section>`);
  }

  function pageAdmin() {
    const user = requireUser("admin");
    if (!user) return "";
    const pending = state.tutorProfiles.filter((p) => p.verificationStatus === "pending_review");
    return `<main class="admin-page"><header><a class="brand" href="#/"><span class="brand-mark">${icon("book")}</span><span>TutorMatch</span></a><button data-action="logout">${icon("logout")}Đăng xuất</button></header><section class="page-pad"><div class="page-hero compact"><div><p class="kicker">Admin</p><h1>Hàng chờ duyệt gia sư.</h1></div></div><div class="panel-list">${pending.map((profile) => { const tutor = userOf(profile.userId); return `<article class="row-card">${avatar(tutor)}<div><h3>${escapeHtml(tutor.name)}</h3><p>${escapeHtml(profile.subjects.join(", "))} · ${escapeHtml(profile.credentialFiles.join(", "))}</p></div><button class="primary" data-action="approve-tutor" data-user-id="${profile.userId}">Duyệt</button><form data-form="reject-tutor" data-user-id="${profile.userId}"><input name="reason" required placeholder="Lý do từ chối"><button type="submit">Từ chối</button></form></article>`; }).join("") || empty("Không còn hồ sơ chờ duyệt.", "Gia sư mới nộp sẽ xuất hiện ở đây.")}</div></section></main>`;
  }

  function tutorStatus(title, body) {
    return appShell("tutor", "dashboard", `<section class="state-card"><p class="kicker">Trạng thái hồ sơ</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><a class="primary" href="#/tutor/profile">Cập nhật hồ sơ</a></section>`);
  }

  function approvedTutors() {
    return state.tutorProfiles
      .filter((profile) => profile.verificationStatus === "approved")
      .map((profile) => ({ profile, user: userOf(profile.userId) }))
      .filter((item) => item.user);
  }

  function matchesForRequest(requestId) {
    const request = requestOf(requestId);
    if (!request) return [];
    return approvedTutors().filter(({ profile }) => {
      const subject = request.subjects.some((item) => profile.subjects.includes(item));
      const region = profile.regions.includes(request.region) || profile.regions.includes("Online") || request.format === "online";
      const format = profile.format === "both" || request.format === "both" || profile.format === request.format;
      const price = profile.hourlyRate <= Number(request.budgetMax || 0) + 80000;
      return subject && region && format && price;
    });
  }

  function openRequestsForTutor(tutorId) {
    const profile = profileOf(tutorId);
    if (!profile || profile.verificationStatus !== "approved") return [];
    return state.requests.filter((request) => request.status === "open").filter((request) => {
      const subject = request.subjects.some((item) => profile.subjects.includes(item));
      const region = profile.regions.includes(request.region) || profile.regions.includes("Online") || request.format === "online";
      const format = profile.format === "both" || request.format === "both" || profile.format === request.format;
      return subject && region && format;
    });
  }

  function casesForStudent(studentId) {
    return state.cases.filter((item) => requestOf(item.requestId)?.studentId === studentId);
  }

  function casesForTutor(tutorId) {
    return state.cases.filter((item) => item.tutorId === tutorId);
  }

  function otherParty(item, role) {
    const request = requestOf(item.requestId);
    return role === "student" ? userOf(item.tutorId) : userOf(request?.studentId);
  }

  function connectionFee(letter) {
    return Math.min(Number(letter.fee || 0) * Math.max(1, Math.min(Number(letter.lessonsCount || 1), 2)), SERVICE_FEE_CAP);
  }

  function setCaseStatus(caseId, nextStatus, meta = {}) {
    if (!CASE_STATUSES.includes(nextStatus)) throw new Error(`Invalid case status: ${nextStatus}`);
    const item = caseOf(caseId);
    if (!item) return;
    item.status = nextStatus;
    if (nextStatus === "cancelled") {
      item.cancelledReason = meta.reason || item.cancelledReason || "Đã hủy trước khi thanh toán.";
      item.cancelledBy = meta.by || state.currentUserId || "system";
    }
    if (nextStatus === "paid") {
      const request = requestOf(item.requestId);
      if (request) request.status = "closed";
      state.cases.forEach((sibling) => {
        if (sibling.id !== item.id && sibling.requestId === item.requestId && sibling.status !== "cancelled") {
          sibling.status = "cancelled";
          sibling.cancelledReason = "Phụ huynh đã thanh toán và chốt gia sư khác.";
          sibling.cancelledBy = "system";
        }
      });
    }
    save();
  }

  function metric(label, value, hint) {
    return `<article class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(hint)}</small></article>`;
  }

  function tutorListing(user, profile, preview = false) {
    return `<article class="tutor-card" data-search="${escapeHtml(`${user.name} ${profile.subjects.join(" ")} ${profile.regions.join(" ")}`)}" data-subject="${escapeHtml(profile.subjects[0])}" data-region="${escapeHtml(profile.regions[0])}">${avatar(user)}<div><h3>${escapeHtml(user.name)}</h3><p>${escapeHtml(profile.bio)}</p><div class="chip-row">${profile.subjects.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div><footer><b>${money(profile.hourlyRate)}/buổi</b><span>Rating ${profile.ratingAvg || "mới"}</span></footer></div>${preview ? "" : `<a class="ghost-link" href="#/student/tutor/${user.id}?request=r_seed">Xem hồ sơ</a><button class="primary" data-action="start-chat" data-request-id="r_seed" data-tutor-id="${user.id}">Nhắn tin</button>`}</article>`;
  }

  function requestRow(request) {
    const matches = matchesForRequest(request.id);
    return `<article class="row-card"><div><h3>${escapeHtml(request.subjects.join(", "))} · ${escapeHtml(request.grade)}</h3><p>${escapeHtml(request.region)} · ${labels[request.format]} · ${money(request.budgetMin)}-${money(request.budgetMax)}</p></div><span class="status">${labels[request.status]}</span><a class="ghost-link" href="#/student/tutors">Gia sư phù hợp (${matches.length})</a></article>`;
  }

  function openRequestRow(request) {
    return `<article class="row-card"><div><h3>${escapeHtml(request.subjects.join(", "))} · ${escapeHtml(request.grade)}</h3><p>${escapeHtml(request.region)} · ${labels[request.format]} · ${escapeHtml(request.schedule.join(", "))}</p><small>${escapeHtml(request.note || "")}</small></div><b>${money(request.budgetMin)}-${money(request.budgetMax)}</b><button class="primary" data-action="tutor-claim" data-request-id="${request.id}">Nhận case</button></article>`;
  }

  function caseRow(item) {
    const request = requestOf(item.requestId);
    const tutor = userOf(item.tutorId);
    const student = userOf(request?.studentId);
    return `<article class="row-card">${avatar(tutor)}<div><h3>${escapeHtml(tutor?.name || student?.name || "Case")}</h3><p>${escapeHtml(request?.subjects.join(", ") || "")} · ${escapeHtml(request?.grade || "")}</p>${item.status === "cancelled" ? `<small>${escapeHtml(item.cancelledReason)}</small>` : ""}</div><span class="status ${item.status}">${labels[item.status]}</span><a class="ghost-link" href="#/case/${item.id}/chat">Mở</a></article>`;
  }

  function sessionCard(item) {
    const request = requestOf(item.requestId);
    const tutor = userOf(item.tutorId);
    const letter = state.confirmationLetters.find((entry) => entry.caseId === item.id);
    const paid = ["paid", "active", "completed"].includes(item.status);
    return `<article class="session-card">${avatar(tutor)}<div><h3>${escapeHtml(tutor.name)}</h3><p>${escapeHtml(request.subjects.join(", "))} · ${escapeHtml(letter?.schedule || request.schedule.join(", "))}</p><p>${escapeHtml(letter ? `${letter.lessonsCount} buổi · ${money(letter.fee)}/buổi` : "Chưa có thư xác nhận")}</p>${paid ? `<small>${escapeHtml(tutor.phone)} · ${escapeHtml(tutor.email)}</small>` : `<small>Liên hệ đang khóa.</small>`}</div><span class="status">${labels[item.status]}</span><div class="actions">${item.status === "paid" ? `<button class="primary" data-action="activate-case" data-case-id="${item.id}">Bắt đầu học</button>` : ""}${item.status === "active" ? `<button class="primary" data-action="complete-case" data-case-id="${item.id}">Đánh dấu đã học</button>` : ""}</div></article>`;
  }

  function paymentRow(payment) {
    const item = caseOf(payment.caseId);
    return [new Date(payment.createdAt).toLocaleDateString("vi-VN"), userName(item?.tutorId), money(payment.amount), "Đã thanh toán", "Biên nhận"];
  }

  function dueRow(item) {
    const letter = state.confirmationLetters.find((entry) => entry.caseId === item.id);
    return ["Chờ", userName(item.tutorId), money(connectionFee(letter || { fee: 300000, lessonsCount: 1 })), "Chờ thanh toán", `<button class="table-button" data-action="pay-case" data-case-id="${item.id}">Thanh toán</button>`];
  }

  function table(headers, rows) {
    if (!rows.length) return empty("Chưa có dữ liệu.", "Khi có giao dịch, dữ liệu sẽ xuất hiện tại đây.");
    return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).includes("<button") ? cell : escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function empty(title, body) {
    return `<div class="empty"><b>${escapeHtml(title)}</b><p>${escapeHtml(body)}</p></div>`;
  }

  function select(name, label, items, selected = "") {
    return `<label>${escapeHtml(label)} <select name="${escapeHtml(name)}">${items.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(labels[item] || item)}</option>`).join("")}</select></label>`;
  }

  function multi(name, label, items, selected = []) {
    return `<fieldset><legend>${escapeHtml(label)}</legend><div class="check-grid">${items.map((item) => `<label><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(item)}" ${selected.includes(item) ? "checked" : ""}>${escapeHtml(item)}</label>`).join("")}</div></fieldset>`;
  }

  function formValues(form) {
    const data = new FormData(form);
    const values = Object.fromEntries(data.entries());
    ["subjects", "schedule", "regions", "availability"].forEach((key) => {
      values[key] = data.getAll(key);
    });
    return values;
  }

  function navigate(hash) {
    location.hash = hash;
  }

  function router() {
    const hash = location.hash || "#/";
    const [path, query = ""] = hash.slice(1).split("?");
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) return pageHome();
    if (parts[0] === "auth") return pageAuth(parts[1] || "login", parts[2] || "student");
    if (parts[0] === "student") {
      if (parts[1] === "tutors") return pageStudentTutors();
      if (parts[1] === "messages") return pageMessages("student");
      if (parts[1] === "payments") return pagePayments();
      if (parts[1] === "sessions" || parts[1] === "history") return pageSessions("student");
      if (parts[1] === "reviews") return pageReviews();
      if (parts[1] === "settings" || parts[1] === "profile") return pageSettings("student");
      if (parts[1] === "help") return pageHelp();
      if (parts[1] === "request" && parts[2] === "new") return pageRequestForm();
      if (parts[1] === "tutor") return pageTutorDetail(parts[2], new URLSearchParams(query).get("request") || "r_seed");
      return pageStudentDashboard();
    }
    if (parts[0] === "tutor") {
      if (parts[1] === "open-cases") return pageOpenCases();
      if (parts[1] === "messages") return pageMessages("tutor");
      if (parts[1] === "schedule") return pageSessions("tutor");
      if (parts[1] === "earnings") return pageTutorEarnings();
      if (parts[1] === "profile") return pageTutorProfile();
      if (parts[1] === "settings") return pageSettings("tutor");
      return pageTutorDashboard();
    }
    if (parts[0] === "case" && parts[2] === "chat") return pageMessages(currentUser()?.role || "student");
    if (parts[0] === "admin") return pageAdmin();
    return pageHome();
  }

  function render() {
    app.innerHTML = router();
    document.body?.classList?.toggle("has-tutoria-hero", Boolean(document.querySelector(".tutoria-hero")));
    app.focus?.({ preventScroll: true });
    initSubjectGallery();
    initHeroVideoCutouts();
  }

  function initHeroVideoCutouts() {
    cleanupHeroCutouts?.();
    cleanupHeroCutouts = null;
    if (typeof document.querySelectorAll !== "function" || typeof requestAnimationFrame !== "function") return;
    const canvases = [...document.querySelectorAll("[data-cutout-video]")];
    if (!canvases.length) return;

    const cleanups = canvases.map((canvas) => {
      const source = canvas.dataset.cutoutVideo;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!source || !context) return () => {};

      const video = document.createElement("video");
      video.src = source;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";

      const scratch = document.createElement("canvas");
      const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
      let frame = 0;
      let stopped = false;
      let ready = false;

      const sizeCanvas = () => {
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 720;
        const maxWidth = canvas.classList.contains("hero-human-object") ? 520 : 620;
        const scale = Math.min(1, maxWidth / width);
        const drawWidth = Math.max(1, Math.round(width * scale));
        const drawHeight = Math.max(1, Math.round(height * scale));
        if (canvas.width !== drawWidth || canvas.height !== drawHeight) {
          canvas.width = drawWidth;
          canvas.height = drawHeight;
          scratch.width = drawWidth;
          scratch.height = drawHeight;
        }
      };

      const makeCheckerTransparent = (pixels) => {
        const data = pixels.data;
        for (let index = 0; index < data.length; index += 4) {
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const max = Math.max(red, green, blue);
          const min = Math.min(red, green, blue);
          const isNeutral = max - min < 22;
          const isChecker = isNeutral && max > 158;
          if (isChecker) {
            data[index + 3] = 0;
          }
        }
      };

      const draw = () => {
        if (stopped) return;
        if (ready && video.readyState >= 2) {
          sizeCanvas();
          scratchContext.drawImage(video, 0, 0, scratch.width, scratch.height);
          const pixels = scratchContext.getImageData(0, 0, scratch.width, scratch.height);
          makeCheckerTransparent(pixels);
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.putImageData(pixels, 0, 0);
        }
        frame = requestAnimationFrame(draw);
      };

      const start = () => {
        ready = true;
        sizeCanvas();
        video.play().catch(() => {});
        draw();
      };

      video.addEventListener("loadeddata", start, { once: true });
      video.load();
      video.play().catch(() => {});

      return () => {
        stopped = true;
        cancelAnimationFrame(frame);
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    });

    cleanupHeroCutouts = () => cleanups.forEach((cleanup) => cleanup());
  }

  function initSubjectGallery() {
    cleanupSubjectGallery?.();
    cleanupSubjectGallery = null;
    if (typeof document.querySelector !== "function" || typeof requestAnimationFrame !== "function") return;
    const gallery = document.querySelector("[data-subject-gallery]");
    if (!gallery) return;
    const cards = [...gallery.querySelectorAll(".subject-card")];
    if (!cards.length) return;
    const loopSize = Math.max(1, Math.floor(cards.length / 3));

    let frame = 0;
    let scrollAnimation = 0;
    const easeInOutCubic = (value) => value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
    const stopScrollAnimation = () => {
      if (!scrollAnimation) return;
      cancelAnimationFrame(scrollAnimation);
      scrollAnimation = 0;
    };
    const animateScrollTo = (left, duration = 1050) => {
      stopScrollAnimation();
      const start = gallery.scrollLeft;
      const delta = left - start;
      const startedAt = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        gallery.scrollLeft = start + delta * easeInOutCubic(progress);
        requestUpdate();
        if (progress < 1) {
          scrollAnimation = requestAnimationFrame(tick);
        } else {
          scrollAnimation = 0;
        }
      };
      scrollAnimation = requestAnimationFrame(tick);
    };
    const centerCard = (card, behavior = "smooth") => {
      const left = card.offsetLeft + card.offsetWidth / 2 - gallery.clientWidth / 2;
      if (behavior === "smooth") {
        animateScrollTo(left);
      } else {
        stopScrollAnimation();
        gallery.scrollTo({ left, behavior });
      }
    };
    const syncEdgeSpace = () => {
      const edge = Math.max(20, gallery.clientWidth / 2 - cards[0].offsetWidth / 2);
      gallery.style.setProperty("--subject-edge", `${edge}px`);
    };
    const loopWidth = () => cards[loopSize]?.offsetLeft - cards[0].offsetLeft || 0;
    const normalizeLoop = () => {
      const width = loopWidth();
      if (!width) return;
      const center = gallery.scrollLeft + gallery.clientWidth / 2;
      const middleStart = cards[loopSize].offsetLeft;
      const middleEnd = cards[loopSize * 2].offsetLeft;
      if (center >= middleEnd) {
        gallery.scrollLeft -= width;
      } else if (center < middleStart) {
        gallery.scrollLeft += width;
      }
    };
    const closestCard = () => {
      const center = gallery.scrollLeft + gallery.clientWidth / 2;
      return cards.reduce((best, card) => {
        const bestDistance = Math.abs(best.offsetLeft + best.offsetWidth / 2 - center);
        const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        return distance < bestDistance ? card : best;
      }, cards[0]);
    };
    const update = () => {
      frame = 0;
      syncEdgeSpace();
      normalizeLoop();
      const center = gallery.scrollLeft + gallery.clientWidth / 2;
      const maxDistance = gallery.clientWidth * .45;
      cards.forEach((card) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const offset = Math.max(-1.45, Math.min(1.45, (cardCenter - center) / maxDistance));
        const strength = 1 - Math.min(1, Math.abs(offset));
        const abs = Math.min(1.25, Math.abs(offset));
        const rotate = offset * -58;
        const pullToArc = offset * -72;
        const lift = abs * 36 - strength * 22;
        const depth = -Math.pow(abs, 1.35) * 420;
        const scale = .62 + strength * .42;
        const opacity = .24 + strength * .76;
        card.style.transform = `translate3d(${pullToArc}px, ${lift}px, ${depth}px) rotateY(${rotate}deg) scale(${scale})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.zIndex = String(Math.round(strength * 100));
      });
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    let autoFrame = 0;
    let lastAutoTime = 0;
    let autoPaused = false;
    const startAutoRotate = () => {
      cancelAnimationFrame(autoFrame);
      lastAutoTime = performance.now();
      const drift = (now) => {
        const delta = Math.min(64, now - lastAutoTime);
        lastAutoTime = now;
        if (!autoPaused && !document.hidden) {
          gallery.scrollLeft += delta * .075;
          normalizeLoop();
          requestUpdate();
        }
        autoFrame = requestAnimationFrame(drift);
      };
      autoFrame = requestAnimationFrame(drift);
    };
    const pauseAutoRotate = () => {
      autoPaused = true;
      stopScrollAnimation();
    };
    const pauseAndSettleAutoRotate = () => {
      autoPaused = true;
      centerCard(closestCard(), "smooth");
    };
    const resumeAutoRotate = () => {
      autoPaused = false;
      lastAutoTime = performance.now();
    };

    gallery.addEventListener("scroll", requestUpdate, { passive: true });
    gallery.addEventListener("pointerenter", pauseAndSettleAutoRotate);
    gallery.addEventListener("pointerleave", resumeAutoRotate);
    gallery.addEventListener("pointerdown", pauseAutoRotate);
    gallery.addEventListener("pointerup", resumeAutoRotate);
    gallery.addEventListener("pointercancel", resumeAutoRotate);
    gallery.addEventListener("touchstart", pauseAutoRotate, { passive: true });
    gallery.addEventListener("touchend", resumeAutoRotate, { passive: true });
    gallery.addEventListener("touchcancel", resumeAutoRotate, { passive: true });
    gallery.addEventListener("focusin", pauseAutoRotate);
    gallery.addEventListener("focusout", resumeAutoRotate);
    const handleResize = () => {
      syncEdgeSpace();
      centerCard(closestCard(), "auto");
      requestUpdate();
    };
    window.addEventListener("resize", handleResize, { passive: true });
    cleanupSubjectGallery = () => {
      cancelAnimationFrame(autoFrame);
      stopScrollAnimation();
      gallery.removeEventListener("scroll", requestUpdate);
      gallery.removeEventListener("pointerenter", pauseAndSettleAutoRotate);
      gallery.removeEventListener("pointerleave", resumeAutoRotate);
      gallery.removeEventListener("pointerdown", pauseAutoRotate);
      gallery.removeEventListener("pointerup", resumeAutoRotate);
      gallery.removeEventListener("pointercancel", resumeAutoRotate);
      gallery.removeEventListener("touchstart", pauseAutoRotate);
      gallery.removeEventListener("touchend", resumeAutoRotate);
      gallery.removeEventListener("touchcancel", resumeAutoRotate);
      gallery.removeEventListener("focusin", pauseAutoRotate);
      gallery.removeEventListener("focusout", resumeAutoRotate);
      window.removeEventListener("resize", handleResize);
      if (frame) cancelAnimationFrame(frame);
    };
    requestAnimationFrame(() => {
      syncEdgeSpace();
      centerCard(cards[loopSize + Math.floor(loopSize / 2)], "auto");
      update();
      startAutoRotate();
    });
  }

  document.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === "open-mobile-menu") {
      document.body.classList.add("menu-open");
      document.getElementById("mobile-menu")?.setAttribute("aria-hidden", "false");
      return;
    }
    if (action === "close-mobile-menu") {
      document.body.classList.remove("menu-open");
      document.getElementById("mobile-menu")?.setAttribute("aria-hidden", "true");
      return;
    }
    if (action === "logout") {
      state.currentUserId = null;
      save();
      navigate("#/");
    }
    if (action === "start-chat") {
      const requestId = actionEl.dataset.requestId || "r_seed";
      const tutorId = actionEl.dataset.tutorId;
      let item = state.cases.find((entry) => entry.requestId === requestId && entry.tutorId === tutorId && entry.status !== "cancelled");
      if (!item) {
        item = { id: `c_${Date.now()}`, requestId, tutorId, status: "negotiating", cancelledReason: "", cancelledBy: "", createdAt: new Date().toISOString() };
        state.cases.push(item);
      } else if (item.status === "pending") item.status = "negotiating";
      state.ui.activeConversationId = item.id;
      save();
      navigate("#/student/messages");
    }
    if (action === "tutor-claim") {
      const tutor = currentUser();
      const requestId = actionEl.dataset.requestId;
      let item = state.cases.find((entry) => entry.requestId === requestId && entry.tutorId === tutor.id && entry.status !== "cancelled");
      if (!item) state.cases.push({ id: `c_${Date.now()}`, requestId, tutorId: tutor.id, status: "negotiating", cancelledReason: "", cancelledBy: "", createdAt: new Date().toISOString() });
      save();
      navigate("#/tutor/messages");
    }
    if (action === "open-conversation") {
      state.ui.activeConversationId = actionEl.dataset.caseId;
      save();
      render();
    }
    if (action === "pay-case") {
      const caseId = actionEl.dataset.caseId;
      const item = caseOf(caseId);
      const letter = state.confirmationLetters.find((entry) => entry.caseId === caseId) || { fee: 300000, lessonsCount: 1 };
      state.payments.push({ id: `p_${Date.now()}`, caseId, payerId: currentUser().id, amount: connectionFee(letter), status: "completed", createdAt: new Date().toISOString() });
      setCaseStatus(caseId, "paid");
      navigate("#/student/sessions");
    }
    if (action === "confirm-case") {
      const caseId = actionEl.dataset.caseId;
      const item = caseOf(caseId);
      const request = requestOf(item.requestId);
      if (!state.confirmationLetters.some((letter) => letter.caseId === caseId)) {
        const fee = Math.min(Number(request?.budgetMax || 300000), Number(profileOf(item.tutorId)?.hourlyRate || 300000));
        state.confirmationLetters.push({ caseId, lessonsCount: 4, schedule: request?.schedule?.[0] || "Theo lịch đã trao đổi", fee, format: request?.format || "online", note: "Thư xác nhận được tạo từ cuộc trò chuyện trong app.", createdAt: new Date().toISOString() });
      }
      item.status = "awaiting_payment";
      save();
      navigate(currentUser().role === "student" ? "#/student/payments" : "#/tutor/messages");
    }
    if (action === "activate-case") {
      setCaseStatus(actionEl.dataset.caseId, "active");
      render();
    }
    if (action === "complete-case") {
      setCaseStatus(actionEl.dataset.caseId, "completed");
      navigate(`/${currentUser().role}/reviews`);
    }
    if (action === "approve-tutor") {
      const profile = profileOf(actionEl.dataset.userId);
      profile.verificationStatus = "approved";
      profile.rejectionReason = "";
      save();
      render();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.body.classList.remove("menu-open");
    document.getElementById("mobile-menu")?.setAttribute("aria-hidden", "true");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".mobile-menu a")) return;
    document.body.classList.remove("menu-open");
    document.getElementById("mobile-menu")?.setAttribute("aria-hidden", "true");
  });

  document.addEventListener("input", (event) => {
    const scope = event.target.closest("[data-filter-scope='tutors']");
    if (!scope) return;
    const text = scope.querySelector("[data-filter-text]").value.toLowerCase();
    const subject = scope.querySelector("[data-filter-subject]").value;
    const region = scope.querySelector("[data-filter-region]").value;
    document.querySelectorAll(".tutor-card").forEach((card) => {
      const okText = !text || card.dataset.search.toLowerCase().includes(text);
      const okSubject = !subject || card.dataset.search.includes(subject);
      const okRegion = !region || card.dataset.search.includes(region);
      card.hidden = !(okText && okSubject && okRegion);
    });
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const type = form.dataset.form;
    const values = formValues(form);
    if (type === "hero-search") {
      navigate("#/auth/register/student");
    }
    if (type === "login") {
      const user = state.users.find((item) => item.email === values.email && item.password === values.password);
      if (!user) {
        alert("Email hoặc mật khẩu chưa đúng.");
        return;
      }
      state.currentUserId = user.id;
      save();
      navigate(user.role === "admin" ? "#/admin" : `#/${user.role}`);
    }
    if (type === "register") {
      const role = values.role || "student";
      const user = { id: `u_${Date.now()}`, name: role === "student" ? "Người học mới" : "Gia sư mới", email: values.email, password: values.password, role, studentKind: "parent", phone: values.phone, address: "Chưa cập nhật", avatarUrl: role === "student" ? "assets/profile-review-emily.png" : "assets/tutor-isabella.png", createdAt: new Date().toISOString() };
      state.users.push(user);
      if (role === "tutor") state.tutorProfiles.push({ userId: user.id, subjects: ["Toán"], regions: ["Online"], format: "online", hourlyRate: 250000, age: 20, educationLevel: "college", availability: ["T3 tối"], bio: "Gia sư mới đang hoàn thiện hồ sơ.", credentialFiles: ["pending.pdf"], verificationStatus: "pending_review", rejectionReason: "", ratingAvg: 0 });
      state.currentUserId = user.id;
      save();
      navigate(`#/${role}`);
    }
    if (type === "request") {
      const request = { id: `r_${Date.now()}`, studentId: currentUser().id, subjects: values.subjects, grade: values.grade, region: values.region, format: values.format, schedule: values.schedule, budgetMin: Number(values.budgetMin), budgetMax: Number(values.budgetMax), studentsCount: Number(values.studentsCount), note: values.note, status: "open", createdAt: new Date().toISOString() };
      state.requests.push(request);
      save();
      navigate("#/student/tutors");
    }
    if (type === "message") {
      state.messages.push({ id: `m_${Date.now()}`, caseId: form.dataset.caseId, senderId: currentUser().id, content: values.content, createdAt: new Date().toISOString() });
      const item = caseOf(form.dataset.caseId);
      if (item.status === "pending") item.status = "negotiating";
      save();
      render();
    }
    if (type === "tutor-profile") {
      let profile = profileOf(currentUser().id);
      if (!profile) {
        profile = { userId: currentUser().id, ratingAvg: 0, verificationStatus: "pending_review", rejectionReason: "" };
        state.tutorProfiles.push(profile);
      }
      Object.assign(profile, { subjects: values.subjects, regions: values.regions, format: values.format, hourlyRate: Number(values.hourlyRate), availability: values.availability, bio: values.bio, credentialFiles: [values.credential || "credential.pdf"], verificationStatus: "pending_review", rejectionReason: "" });
      save();
      render();
    }
    if (type === "reject-tutor") {
      const profile = profileOf(form.dataset.userId);
      profile.verificationStatus = "rejected";
      profile.rejectionReason = values.reason;
      save();
      render();
    }
  });

  window.addEventListener("hashchange", render);
  window.tutormatchStateMachine = { getState: () => state, setCaseStatus, connectionFee };
  render();
})();
