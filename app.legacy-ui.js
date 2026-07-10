(function () {
  const STORAGE_KEY = "tutormatch_mvp_v2";
  const API_BASE_URL = (window.TUTORMATCH_API_BASE_URL || "").replace(/\/$/, "");
  const API_STATE_URL = `${API_BASE_URL}/api/state`;
  const app = document.getElementById("app");
  let backendEnabled = location.protocol !== "file:";

  const SUBJECTS = ["Toán", "Tiếng Anh", "Vật lý", "Hóa học", "Ngữ văn", "IELTS", "Tin học"];
  const REGIONS = ["Quận 1", "Quận 3", "Quận 7", "Bình Thạnh", "Thủ Đức", "Online"];
  const SLOTS = ["T2 tối", "T3 tối", "T4 chiều", "T5 tối", "T7 sáng", "CN chiều"];
  const FORMATS = ["online", "home", "both"];
  const EDUCATION_LEVELS = ["below_grade_10", "grade_10", "high_school", "college", "bachelor", "master"];
  const SERVICE_FEE_CAP = 500000;
  const CASE_STATUSES = ["pending", "negotiating", "confirmed", "awaiting_payment", "paid", "active", "completed", "cancelled"];

  const labels = {
    pending: "Chờ phản hồi",
    negotiating: "Đang chat",
    confirmed: "Đã xác nhận",
    awaiting_payment: "Chờ thanh toán",
    paid: "Đã thanh toán",
    active: "Đang học",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
    open: "Đang mở",
    closed: "Đã đóng",
    online: "Online",
    home: "Tại nhà",
    both: "Cả hai",
    parent: "Phụ huynh",
    self_student: "Tự học sinh",
    below_grade_10: "Dưới lớp 10",
    grade_10: "Tối thiểu lớp 10",
    high_school: "Tốt nghiệp THPT",
    college: "Cao đẳng/Đại học đang học",
    bachelor: "Cử nhân",
    master: "Sau đại học",
    pending_review: "Chờ duyệt",
    approved: "Đã xác minh",
    rejected: "Bị từ chối"
  };

  const roleLabels = {
    admin: "Quản trị viên",
    student: "Phụ huynh/Học sinh",
    tutor: "Gia sư"
  };

  const seed = {
    currentUserId: null,
    users: [
      {
        id: "u_student",
        name: "Anh Thư",
        email: "student@example.com",
        password: "Pass123!",
        role: "student",
        studentKind: "parent",
        phone: "0901 111 222",
        address: "Quận 3, TP.HCM",
        avatarUrl: "assets/profile-review-emily.png",
        createdAt: "2026-06-01T09:00:00.000Z"
      },
      {
        id: "u_tutor",
        name: "Minh Khang",
        email: "tutor@example.com",
        password: "Pass123!",
        role: "tutor",
        phone: "0902 333 444",
        address: "Bình Thạnh, TP.HCM",
        avatarUrl: "assets/tutor-alex.png",
        createdAt: "2026-06-01T09:10:00.000Z"
      },
      {
        id: "u_tutor_lan",
        name: "Lê Lan Anh",
        email: "lan.tutor@example.com",
        password: "Pass123!",
        role: "tutor",
        phone: "0907 222 118",
        address: "Quận 1, TP.HCM",
        avatarUrl: "assets/student05-priya.png",
        createdAt: "2026-06-01T09:12:00.000Z"
      },
      {
        id: "u_tutor_khoa",
        name: "Phạm Minh Khoa",
        email: "khoa.tutor@example.com",
        password: "Pass123!",
        role: "tutor",
        phone: "0908 667 889",
        address: "Thủ Đức, TP.HCM",
        avatarUrl: "assets/student05-daniel.png",
        createdAt: "2026-06-01T09:14:00.000Z"
      },
      {
        id: "u_tutor_pending",
        name: "Trần Mai Chi",
        email: "pending.tutor@example.com",
        password: "Pass123!",
        role: "tutor",
        phone: "0905 999 888",
        address: "Quận 7, TP.HCM",
        avatarUrl: "assets/tutor-isabella.png",
        createdAt: "2026-06-01T09:20:00.000Z"
      },
      {
        id: "u_tutor_sophia",
        name: "Nguyễn Phương Linh",
        email: "sophia.tutor@example.com",
        password: "Pass123!",
        role: "tutor",
        phone: "0909 555 121",
        address: "Quận 3, TP.HCM",
        avatarUrl: "assets/profile-sophia.png",
        createdAt: "2026-06-01T09:24:00.000Z"
      },
      {
        id: "u_admin",
        name: "Admin TutorMatch",
        email: "admin@example.com",
        password: "Pass123!",
        role: "admin",
        phone: "support@tutormatch.vn",
        address: "Back office",
        createdAt: "2026-06-01T09:30:00.000Z"
      }
    ],
    tutorProfiles: [
      {
        userId: "u_tutor",
        subjects: ["Toán", "Vật lý", "IELTS"],
        regions: ["Quận 1", "Quận 3", "Bình Thạnh", "Online"],
        format: "both",
        hourlyRate: 280000,
        age: 24,
        educationLevel: "bachelor",
        availability: ["T3 tối", "T5 tối", "T7 sáng"],
        bio: "Gia sư 5 năm kinh nghiệm luyện thi chuyển cấp và IELTS foundation. Ưu tiên lộ trình rõ ràng, có bài tập sau mỗi buổi.",
        credentialFiles: ["bang-su-pham-gia-huy.pdf", "ielts-8.0.jpg"],
        verificationStatus: "approved",
        rejectionReason: "",
        ratingAvg: 4.9
      },
      {
        userId: "u_tutor_lan",
        subjects: ["Tiếng Anh", "IELTS", "Ngữ văn"],
        regions: ["Quận 1", "Quận 3", "Online"],
        format: "online",
        hourlyRate: 320000,
        age: 27,
        educationLevel: "master",
        availability: ["T2 tối", "T5 tối", "CN chiều"],
        bio: "Chuyên luyện IELTS và tiếng Anh học thuật. Mỗi học sinh có bài kiểm tra đầu vào, mục tiêu điểm số và lộ trình theo tuần.",
        credentialFiles: ["tesol-lan-anh.pdf", "ielts-8.5-lan-anh.jpg"],
        verificationStatus: "approved",
        rejectionReason: "",
        ratingAvg: 4.8
      },
      {
        userId: "u_tutor_khoa",
        subjects: ["Tin học", "Toán"],
        regions: ["Thủ Đức", "Bình Thạnh", "Online"],
        format: "both",
        hourlyRate: 260000,
        age: 22,
        educationLevel: "college",
        availability: ["T4 chiều", "T7 sáng", "CN chiều"],
        bio: "Hỗ trợ học sinh cấp 2-3 học Toán và lập trình căn bản. Cách dạy đi từ ví dụ thực tế, bài tập ngắn và phản hồi sau từng buổi.",
        credentialFiles: ["student-card-khoa.jpg", "coding-award-khoa.pdf"],
        verificationStatus: "approved",
        rejectionReason: "",
        ratingAvg: 4.7
      },
      {
        userId: "u_tutor_pending",
        subjects: ["Tiếng Anh", "Ngữ văn"],
        regions: ["Quận 7", "Online"],
        format: "online",
        hourlyRate: 220000,
        age: 19,
        educationLevel: "college",
        availability: ["T2 tối", "CN chiều"],
        bio: "Đang nộp hồ sơ xác minh. Có kinh nghiệm kèm học sinh lớp 6-9.",
        credentialFiles: ["student-card-mai-chi.jpg"],
        verificationStatus: "pending_review",
        rejectionReason: "",
        ratingAvg: 0
      },
      {
        userId: "u_tutor_sophia",
        subjects: ["Toán", "Giải tích"],
        regions: ["Quận 1", "Quận 3", "Online"],
        format: "both",
        hourlyRate: 350000,
        age: 29,
        educationLevel: "master",
        availability: ["T2 16:00 - 18:00", "T3 19:00 - 21:00", "T5 19:00 - 21:00", "T7 09:00 - 11:00"],
        bio: "Giúp học sinh lấy lại nền tảng Toán và tự tin hơn trước mỗi kỳ kiểm tra.",
        credentialFiles: ["ms-applied-mathematics.pdf", "background-check.pdf"],
        verificationStatus: "approved",
        rejectionReason: "",
        ratingAvg: 5
      }
    ],
    requests: [
      {
        id: "r_seed",
        studentId: "u_student",
        subjects: ["Toán", "Vật lý"],
        grade: "Lớp 10",
        region: "Bình Thạnh",
        format: "home",
        schedule: ["T3 tối", "T7 sáng"],
        budgetMin: 220000,
        budgetMax: 320000,
        studentsCount: 1,
        note: "Cần gia sư giúp lấy lại nền tảng và chuẩn bị kiểm tra giữa kỳ.",
        status: "open",
        createdAt: "2026-06-02T10:00:00.000Z"
      }
    ],
    cases: [
      {
        id: "c_seed",
        requestId: "r_seed",
        tutorId: "u_tutor",
        status: "negotiating",
        cancelledReason: "",
        cancelledBy: "",
        createdAt: "2026-06-02T10:30:00.000Z"
      }
    ],
    confirmationLetters: [],
    payments: [],
    tutorDashboardData: {
      u_tutor: {
        stats: {
          totalStudents: 48,
          totalStudentsDelta: 5,
          pendingRequests: 7,
          monthlyEarnings: 24500000,
          monthlyEarningsDelta: 18,
          completedSessions: 36,
          completedSessionsDelta: 8
        },
        pendingRequests: [
          {
            id: "tdr_1",
            studentName: "Mai Anh",
            avatarUrl: "assets/tutor-sophia.png",
            subject: "Toán",
            level: "Lớp 10",
            location: "Quận 3, TP.HCM",
            rate: 350000,
            status: "pending"
          },
          {
            id: "tdr_2",
            studentName: "Quốc Huy",
            avatarUrl: "assets/tutor-ethan.png",
            subject: "Vật lý",
            level: "Lớp 11",
            location: "Bình Thạnh, TP.HCM",
            rate: 300000,
            status: "pending"
          },
          {
            id: "tdr_3",
            studentName: "Minh Châu",
            avatarUrl: "assets/tutor-isabella.png",
            subject: "Tiếng Anh",
            level: "IELTS foundation",
            location: "Online",
            rate: 320000,
            status: "pending"
          }
        ],
        upcomingLessons: [
          { id: "tdl_1", month: "TH6", day: "22", weekday: "T7", studentName: "Mai Anh", subject: "Toán", level: "Lớp 10", time: "16:00 - 17:00", format: "Online" },
          { id: "tdl_2", month: "TH6", day: "23", weekday: "CN", studentName: "Quốc Huy", subject: "Vật lý", level: "Lớp 11", time: "18:00 - 19:00", format: "Online" },
          { id: "tdl_3", month: "TH6", day: "24", weekday: "T2", studentName: "Minh Châu", subject: "Tiếng Anh", level: "IELTS foundation", time: "19:00 - 20:00", format: "Tại nhà" },
          { id: "tdl_4", month: "TH6", day: "25", weekday: "T3", studentName: "Gia Bảo", subject: "Hóa học", level: "Lớp 12", time: "20:00 - 21:00", format: "Online" }
        ],
        earnings: {
          monthlyIncome: 14250000,
          yearlyGrowth: 24,
          ytd: 14250000,
          highestMonth: 2650000,
          highestMonthLabel: "Th7",
          averagePerMonth: 1293000,
          months: [
            { label: "T1", value: 420 },
            { label: "T2", value: 680 },
            { label: "T3", value: 1000 },
            { label: "T4", value: 920 },
            { label: "T5", value: 1420 },
            { label: "T6", value: 1680 },
            { label: "T7", value: 1860 },
            { label: "T8", value: 2250 },
            { label: "T9", value: 1780 },
            { label: "T10", value: 1200 },
            { label: "T11", value: 1500 },
            { label: "T12", value: 1920 }
          ]
        }
      }
    },
    studentDashboardData: {
      u_student: {
        stats: {
          activeTutors: 2,
          upcomingLessons: 3,
          totalSpent: 640000,
          completedSessions: 18
        },
        requests: [
          {
            id: "sdr_1",
            tutorName: "Minh Khang",
            avatarUrl: "assets/student05-alex.png",
            tutorId: "u_tutor_sophia",
            subject: "Toán",
            subjectDetail: "Lớp 10",
            requestedOn: "14/06/2026",
            status: "pending",
            action: "Xem hồ sơ"
          },
          {
            id: "sdr_2",
            tutorName: "Lê Lan Anh",
            avatarUrl: "assets/student05-priya.png",
            subject: "Tiếng Anh",
            subjectDetail: "IELTS foundation",
            requestedOn: "10/06/2026",
            status: "matched",
            action: "Nhắn tin"
          },
          {
            id: "sdr_3",
            tutorName: "Phạm Minh Khoa",
            avatarUrl: "assets/student05-daniel.png",
            subject: "Tin học",
            subjectDetail: "Lớp 11",
            requestedOn: "06/06/2026",
            status: "active",
            action: "Xem buổi học"
          }
        ],
        lessons: [
          {
            id: "sdl_1",
            month: "TH6",
            day: "20",
            weekday: "T7",
            tutorName: "Minh Khang",
            avatarUrl: "assets/student05-alex.png",
            subject: "Toán",
            topic: "Ôn hàm số bậc hai",
            time: "16:00 - 17:00",
            status: "Đã lên lịch"
          },
          {
            id: "sdl_2",
            month: "TH6",
            day: "22",
            weekday: "T2",
            tutorName: "Lê Lan Anh",
            avatarUrl: "assets/student05-priya.png",
            subject: "Tiếng Anh",
            topic: "IELTS foundation",
            time: "19:00 - 20:00",
            status: "Đã lên lịch"
          },
          {
            id: "sdl_3",
            month: "TH6",
            day: "24",
            weekday: "T4",
            tutorName: "Phạm Minh Khoa",
            avatarUrl: "assets/student05-daniel.png",
            subject: "Tin học",
            topic: "Cấu trúc dữ liệu cơ bản",
            time: "18:30 - 19:30",
            status: "Đã xác nhận"
          }
        ]
      }
    },
    messages: [
      {
        id: "m_seed_1",
        caseId: "c_seed",
        senderId: "u_student",
        content: "Chào thầy, em muốn học Toán và Vật lý lớp 10 vào tối thứ 3 hoặc sáng thứ 7.",
        createdAt: "2026-06-02T10:35:00.000Z"
      },
      {
        id: "m_seed_2",
        caseId: "c_seed",
        senderId: "u_tutor",
        content: "Chào anh/chị, em phù hợp lịch T3 tối. Mình có thể học thử 1 buổi trước, phí 280k/buổi.",
        createdAt: "2026-06-02T10:40:00.000Z"
      }
    ],
    reviews: []
  };

  let state = loadState();
  hydrateSeedAdditions();

  function loadState() {
    if (backendEnabled) {
      try {
        const request = new XMLHttpRequest();
        request.open("GET", API_STATE_URL, false);
        request.setRequestHeader("Accept", "application/json");
        request.send();
        if (request.status >= 200 && request.status < 300) {
          const payload = JSON.parse(request.responseText || "{}");
          if (payload.state) return payload.state;
          const initial = structuredClone(seed);
          persistBackendState(initial);
          return initial;
        }
        backendEnabled = false;
      } catch (error) {
        backendEnabled = false;
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return structuredClone(seed);
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return structuredClone(seed);
    }
  }

  function hydrateSeedAdditions() {
    let changed = false;
    state.users ||= [];
    state.tutorProfiles ||= [];
    state.requests ||= [];
    state.cases ||= [];
    state.confirmationLetters ||= [];
    state.payments ||= [];
    state.messages ||= [];
    state.reviews ||= [];
    state.tutorDashboardData ||= {};
    state.studentDashboardData ||= {};
    state.studentPortalData ||= {};

    seed.users.forEach((seedUser) => {
      if (!state.users.some((user) => user.id === seedUser.id)) {
        state.users.push(structuredClone(seedUser));
        changed = true;
      }
    });

    const seededStudent = state.users.find((user) => user.id === "u_student");
    if (seededStudent && ["Minh Anh Parent", "Thảo Nguyễn", "Sarah"].includes(seededStudent.name)) {
      seededStudent.name = "Anh Thư";
      changed = true;
    }

    const seededTutor = state.users.find((user) => user.id === "u_tutor");
    if (seededTutor && (seededTutor.name !== "Minh Khang" || seededTutor.avatarUrl !== "assets/tutor-alex.png")) {
      seededTutor.name = "Minh Khang";
      seededTutor.avatarUrl = "assets/tutor-alex.png";
      changed = true;
    }

    seed.users.forEach((seedUser) => {
      const existing = state.users.find((user) => user.id === seedUser.id);
      if (existing && seedUser.avatarUrl && !existing.avatarUrl) {
        existing.avatarUrl = seedUser.avatarUrl;
        changed = true;
      }
    });

    seed.tutorProfiles.forEach((seedProfile) => {
      if (!state.tutorProfiles.some((profile) => profile.userId === seedProfile.userId)) {
        state.tutorProfiles.push(structuredClone(seedProfile));
        changed = true;
      }
    });

    Object.entries(seed.tutorDashboardData || {}).forEach(([userId, dashboard]) => {
      if (!state.tutorDashboardData[userId]) {
        state.tutorDashboardData[userId] = structuredClone(dashboard);
        changed = true;
      } else {
        dashboard.pendingRequests?.forEach((seedItem) => {
          const existing = state.tutorDashboardData[userId].pendingRequests?.find((item) => item.id === seedItem.id);
          if (existing && existing.avatarUrl !== seedItem.avatarUrl) {
            existing.avatarUrl = seedItem.avatarUrl;
            changed = true;
          }
        });
        if (state.tutorDashboardData[userId].stats?.pendingRequests !== dashboard.stats.pendingRequests) {
          state.tutorDashboardData[userId].stats.pendingRequests = dashboard.stats.pendingRequests;
          changed = true;
        }
      }
    });

    Object.entries(seed.studentDashboardData || {}).forEach(([userId, dashboard]) => {
      if (!state.studentDashboardData[userId]) {
        state.studentDashboardData[userId] = structuredClone(dashboard);
        changed = true;
      }
    });

    state.users.filter((user) => user.role === "student").forEach((user) => {
      if (!state.studentPortalData[user.id]) {
        state.studentPortalData[user.id] = defaultStudentPortalData();
        changed = true;
      }
    });

    if (changed) save();
  }

  function save() {
    if (backendEnabled) {
      persistBackendState(state);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function persistBackendState(nextState) {
    try {
      const payload = JSON.stringify({ state: nextState });
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(API_STATE_URL, new Blob([payload], { type: "application/json" }));
        if (sent) return;
      }
      fetch(API_STATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      });
    } catch (error) {
      backendEnabled = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.currentUserId) || null;
  }

  function dashboardPath(user = currentUser()) {
    if (!user) return "#/";
    if (user.role === "admin") return "#/admin";
    return `#/${user.role}`;
  }

  function navigate(route) {
    location.hash = route;
  }

  function money(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function connectionFee(letter) {
    if (!letter) return 0;
    return Math.min(Number(letter.fee || 0) * Math.min(Number(letter.lessonsCount || 1), 2), SERVICE_FEE_CAP);
  }

  function fmtDate(value) {
    return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function userName(userId) {
    return state.users.find((user) => user.id === userId)?.name || "Người dùng";
  }

  function avatarMarkup(user, size = "") {
    const initials = escapeHtml((user?.name || "TM").slice(0, 2).toUpperCase());
    if (user?.avatarUrl) {
      return `<img class="avatar ${size}" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" />`;
    }
    return `<div class="avatar ${size}">${initials}</div>`;
  }

  function profileOf(userId) {
    return state.tutorProfiles.find((profile) => profile.userId === userId);
  }

  function requestOf(id) {
    return state.requests.find((request) => request.id === id);
  }

  function caseOf(id) {
    return state.cases.find((item) => item.id === id);
  }

  function studentIdForCase(item) {
    return requestOf(item?.requestId)?.studentId;
  }

  function canAccessCase(user, item) {
    return Boolean(user && item && (user.role === "admin" || user.id === item.tutorId || user.id === studentIdForCase(item)));
  }

  function caseTitle(item) {
    const request = requestOf(item.requestId);
    return `${request?.subjects.join(", ") || "Yêu cầu"} · ${userName(item.tutorId)}`;
  }

  function learnerCopy(user) {
    const selfStudent = user?.studentKind === "self_student";
    return {
      dashboardTitle: selfStudent ? "Bạn đang muốn học gì?" : "Con đang cần học gì?",
      dashboardGreeting: selfStudent ? "bạn đang muốn học gì?" : "con đang cần học gì?",
      formTitle: selfStudent ? "Bạn cần gia sư như thế nào?" : "Con cần gia sư như thế nào?",
      notePlaceholder: selfStudent
        ? "Ví dụ: mình mất gốc phần hình học, cần người kiên nhẫn, muốn cải thiện điểm kiểm tra trong 8 tuần..."
        : "Ví dụ: con mất gốc phần hình học, cần người kiên nhẫn, muốn cải thiện điểm kiểm tra trong 8 tuần..."
    };
  }

  function paymentAction(item, role, classes = "small") {
    if (item.status !== "confirmed") return "";
    if (role === "student") {
      return `<button class="button ${classes}" type="button" data-action="prepare-payment" data-case-id="${item.id}">Thanh toán để mở liên hệ</button>`;
    }
    if (role === "tutor") {
      return `<button class="button ${classes}" type="button" data-action="await-payment" data-case-id="${item.id}">Gửi yêu cầu thanh toán</button>`;
    }
    return "";
  }

  function matchLabel(score) {
    if (score >= 10) return "Rất phù hợp";
    if (score >= 7) return "Phù hợp";
    return "Có thể trao đổi thêm";
  }

  function approvedTutors() {
    return state.tutorProfiles
      .filter((profile) => profile.verificationStatus === "approved")
      .map((profile) => ({ profile, user: state.users.find((user) => user.id === profile.userId) }))
      .filter((item) => item.user);
  }

  function matchesForRequest(requestId) {
    const request = requestOf(requestId);
    if (!request) return [];
    return approvedTutors()
      .map(({ profile, user }) => {
        const subjectHits = request.subjects.filter((subject) => profile.subjects.includes(subject)).length;
        const regionHit = profile.regions.includes(request.region) || profile.regions.includes("Online") || request.format === "online";
        const formatHit = profile.format === "both" || profile.format === request.format;
        const budgetHit = profile.hourlyRate <= request.budgetMax;
        const score = subjectHits * 4 + (regionHit ? 2 : 0) + (formatHit ? 2 : 0) + (budgetHit ? 1 : 0);
        return { profile, user, score, subjectHits, regionHit, formatHit, budgetHit };
      })
      .filter((item) => item.subjectHits > 0 && item.regionHit && item.formatHit)
      .sort((a, b) => b.score - a.score);
  }

  function setCaseStatus(caseId, nextStatus, meta = {}) {
    const item = caseOf(caseId);
    if (!item) return;
    if (!CASE_STATUSES.includes(nextStatus)) throw new Error(`Invalid case status: ${nextStatus}`);

    if (nextStatus === "cancelled") {
      item.cancelledReason = meta.reason || "Người dùng đã dừng cuộc trao đổi này.";
      item.cancelledBy = meta.by || state.currentUserId || "system";
    }

    item.status = nextStatus;

    if (nextStatus === "paid") {
      state.cases.forEach((sibling) => {
        if (sibling.requestId === item.requestId && sibling.id !== item.id && sibling.status !== "cancelled" && sibling.status !== "completed") {
          sibling.status = "cancelled";
          sibling.cancelledReason = "Phụ huynh đã thanh toán và chốt một gia sư khác cho nhu cầu học này.";
          sibling.cancelledBy = "system";
        }
      });
      const request = requestOf(item.requestId);
      if (request) request.status = "closed";
    }

    save();
  }

  window.tutormatchStateMachine = {
    connectionFee,
    getState: () => state,
    loadState,
    setCaseStatus
  };

  function ensureCase(requestId, tutorId) {
    let item = state.cases.find((existing) => existing.requestId === requestId && existing.tutorId === tutorId && existing.status !== "cancelled");
    if (!item) {
      item = {
        id: uid("c"),
        requestId,
        tutorId,
        status: "pending",
        cancelledReason: "",
        cancelledBy: "",
        createdAt: now()
      };
      state.cases.push(item);
      save();
    }
    return item;
  }

  function layout(content, active = "") {
    const user = currentUser();
    const brandHref = dashboardPath(user);
    if (user) {
      return `
        <div class="app-shell">
          <aside class="sidebar">
            <a class="brand app-brand" href="${brandHref}"><span class="brand-mark"></span><span>TutorMatch</span></a>
            <nav class="side-nav">${roleNav(user, active)}</nav>
          </aside>
          <div class="app-main">
            <header class="app-topbar">
              <div class="topbar-spacer"></div>
              <div class="topbar-user">
                ${avatarMarkup(user, "tiny")}
                <span>${escapeHtml(user.name)}</span>
                <button data-action="logout" class="ghost small">Đăng xuất</button>
              </div>
            </header>
            <main>${content}</main>
          </div>
        </div>
      `;
    }
    return `
      <header class="topbar">
        <a class="brand" href="${brandHref}"><span class="brand-mark">TM</span><span>TutorMatch</span></a>
        <nav class="nav">
          ${user ? roleNav(user, active) : publicNav(active)}
        </nav>
      </header>
      <main>${content}</main>
    `;
  }

  function publicNav(active) {
    return `
      <a class="${active === "home" ? "active" : ""}" href="#/">Trang chủ</a>
      <a href="#/auth/register/student">Tìm gia sư</a>
      <a href="#/auth/register/tutor">Trở thành gia sư</a>
      <a href="#/auth/login">Đăng nhập</a>
      <a class="button small" href="#/auth/register/student">Đăng ký</a>
    `;
  }

  function roleNav(user, active) {
    if (user.role === "admin") {
      return `<a class="${active === "admin" ? "active" : ""}" href="#/admin"><span></span>Duyệt gia sư</a>`;
    }
    const dashboard = user.role === "student" ? "#/student" : "#/tutor";
    return `
      <a class="${active === "dashboard" ? "active" : ""}" href="${dashboard}"><span></span>Trang của tôi</a>
      <a class="${active === "history" ? "active" : ""}" href="#/${user.role}/history"><span></span>Lịch sử</a>
      <a class="${active === "profile" ? "active" : ""}" href="#/${user.role}/profile"><span></span>Hồ sơ</a>
      ${user.role === "student" ? `<a href="#/student/request/new"><span></span>Tạo nhu cầu</a>` : `<a href="#/tutor/open-cases"><span></span>Nhu cầu mở</a>`}
    `;
  }

  function pageHome() {
    return `
      <main class="landing-reference premium-home" id="main-content">
        <header class="reference-nav">
          <a class="reference-logo" href="#/">TutorMatch</a>
          <nav aria-label="Primary navigation">
            <a href="#/">Cách hoạt động</a>
            <a href="#/auth/register/student">Tìm gia sư</a>
            <a href="#/">Môn học</a>
            <a href="#/auth/register/tutor">Dành cho gia sư</a>
          </nav>
          <div class="reference-actions">
            <a class="reference-signin" href="#/auth/login">Đăng nhập</a>
            <a class="reference-start" href="#/auth/register/student">Bắt đầu</a>
          </div>
        </header>

        <section class="reference-hero premium-hero">
          <div class="reference-copy">
            <span class="premium-kicker">Gia sư 1-1 đã xác minh</span>
            <h1>Tìm đúng gia sư cho con mà không phải hỏi lòng vòng.</h1>
            <p>So sánh hồ sơ đã duyệt, trao đổi trong app, chốt lịch bằng thư xác nhận và chỉ mở liên hệ sau khi thanh toán an toàn.</p>
            <div class="reference-ctas">
              <a class="find" href="#/auth/register/student">Tìm gia sư</a>
              <a class="become" href="#/auth/register/tutor">Trở thành gia sư</a>
            </div>
            <div class="premium-proof">
              <article><strong>Hồ sơ đã duyệt</strong><span>Gia sư cần nộp minh chứng trước khi xuất hiện.</span></article>
              <article><strong>Giữ kín liên hệ</strong><span>Số điện thoại chỉ mở sau khi lịch học được chốt.</span></article>
              <article><strong>Thỏa thuận rõ ràng</strong><span>Lịch, học phí, hình thức học được lưu lại một chỗ.</span></article>
            </div>
          </div>
          <figure class="reference-visual premium-visual" aria-label="Bảng điều khiển mẫu của TutorMatch">
            <div class="visual-topline"><span>Yêu cầu mới</span><b>Toán lớp 10</b></div>
            <div class="visual-tutor">
              <img src="assets/tutor-alex.png" alt="Gia sư Minh Khang" loading="eager" width="96" height="96" />
              <div>
                <strong>Minh Khang</strong>
                <span>Đã xác minh · Bình Thạnh</span>
                <small>280.000đ / buổi</small>
              </div>
            </div>
            <div class="visual-steps">
              <span>Trao đổi</span>
              <span>Thư xác nhận</span>
              <span>Thanh toán</span>
            </div>
            <figcaption>
              <b>Liên hệ đang được bảo vệ</b>
              <span>Chỉ mở sau khi phụ huynh thanh toán buổi đầu.</span>
            </figcaption>
          </figure>
        </section>

        <section class="premium-flow">
          <div>
            <span>01</span>
            <h2>Nói rõ nhu cầu học</h2>
            <p>Môn học, lớp, khu vực, ngân sách và lịch rảnh của con.</p>
          </div>
          <div>
            <span>02</span>
            <h2>Hỏi gia sư trước khi chốt</h2>
            <p>Trao đổi phương pháp dạy và lịch học mà chưa cần lộ số điện thoại.</p>
          </div>
          <div>
            <span>03</span>
            <h2>Chốt lịch rồi bắt đầu</h2>
            <p>Nhận thư xác nhận, thanh toán buổi đầu và mở liên hệ trực tiếp.</p>
          </div>
        </section>

        <section class="reference-testimonials premium-testimonials">
          <div class="testimonial-title"><span></span><h2>Phụ huynh và gia sư nói gì</h2><span></span></div>
          <div class="reference-quotes">
            <article>
              <img src="assets/profile-review-emily.png" alt="Phụ huynh lớp 10" loading="lazy" width="64" height="64" />
              <div><b>Phụ huynh lớp 10</b><p>"Tôi biết rõ học phí, lịch học và số buổi trước khi trả tiền. Không phải tự ghi lại từng tin nhắn."</p><strong>Chị Thảo</strong><small>Bình Thạnh</small></div>
            </article>
            <article>
              <img src="assets/tutor-alex.png" alt="Gia sư Toán" loading="lazy" width="64" height="64" />
              <div><b>Gia sư Toán</b><p>"Yêu cầu học ghi rõ môn, lớp, lịch rảnh và ngân sách nên tôi biết case nào thật sự phù hợp."</p><strong>Minh Khang</strong><small>Gia sư đã duyệt</small></div>
            </article>
            <article>
              <img src="assets/student05-priya.png" alt="Học sinh luyện thi" loading="lazy" width="64" height="64" />
              <div><b>Học sinh luyện thi</b><p>"Em có thể hỏi thử nhiều gia sư trước khi chọn người hợp cách học của mình."</p><strong>Lan Anh</strong><small>IELTS Foundation</small></div>
            </article>
          </div>
        </section>
      </main>
    `;
  }

  function tutorCard(user, profile, options = {}) {
    const contact = options.showContact
      ? `<div class="contact-box"><b>Bạn có thể liên hệ trực tiếp</b><span>${escapeHtml(user.phone)} · ${escapeHtml(user.email)}</span><span>${escapeHtml(user.address)}</span></div>`
      : `<div class="locked">Thông tin liên hệ được giữ kín cho tới khi lịch học được xác nhận và thanh toán.</div>`;
    const action = options.action || "";
    return `
      <article class="card tutor-card">
        ${avatarMarkup(user, "large")}
        <div class="card-main">
          <div class="row between">
            <h3>${escapeHtml(user.name)}</h3>
            <span class="badge verified">Đã xác minh</span>
          </div>
          <p>${escapeHtml(profile.bio)}</p>
          <div class="chips">
            ${profile.subjects.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
            ${profile.regions.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
          <div class="meta">${labels[profile.format]} · ${money(profile.hourlyRate)}/buổi · ${labels[profile.educationLevel] || "Đã khai học vấn"} · ★ ${profile.ratingAvg || "Mới"}</div>
          ${options.preview ? "" : contact}
          ${action}
        </div>
      </article>
    `;
  }

  function pageAuth(mode, role = "student") {
    const isLogin = mode === "login";
    return `
      <main class="auth-reference premium-auth ${isLogin ? "login-mode" : "signup-mode"}">
        <section class="auth-left">
          <a class="auth-logo" href="#/">TutorMatch</a>
          <h1>${isLogin ? "Đăng nhập để tiếp tục." : "Chọn vai trò phù hợp để bắt đầu."}</h1>
          <p>${isLogin ? "Mở lại bảng điều khiển, tin nhắn, thanh toán và lịch học trong một tài khoản bảo mật." : "Phụ huynh tạo nhu cầu học. Gia sư nộp hồ sơ xác minh để nhận học sinh phù hợp."}</p>
          <div class="auth-trust-list">
            <span>Gia sư được duyệt trước khi hiển thị</span>
            <span>Liên hệ được bảo vệ tới khi thanh toán</span>
            <span>Thư xác nhận lưu lại thỏa thuận học</span>
          </div>
        </section>
        <section class="auth-right">
          <form class="auth-form-reference" data-form="${isLogin ? "login" : "register"}">
            <h2>${isLogin ? "Chào mừng quay lại" : "Bạn muốn dùng TutorMatch với vai trò nào?"}</h2>
            ${isLogin ? "" : `
              <input type="hidden" name="role" value="${role}" />
              <input type="hidden" name="studentKind" value="parent" />
              <div class="role-choice-grid">
                <a class="role-choice ${role === "student" ? "active student" : "student"}" href="#/auth/register/student">
                  <span class="role-illustration">Học</span>
                  <strong>Tôi cần tìm gia sư</strong>
                  <small>Tạo nhu cầu học, chat và chốt lịch an toàn.</small>
                </a>
                <a class="role-choice ${role === "tutor" ? "active tutor" : "tutor"}" href="#/auth/register/tutor">
                  <span class="role-illustration">Dạy</span>
                  <strong>Tôi là gia sư</strong>
                  <small>Nộp hồ sơ xác minh và nhận case phù hợp.</small>
                </a>
              </div>
            `}
            <label class="auth-input"><span>Email</span><input name="email" type="email" required autocomplete="email" placeholder="student@example.com" value="${isLogin ? "student@example.com" : ""}" /></label>
            ${isLogin ? "" : `<label class="auth-input"><span>Số điện thoại</span><input name="phone" type="tel" autocomplete="tel" required placeholder="0901 111 222" /></label>`}
            <label class="auth-input"><span>Mật khẩu</span><input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" required placeholder="Pass123!" value="${isLogin ? "Pass123!" : ""}" /></label>
            ${isLogin ? "" : `<label class="terms-line"><input name="terms" type="checkbox" required /><span>Tôi đồng ý với <b>Điều khoản sử dụng</b> và <b>Chính sách bảo mật</b>.</span></label>`}
            <button class="auth-submit" type="submit">${isLogin ? "Đăng nhập" : "Đăng ký"}</button>
            <p class="auth-switch">${isLogin ? `Chưa có tài khoản? <a href="#/auth/register/student">Đăng ký</a>` : `Đã có tài khoản? <a href="#/auth/login">Đăng nhập</a>`}</p>
            ${isLogin ? `<p class="auth-demo">Tài khoản thử: student@example.com, tutor@example.com, admin@example.com · Pass123!</p>` : ""}
          </form>
        </section>
      </main>
    `;
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

  function pageStudentDashboard() {
    const user = requireUser("student");
    if (!user) return "";
    const data = studentDashboardFor(user.id);
    return studentDashboardLayout(user, data);
  }

  function studentDashboardFor(userId) {
    state.studentDashboardData ||= {};
    if (!state.studentDashboardData[userId]) {
      state.studentDashboardData[userId] = structuredClone(seed.studentDashboardData.u_student);
      save();
    }
    return state.studentDashboardData[userId];
  }

  function studentDashboardLayout(user, data) {
    const firstName = user.name.split(" ")[0] || user.name;
    return `
      <main class="studentdash-dashboard">
        <aside class="studentdash-sidebar">
          <div class="studentdash-brand">
            <img src="assets/student05-logo.png" alt="" />
            <div><strong>TutorMatch</strong><small>Tìm đúng người dạy.</small></div>
          </div>
          <nav>
            <a class="active" href="#/student"><span></span>Tổng quan</a>
            <a href="#/student/tutors"><span></span>Gia sư của tôi</a>
            <a href="#/student/messages"><span></span>Tin nhắn</a>
            <a href="#/student/payments"><span></span>Thanh toán</a>
            <a href="#/student/sessions"><span></span>Buổi học</a>
            <a href="#/student/reviews"><span></span>Đánh giá</a>
            <a href="#/student/settings"><span></span>Cài đặt</a>
            <a href="#/student/help"><span>?</span>Hỗ trợ</a>
          </nav>
        </aside>
        <section class="studentdash-main">
          <header class="studentdash-top">
            <div></div>
            <div class="studentdash-userbar">
              <span class="student-avatar"></span>
              <strong>${escapeHtml(firstName)}</strong>
              <span class="chevron"></span>
              <span class="student-bell"><b>3</b></span>
              <i></i>
              <button data-action="logout">Đăng xuất</button>
            </div>
          </header>
          <div class="studentdash-content">
            <section class="studentdash-welcome">
              <h1>Chào ${escapeHtml(firstName)}, hôm nay mình học gì?</h1>
              <p>Theo dõi yêu cầu tìm gia sư, buổi học sắp tới và các khoản thanh toán ở một nơi.</p>
            </section>
            <section class="studentdash-metrics">
              ${studentMetric("", "Gia sư đang học", data.stats.activeTutors, "mint", "#/student/tutors")}
              ${studentMetric("", "Buổi sắp tới", data.stats.upcomingLessons, "pink", "#/student/sessions")}
              ${studentMetric("", "Đã thanh toán", money(data.stats.totalSpent), "mint", "#/student/payments")}
              ${studentMetric("", "Buổi đã học", data.stats.completedSessions, "rose", "#/student/sessions")}
            </section>
            <section class="student-section-head">
              <h2>Yêu cầu tìm gia sư</h2>
              <a href="#/student/history">Xem tất cả</a>
            </section>
            <section class="student-requests-panel">
              ${data.requests.map(studentRequestRow).join("")}
            </section>
            <section class="student-section-head lessons-head">
              <h2>Buổi học sắp tới</h2>
              <a href="#/student/history">Xem lịch học</a>
            </section>
            <section class="student-lessons-grid">
              ${data.lessons.map(studentLessonCard).join("")}
            </section>
          </div>
        </section>
      </main>
    `;
  }

  function studentMetric(icon, label, value, tone, href) {
    return `<a class="student-metric ${tone}" href="${href}"><span>${icon}</span><div><p>${label}</p><strong>${value}</strong></div></a>`;
  }

  function studentRequestRow(item) {
    const statusText = { pending: "Đang chờ", matched: "Đã ghép", active: "Đang học" }[item.status] || item.status;
    const icon = "";
    return `
      <div class="student-request-row">
        <div class="student-request-person">
          <img src="${escapeHtml(item.avatarUrl)}" alt="${escapeHtml(item.tutorName)}" />
          <div><strong>${escapeHtml(item.tutorName)}</strong><span>${escapeHtml(item.subject)}${item.subjectDetail ? ` <b>•</b> ${escapeHtml(item.subjectDetail)}` : ""}</span></div>
        </div>
        <div class="student-request-date"><p>Ngày gửi<br><b>${escapeHtml(item.requestedOn)}</b></p></div>
        <span class="student-status ${escapeHtml(item.status)}">${statusText}</span>
        <button class="student-action-button ${item.action === "View Lessons" ? "primary" : ""}" data-action="student-request-action" data-request-id="${escapeHtml(item.id)}" data-tutor-id="${escapeHtml(item.tutorId || "u_tutor_sophia")}"><span>${icon}</span>${escapeHtml(item.action)}</button>
        <button class="student-row-menu" type="button" aria-label="More options">⋮</button>
      </div>
    `;
  }

  function studentLessonCard(item) {
    return `
      <a class="student-lesson-card" href="#/student/sessions">
        <time><span>${escapeHtml(item.month)}</span><b>${escapeHtml(item.day)}</b><small>${escapeHtml(item.weekday)}</small></time>
        <img src="${escapeHtml(item.avatarUrl)}" alt="${escapeHtml(item.tutorName)}" />
        <div><strong>${escapeHtml(item.tutorName)}</strong><span>${escapeHtml(item.subject)}</span>${item.topic ? `<span>${escapeHtml(item.topic)}</span>` : ""}<small>${escapeHtml(item.time)}</small></div>
      </a>
    `;
  }

  function studentPortalShell(active, title, subtitle, content, quote = "") {
    const user = requireUser("student");
    if (!user) return "";
    const firstName = user.name.split(" ")[0] || user.name;
    const items = [
      ["dashboard", "#/student", "", "Tổng quan"], ["tutors", "#/student/tutors", "", "Gia sư của tôi"], ["messages", "#/student/messages", "", "Tin nhắn"], ["payments", "#/student/payments", "", "Thanh toán"],
      ["sessions", "#/student/sessions", "", "Buổi học"], ["reviews", "#/student/reviews", "", "Đánh giá"], ["settings", "#/student/settings", "", "Cài đặt"], ["help", "#/student/help", "", "Hỗ trợ"]
    ];
    return `
      <main class="student-portal">
        <aside class="student-portal-side">
          <div class="portal-logo"><img src="assets/student05-logo.png" alt="" /><div><strong>TutorMatch</strong><small>Tìm đúng người dạy.</small></div></div>
          <nav>${items.map(([key, href, icon, label]) => `<a class="${active === key ? "active" : ""}" href="${href}"><span>${icon}</span>${label}</a>`).join("")}</nav>
          <div class="portal-promo">${active === "help" ? "<b>Trở thành gia sư</b><p>Nộp hồ sơ xác minh để nhận học sinh phù hợp.</p><a href='#/auth/register/tutor'>Bắt đầu</a>" : "<b>Cần hỗ trợ?</b><p>Đội ngũ TutorMatch có thể giúp bạn kiểm tra lịch, thanh toán và hồ sơ gia sư.</p><a href='#/student/help'>Liên hệ hỗ trợ</a>"}</div>
        </aside>
        <section class="student-portal-main">
          <header class="portal-top"><div></div><div><span class="student-avatar"></span><strong>${escapeHtml(firstName)}</strong><span></span><span class="student-bell"><b>3</b></span><i></i><button data-action="logout">Đăng xuất</button></div></header>
          <div class="portal-content"><div class="portal-title"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>${content}${quote ? `<p class="portal-quote">${escapeHtml(quote)}</p>` : ""}</div>
        </section>
      </main>
    `;
  }

  function demoTutors() {
    return [
      ["Lê Lan Anh", "Tiếng Anh, IELTS, Ngữ văn", "4.9", "320.000đ / buổi", "Quận 1, TP.HCM", "Đang nhận lịch", "assets/student05-priya.png"],
      ["Minh Khang", "Toán, Vật lý, IELTS", "4.8", "280.000đ / buổi", "Bình Thạnh, TP.HCM", "Đang dạy", "assets/tutor-alex.png"],
      ["Nguyễn Phương Linh", "Toán, Giải tích", "5.0", "350.000đ / buổi", "Quận 3, TP.HCM", "Đang nhận lịch", "assets/profile-sophia.png"],
      ["Phạm Minh Khoa", "Tin học, Toán", "4.7", "260.000đ / buổi", "Thủ Đức, TP.HCM", "Bận tuần này", "assets/student05-daniel.png"],
      ["Hoàng Mai", "Hóa học, Sinh học", "4.9", "300.000đ / buổi", "Quận 7, TP.HCM", "Tạm nghỉ", "assets/tutor-isabella.png"],
      ["Trần Gia Huy", "Vật lý, Toán", "4.8", "290.000đ / buổi", "Online", "Chưa mở lịch", "assets/tutor-ethan.png"],
      ["Ngọc Anh", "Toán, Thống kê", "4.9", "330.000đ / buổi", "Quận 1, TP.HCM", "Đang nhận lịch", "assets/student-emily.png"],
      ["Quốc Bảo", "Tiếng Anh, Viết luận", "4.7", "270.000đ / buổi", "Quận 3, TP.HCM", "Đang nhận lịch", "assets/profile-review-jacob.png"],
      ["Khánh Linh", "Hóa học, Sinh học", "4.8", "310.000đ / buổi", "Bình Thạnh, TP.HCM", "Bận tuần này", "assets/profile-review-ava.png"],
      ["Đức Minh", "Tin học, JavaScript", "4.9", "360.000đ / buổi", "Online", "Đang dạy", "assets/student05-daniel.png"],
      ["Bảo Ngọc", "Tiếng Pháp, Tiếng Anh", "4.6", "280.000đ / buổi", "Quận 7, TP.HCM", "Tạm nghỉ", "assets/profile-review-emily.png"],
      ["Minh Nhật", "Vật lý, luyện thi", "4.8", "300.000đ / buổi", "Thủ Đức, TP.HCM", "Đang nhận lịch", "assets/profile-review-michael.png"]
    ];
  }

  function pageStudentTutors() {
    const subjects = ["Tất cả môn", "Toán", "Vật lý", "Tiếng Anh", "Tin học", "Sinh học", "Hóa học", "Ngôn ngữ"];
    const statuses = ["Tất cả trạng thái", "Đang nhận lịch", "Đang dạy", "Bận tuần này", "Tạm nghỉ", "Chưa mở lịch"];
    const locations = ["Tất cả khu vực", ...new Set(demoTutors().map((item) => item[4]))];
    const cards = demoTutors().map(([name, subjectsText, rating, rate, location, status, avatar]) => {
      const subjectBucket = subjectsText.includes("Pháp") || subjectsText.includes("Anh")
        ? "Ngôn ngữ"
        : subjects.find((subject) => subject !== "Tất cả môn" && subjectsText.includes(subject)) || "Khác";
      return `<article class="portal-tutor-card" data-search="${escapeHtml(`${name} ${subjectsText} ${location} ${status}`)}" data-subject="${escapeHtml(subjectBucket)}" data-status="${escapeHtml(status)}" data-location="${escapeHtml(location)}"><img src="${avatar}" alt="${escapeHtml(name)}" /><div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(subjectsText)}</p><b>5.0 <small>(${rating})</small></b><p>${rate} · ${escapeHtml(location)}</p></div><span class="portal-status">${escapeHtml(status)}</span><footer><a href="#/student/messages">Nhắn tin</a><a href="#/student/sessions">Đặt lịch</a><a href="#/student/tutor/u_tutor_sophia?request=r_seed">Xem hồ sơ</a></footer></article>`;
    }).join("");
    return studentPortalShell("tutors", "Gia sư của tôi", "Tìm, lọc và quản lý các gia sư đã trao đổi hoặc đang học.", `<section class="portal-filter" data-tutor-filters><input placeholder="Tìm theo tên gia sư hoặc môn học..." /><select aria-label="Lọc theo môn">${subjects.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select><select aria-label="Lọc theo trạng thái">${statuses.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select><select aria-label="Lọc theo khu vực">${locations.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select><a>Xóa lọc</a></section><section class="portal-tutor-grid">${cards}</section><div class="portal-pagination" data-page="1"><button data-page-action="prev">Trước</button><span class="active-page">1</span><span>2</span><button data-page-action="next">Sau</button><p>Đang hiển thị 1-6 trong 12 gia sư</p></div>`);
  }

  function defaultStudentPortalData() {
    return {
      activeConversationId: "conv_james",
      conversations: [
        { id: "conv_james", name: "Minh Khang", avatar: "assets/tutor-alex.png", online: true, unread: 1, preview: "Mình chốt Chủ nhật 16:00 nhé.", messages: [{ from: "tutor", text: "Chào Anh Thư, mình xem yêu cầu học Toán lớp 10 rồi." }, { from: "student", text: "Dạ em cần ôn lại hàm số và hình học." }, { from: "tutor", text: "Được nhé. Chủ nhật 16:00 mình học thử 1 buổi, sau đó chốt lịch cố định." }, { from: "student", text: "Dạ được ạ." }] },
        { id: "conv_emily", name: "Lê Lan Anh", avatar: "assets/student05-priya.png", online: true, unread: 2, preview: "Mình gửi lộ trình IELTS foundation.", messages: [{ from: "tutor", text: "Mình đã xem mục tiêu IELTS của em." }, { from: "student", text: "Em muốn bắt đầu từ nền tảng nghe và đọc." }] },
        { id: "conv_michael", name: "Phạm Minh Khoa", avatar: "assets/profile-sophia.png", online: true, unread: 0, preview: "Buổi Tin học đã xác nhận.", messages: [{ from: "tutor", text: "Buổi tới mình học biến và vòng lặp trước." }, { from: "student", text: "Dạ em đã chuẩn bị laptop." }] },
        { id: "conv_sophia", name: "Nguyễn Phương Linh", avatar: "assets/profile-sophia.png", online: false, unread: 0, preview: "Mình có thể chuẩn bị bài Giải tích.", messages: [{ from: "tutor", text: "Mình có thể chuẩn bị bài Giải tích trước buổi học." }] },
        { id: "conv_david", name: "Quốc Bảo", avatar: "assets/profile-review-jacob.png", online: false, unread: 0, preview: "Dàn ý bài viết đã sẵn sàng.", messages: [{ from: "tutor", text: "Em xem trước dàn ý bài viết trước buổi học nhé." }] },
        { id: "conv_olivia", name: "Bảo Ngọc", avatar: "assets/profile-review-ava.png", online: true, unread: 0, preview: "Danh sách từ vựng đã sẵn sàng.", messages: [{ from: "tutor", text: "Mình chuẩn bị danh sách từ vựng cho thứ Sáu rồi." }] }
      ],
      paymentMethod: "Visa kết thúc 4242",
      payments: [
        { id: "pay_1", date: "20/06/2026", tutor: "Minh Khang", subject: "Toán", duration: "60 phút", amount: 280000, status: "Đã thanh toán" },
        { id: "pay_2", date: "13/06/2026", tutor: "Lê Lan Anh", subject: "Tiếng Anh", duration: "90 phút", amount: 320000, status: "Đã thanh toán" },
        { id: "pay_3", date: "06/06/2026", tutor: "Phạm Minh Khoa", subject: "Tin học", duration: "60 phút", amount: 260000, status: "Chờ thanh toán" },
        { id: "pay_4", date: "29/05/2026", tutor: "Hoàng Mai", subject: "Hóa học", duration: "60 phút", amount: 300000, status: "Lỗi thanh toán" },
        { id: "pay_5", date: "22/05/2026", tutor: "Nguyễn Phương Linh", subject: "Giải tích", duration: "120 phút", amount: 350000, status: "Đã thanh toán" },
        { id: "pay_6", date: "15/05/2026", tutor: "Bảo Ngọc", subject: "Tiếng Anh", duration: "60 phút", amount: 280000, status: "Đã thanh toán" }
      ],
      sessions: [
        { id: "sess_1", type: "upcoming", tutor: "Minh Khang", subject: "Toán", topic: "Hàm số · Lớp 10", date: "24/06/2026", time: "16:00 - 17:00", location: "Online (Google Meet)", status: "Đã xác nhận", avatar: "assets/student05-priya.png" },
        { id: "sess_2", type: "upcoming", tutor: "Lê Lan Anh", subject: "Tiếng Anh", topic: "IELTS foundation", date: "26/06/2026", time: "18:00 - 19:00", location: "Online (Zoom)", status: "Đã lên lịch", avatar: "assets/student05-alex.png" },
        { id: "sess_3", type: "upcoming", tutor: "Phạm Minh Khoa", subject: "Tin học", topic: "Cấu trúc dữ liệu", date: "28/06/2026", time: "17:00 - 18:00", location: "Online (Google Meet)", status: "Đã xác nhận", avatar: "assets/profile-sophia.png" },
        { id: "sess_4", type: "past", tutor: "Hoàng Mai", subject: "Hóa học", topic: "Hóa hữu cơ · Lớp 11", date: "20/06/2026", time: "60 phút", location: "Online", status: "5.0", avatar: "assets/student05-daniel.png" },
        { id: "sess_5", type: "past", tutor: "Khánh Linh", subject: "Sinh học", topic: "Tế bào học · Lớp 10", date: "18/06/2026", time: "60 phút", location: "Online", status: "4.5", avatar: "assets/student05-priya.png" },
        { id: "sess_6", type: "past", tutor: "Trần Gia Huy", subject: "Toán", topic: "Lượng giác · Lớp 11", date: "15/06/2026", time: "60 phút", location: "Online", status: "5.0", avatar: "assets/tutor-ethan.png" }
      ]
    };
  }

  function studentPortalDataFor(userId) {
    state.studentPortalData ||= {};
    if (!state.studentPortalData[userId]) {
      state.studentPortalData[userId] = defaultStudentPortalData();
      save();
    }
    return state.studentPortalData[userId];
  }

  function pageStudentMessages() {
    const user = requireUser("student");
    if (!user) return "";
    const data = studentPortalDataFor(user.id);
    const active = data.conversations.find((item) => item.id === data.activeConversationId) || data.conversations[0];
    return studentPortalShell("messages", "Tin nhắn", "Trao đổi với gia sư trong app trước khi mở thông tin liên hệ.", `<section class="portal-chat"><aside><h2>Tin nhắn</h2><input placeholder="Tìm cuộc trò chuyện..." /><small class="conversation-count">${data.conversations.length} cuộc trò chuyện</small>${data.conversations.map((item) => `<div class="${item.id === active.id ? "active" : ""}" data-conversation-id="${escapeHtml(item.id)}"><img src="${escapeHtml(item.avatar)}" alt="" /><p><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.preview)}</span></p>${item.unread ? `<em>${item.unread}</em>` : ""}</div>`).join("")}<p class="conversation-empty" hidden>Không tìm thấy cuộc trò chuyện.</p></aside><article><header><img src="${escapeHtml(active.avatar)}" alt="" /><h2>${escapeHtml(active.name)}<small>${active.online ? "Đang online" : "Không online"}</small></h2></header><div class="chat-bubbles">${active.messages.map((message) => `<p class="${message.from === "student" ? "mine" : ""}">${escapeHtml(message.text)}</p>`).join("")}</div><footer><input placeholder="Nhập tin nhắn..." /><button>Gửi</button></footer></article></section>`);
  }

  function pageStudentPaymentsPortal() {
    const user = requireUser("student");
    if (!user) return "";
    const data = studentPortalDataFor(user.id);
    const rows = data.payments;
    const totalPaid = rows.filter((row) => ["Completed", "Đã thanh toán"].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const upcomingDue = rows.filter((row) => ["Pending", "Chờ thanh toán"].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const tutors = ["Tất cả gia sư", ...new Set(rows.map((row) => row.tutor))];
    const table = `<table class="portal-table payment-table"><thead><tr>${["Ngày", "Gia sư", "Môn học", "Thời lượng", "Số tiền", "Trạng thái", "Thao tác"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => {
      const action = ["Failed", "Lỗi thanh toán"].includes(row.status) ? "Thử lại" : ["Pending", "Chờ thanh toán"].includes(row.status) ? "Thanh toán" : "Biên nhận";
      const cells = [row.date, row.tutor, row.subject, row.duration, money(row.amount), row.status];
      return `<tr data-payment-id="${escapeHtml(row.id)}" data-tutor="${escapeHtml(row.tutor)}" data-status="${escapeHtml(row.status)}" data-search="${escapeHtml(cells.join(" "))}">${cells.map((cell, idx) => `<td class="${idx === 5 ? "status" : ""}">${escapeHtml(cell)}</td>`).join("")}<td><button class="table-action" data-payment-action="${escapeHtml(action)}">${action}</button></td></tr>`;
    }).join("")}</tbody></table>`;
    return studentPortalShell("payments", "Thanh toán", "Theo dõi khoản đã trả, khoản sắp đến hạn và phương thức thanh toán.", `<section class="portal-summary payment-summary"><article>Đã thanh toán<b>${money(totalPaid)}</b><span>Các khoản đã hoàn tất</span></article><article>Sắp đến hạn<b>${money(upcomingDue)}</b><span>Các buổi đang chờ thanh toán</span></article><article>Phương thức<b>${escapeHtml(data.paymentMethod)}</b><span>Đang dùng mặc định</span></article></section><section class="portal-filter" data-payment-filters><select aria-label="Khoảng ngày"><option>01/05/2026 - 30/06/2026</option><option>Tháng 6/2026</option><option>Tháng 5/2026</option></select><select aria-label="Trạng thái thanh toán"><option>Tất cả trạng thái</option><option>Đã thanh toán</option><option>Chờ thanh toán</option><option>Lỗi thanh toán</option></select><select aria-label="Gia sư">${tutors.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select><a>Tải hóa đơn</a><a>Thêm phương thức</a></section>${table}<div class="portal-pagination"><span>Đang hiển thị 1-${rows.length} trong ${rows.length} thanh toán</span><b>1</b></div><section class="portal-result-panel" hidden></section>`);
  }

  function portalTable(headers, rows) {
    return `<table class="portal-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, idx) => `<td class="${idx === row.length - 2 ? "status" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function pageStudentSessions() {
    const user = requireUser("student");
    if (!user) return "";
    const data = studentPortalDataFor(user.id);
    const upcoming = data.sessions.filter((item) => item.type === "upcoming");
    const past = data.sessions.filter((item) => item.type === "past");
    const row = (item) => `<article class="session-row ${item.status === "Cancelled" ? "cancelled" : ""}" data-session-id="${escapeHtml(item.id)}" data-tutor="${escapeHtml(item.tutor)}" data-subject="${escapeHtml(item.subject)}" data-date="${escapeHtml(item.date)}"><img src="${escapeHtml(item.avatar)}" alt="" /><div><h3>${escapeHtml(item.tutor)}</h3><b>${escapeHtml(item.subject)}</b><p>${escapeHtml(item.topic)}</p></div><p>${escapeHtml(item.date)}<br>${escapeHtml(item.time)}<br>${escapeHtml(item.location)}</p><span>${escapeHtml(item.status)}</span><footer>${item.type === "past" ? `<button data-session-action="details">View Details</button>` : `<button data-session-action="reschedule">Reschedule</button><button data-session-action="cancel">Cancel</button><button data-session-action="details">View Details</button>`}</footer></article>`;
    return studentPortalShell("sessions", "Buổi học", "Quản lý buổi sắp tới, buổi đã học và yêu cầu đổi lịch.", `<section class="portal-section-head"><h2>Buổi sắp tới</h2><a>Xem lịch</a></section><section class="session-calendar" hidden>${upcoming.map((item) => `<div><b>${escapeHtml(item.date)}</b><span>${escapeHtml(item.tutor)} · ${escapeHtml(item.subject)} · ${escapeHtml(item.status)}</span></div>`).join("")}</section>${upcoming.map(row).join("")}<section class="portal-section-head"><h2>Buổi đã học</h2></section>${past.map(row).join("")}<section class="portal-result-panel session-detail-panel" hidden></section>`, "Học đều từng tuần quan trọng hơn học dồn trước kỳ thi.");
  }

  function pageStudentReviewsPortal() {
    const given = [["Sophia Martinez", "Mathematics", "Sophia explained concepts so clearly and was very patient with me.", "May 18, 2025"], ["James Lee", "Physics", "Great tutor! He uses real-world examples that make difficult topics easier.", "May 12, 2025"], ["Aisha Khan", "English Literature", "Very knowledgeable and supportive. My writing improved so much!", "May 5, 2025"]];
    const received = [["Dr. Michael Brown", "Chemistry Tutor", "A dedicated and curious student who always comes prepared.", "May 20, 2025"], ["Laura Wilson", "Biology Tutor", "Asks thoughtful questions and is consistently improving.", "May 14, 2025"], ["Daniel Cooper", "Computer Science Tutor", "Excellent communication and a strong willingness to learn.", "May 6, 2025"]];
    const filters = `<div class="review-filters"><button>All</button><button>5 Stars</button><button>4 Stars</button><button>3 Stars</button><button>2 Stars</button><button>1 Star</button><button>Sort by: Most Recent</button></div>`;
    const card = (r) => `<article class="review-card"><h3>${escapeHtml(r[0])}<span>★★★★★</span></h3><b>${escapeHtml(r[1])}</b><p>${escapeHtml(r[2])}</p><small>${escapeHtml(r[3])}</small></article>`;
    return studentPortalShell("reviews", "Reviews", "Share feedback and see what tutors are saying about you.", `<section class="portal-panel"><h2>Reviews I've Given</h2>${filters}<div class="review-grid">${given.map(card).join("")}</div><h2>Reviews I've Received</h2>${filters}<div class="review-grid">${received.map(card).join("")}</div></section>`, "Your feedback helps build a better learning community");
  }

  function pageStudentSettingsPortal() {
    return studentPortalShell("settings", "Settings", "Manage your account, preferences, and security settings.", `<section class="settings-grid"><article><h2>Account Settings <button>Edit</button></h2><div class="settings-profile"><img src="assets/student05-priya.png" /><p>Name <b>Sarah Johnson</b></p><p>Email <b>sarah@example.com</b></p><p>Phone <b>+1 (555) 123-4567</b></p></div></article><article><h2>Learning Preferences</h2><p>Subjects <b>Mathematics, Science, English</b></p><p>Grade Level <b>Grade 10</b></p><p>Learning Style <b>Visual Learner</b></p><p>Timezone <b>GMT-05:00 Eastern Time</b></p></article><article><h2>Notification Settings</h2><p>Email Notifications <span class="toggle"></span></p><p>SMS Notifications <span class="toggle"></span></p><p>Push Notifications <span class="toggle"></span></p></article><article><h2>Privacy & Security</h2><p>Change Password</p><p>Two-Factor Auth <b>Enabled</b></p><p>Privacy Settings</p></article><article class="wide"><h2>Payment Methods</h2><div class="card-row"><span>Mastercard ending in 5678</span><span>Visa ending in 1234</span><button>Add New Card</button></div></article></section>`, "Keep learning, keep growing!");
  }

  function pageStudentHelp() {
    const faqs = ["How to find a tutor", "How to schedule a lesson", "How payments work", "What payment methods are accepted?", "How to cancel or reschedule a lesson", "How ratings and reviews work", "How to update my profile"];
    const articles = ["Getting Started", "Payments", "Scheduling", "Ratings & Reviews", "Cancellation Policy", "Safety & Privacy"];
    const tickets = [["#TKT-3487", "Issue with payment processing", "May 20, 2024", "Resolved", "May 22, 2024", "View Details"], ["#TKT-3321", "Tutor not showing up for lesson", "May 10, 2024", "In Progress", "May 14, 2024", "View Details"], ["#TKT-2986", "Question about refund policy", "Apr 28, 2024", "Closed", "Apr 29, 2024", "View Details"]];
    return studentPortalShell("help", "Help & Support", "We're here to help you. Find answers or get in touch with our support team.", `<section class="help-grid"><article><h2>FAQ</h2>${faqs.map((q) => `<details><summary>${q}</summary><p>You can manage this from your student dashboard.</p></details>`).join("")}</article><article><h2>Contact Support</h2><input placeholder="Your Name" /><input placeholder="Your Email" /><input placeholder="Subject" /><textarea placeholder="How can we help you?"></textarea><button>Send Message</button><button>Start Live Chat</button><p>+1 (800) 123-4567<br>Mon-Fri: 8:00 AM - 8:00 PM</p></article><article><h2>Knowledge Base</h2><div class="kb-grid">${articles.map((a) => `<div>${a}<small>Helpful guide</small></div>`).join("")}</div></article></section>${portalTable(["Ticket ID", "Subject", "Date", "Status", "Last Updated", "Action"], tickets)}`);
  }

  function requestCard(request) {
    const cases = state.cases.filter((item) => item.requestId === request.id);
    return `
      <article class="card">
        <div class="row between">
          <h3>${escapeHtml(request.subjects.join(", "))} · ${escapeHtml(request.grade)}</h3>
          <span class="badge">${labels[request.status]}</span>
        </div>
        <p>${escapeHtml(request.region)} · ${labels[request.format]} · ${request.schedule.map(escapeHtml).join(", ")}</p>
        <p>Ngân sách ${money(request.budgetMin)} - ${money(request.budgetMax)} · ${request.studentsCount} học sinh</p>
        <div class="actions">
          <a class="button small" href="#/student/request/${request.id}/matches">Xem gia sư phù hợp</a>
          <a class="button secondary small" href="#/student/request/${request.id}/cases">Các cuộc trao đổi (${cases.length})</a>
        </div>
      </article>
    `;
  }

  function pageRequestForm() {
    const user = requireUser("student");
    if (!user) return "";
    const copy = learnerCopy(user);
    return layout(`
      <section class="workspace narrow">
        <form class="panel form" data-form="request">
          <p class="eyebrow">Càng rõ nhu cầu, gợi ý càng đúng</p>
          <h1>${copy.formTitle}</h1>
          ${multiSelect("subjects", "Môn học", SUBJECTS, ["Toán"])}
          <label>Cấp độ/lớp<input name="grade" required placeholder="Ví dụ: Lớp 10, IELTS 5.5" /></label>
          ${select("region", "Khu vực", REGIONS)}
          ${radioGroup("format", "Hình thức", ["online", "home"], "home")}
          ${multiSelect("schedule", "Lịch trống", SLOTS, ["T3 tối"])}
          <div class="two-col">
            <label>Học phí tối thiểu<input name="budgetMin" type="number" required value="200000" /></label>
            <label>Học phí tối đa<input name="budgetMax" type="number" required value="350000" /></label>
          </div>
          <label>Số học sinh<input name="studentsCount" type="number" min="1" required value="1" /></label>
          <label>Ghi chú cho gia sư<textarea name="note" placeholder="${copy.notePlaceholder}"></textarea></label>
          <button class="button" type="submit">Tìm gia sư phù hợp</button>
        </form>
      </section>
    `, "dashboard");
  }

  function pageMatches(requestId) {
    const user = requireUser("student");
    if (!user) return "";
    const request = requestOf(requestId);
    const matches = matchesForRequest(requestId);
    return layout(`
      <section class="workspace search-page">
        <div class="search-bar"><span></span><input readonly value="${request ? escapeHtml(`${request.subjects.join(", ")} · ${request.region} · ${money(request.budgetMin)}-${money(request.budgetMax)}`) : "Tìm theo môn, khu vực, học phí"}" /></div>
        <div class="search-layout">
          <aside class="filter-panel">
            <h3>📖 Môn học</h3>
            ${SUBJECTS.slice(0, 6).map((subject) => `<label><input type="checkbox" ${request?.subjects.includes(subject) ? "checked" : ""} />${escapeHtml(subject)}</label>`).join("")}
            <hr />
            <h3>🎓 Cấp độ</h3>
            <label><input type="checkbox" checked />${escapeHtml(request?.grade || "Lớp 10")}</label>
            <label><input type="checkbox" />Luyện thi</label>
            <label><input type="checkbox" />Đại học</label>
            <hr />
            <h3>🏷 Học phí</h3>
            <div class="range-copy"><span>${money(request?.budgetMin || 100000)}</span><span>${money(request?.budgetMax || 500000)}</span></div>
            <div class="fake-range"><i></i></div>
            <hr />
            <h3>📍 Khu vực</h3>
            <div class="select-like">${escapeHtml(request?.region || "Tất cả khu vực")}</div>
          </aside>
          <div class="search-results">
            ${matches.map(({ user: tutor, profile, score }) => tutorSearchCard(tutor, profile, requestId, score)).join("") || empty("Chưa thấy gia sư thật sự phù hợp.", "Bạn có thể thử mở rộng khu vực, học online hoặc tăng ngân sách. Nhu cầu vẫn mở để gia sư phù hợp chủ động nhận sau.")}
          </div>
        </div>
      </section>
    `, "dashboard");
  }

  function tutorSearchCard(user, profile, requestId, score) {
    return `
      <article class="search-tutor-card">
        ${avatarMarkup(user, "large")}
        <h3>${escapeHtml(user.name)}</h3>
        <div class="chips">${profile.subjects.slice(0, 2).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        <div class="stars">★★★★★ <small>(${Math.round((profile.ratingAvg || 4.7) * 24)})</small></div>
        <div class="price-pill">${money(profile.hourlyRate)}/buổi</div>
        <a class="button secondary small" href="#/student/tutor/${user.id}?request=${requestId}">Xem hồ sơ</a>
        <p class="tiny">${matchLabel(score)}</p>
      </article>
    `;
  }

  function pageTutorDetail(tutorId, requestId) {
    const user = requireUser("student");
    if (!user) return "";
    const tutor = state.users.find((item) => item.id === tutorId);
    const profile = profileOf(tutorId);
    if (!tutor || !profile || profile.verificationStatus !== "approved") return notFound("Gia sư này chưa khả dụng hoặc chưa được xác minh.");
    const existing = state.cases.find((item) => item.requestId === requestId && item.tutorId === tutorId && item.status !== "cancelled");
    const profileData = tutorId === "u_tutor_sophia" ? sophiaProfileData() : genericProfileData(tutor, profile);
    return `
      <main class="profile-reference">
        <div class="profile-corner top-left"></div>
        <div class="profile-corner top-right"></div>
        <div class="profile-corner bottom-left"></div>
        <div class="profile-corner bottom-right"></div>
        <section class="profile-reference-main">
          <header class="profile-reference-hero">
            <img class="profile-reference-photo" src="${escapeHtml(profileData.photo)}" alt="${escapeHtml(profileData.name)}" />
            <div class="profile-reference-intro">
              <h1>${escapeHtml(profileData.name)}</h1>
              <div class="profile-reference-chips">
                ${profileData.subjects.map((item) => `<span>${item.icon} ${escapeHtml(item.label)}</span>`).join("")}
              </div>
              <p class="profile-location">● ${escapeHtml(profileData.location)}</p>
              <p class="profile-tagline">${escapeHtml(profileData.tagline)}</p>
            </div>
          </header>
          <section class="profile-info-grid">
            <article>
              <h2>About Me</h2>
              <p>${escapeHtml(profileData.about)}</p>
            </article>
            <article>
              <h2>Experience & Qualifications</h2>
              <ul>${profileData.qualifications.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </article>
            <article>
              <h2>Schedule & Availability</h2>
              <div class="profile-schedule">${profileData.schedule.map((item) => `<div><span>${escapeHtml(item.day)}</span><b>${escapeHtml(item.time)}</b></div>`).join("")}</div>
            </article>
          </section>
          <section class="profile-reviews">
            <div class="profile-reviews-head"><h2>Reviews</h2><strong>${profileData.rating}</strong><span>5-star average</span><small>(${profileData.reviewCount} reviews)</small></div>
            <div class="profile-review-grid">${profileData.reviews.map(profileReviewCard).join("")}</div>
          </section>
        </section>
        <aside class="profile-rate-sidebar">
          <h2>HOURLY RATE</h2>
          <div class="rate-rule"><span></span><b></b><span></span></div>
          <strong>$${escapeHtml(String(profileData.rate))}</strong>
          <p>per hour</p>
          <button class="profile-primary" data-action="start-chat" data-request-id="${requestId || "r_seed"}" data-tutor-id="${tutorId}">Request Tutor</button>
          <button class="profile-secondary" data-action="start-chat" data-request-id="${requestId || "r_seed"}" data-tutor-id="${tutorId}">Message</button>
          <div class="profile-trust-list">
            ${profileData.trust.map((item) => `<div><span>${item.icon}</span><p>${escapeHtml(item.label)}</p></div>`).join("")}
          </div>
        </aside>
      </main>
    `;
  }

  function sophiaProfileData() {
    return {
      name: "Sophia Martinez",
      photo: "assets/profile-sophia.png",
      subjects: [{ icon: "", label: "Mathematics" }, { icon: "", label: "Calculus" }],
      location: "Seattle, Washington",
      tagline: "Helping students build confidence and achieve their goals.",
      rate: 75,
      rating: "5.0",
      reviewCount: 4,
      about: "I’m passionate about making mathematics accessible and enjoyable for students of all levels. I believe every student can succeed with the right support, clear explanations, and a personalized approach to learning. My goal is to create a supportive environment where students feel empowered to ask questions and grow.",
      qualifications: [
        "M.S. in Applied Mathematics, University of Washington",
        "B.S. in Mathematics, University of California, Davis",
        "6+ years tutoring experience with middle school, high school, and college students",
        "Expertise in Algebra, Geometry, Pre-Calculus, Calculus I-III, Differential Equations, and Linear Algebra"
      ],
      schedule: [
        { day: "Monday", time: "4:00 - 6:00 PM" },
        { day: "Tuesday", time: "10:00 AM - 12:00 PM" },
        { day: "Wednesday", time: "4:00 - 6:00 PM" },
        { day: "Thursday", time: "10:00 AM - 12:00 PM" },
        { day: "Friday", time: "2:00 - 4:00 PM" },
        { day: "Saturday", time: "9:00 - 11:00 AM" },
        { day: "Sunday", time: "Unavailable" }
      ],
      reviews: [
        { name: "Emily R.", avatar: "assets/profile-review-emily.png", text: "Sophia is an amazing tutor! She explains concepts clearly and is so patient. My grades have improved so much!", date: "May 12, 2024" },
        { name: "Jacob T.", avatar: "assets/profile-review-jacob.png", text: "She helped me finally understand calculus. Her step-by-step approach makes all the difference.", date: "April 28, 2024" },
        { name: "Ava L.", avatar: "assets/profile-review-ava.png", text: "Sophia is knowledgeable, kind, and always prepared. I feel so much more confident in math now!", date: "April 14, 2024" },
        { name: "Michael B.", avatar: "assets/profile-review-michael.png", text: "Great tutor! She tailors each session to my needs and really cares about my progress.", date: "March 30, 2024" }
      ],
      trust: [
        { icon: "", label: "Verified Tutor" },
        { icon: "", label: "Background Checked" },
        { icon: "", label: "6+ Years Experience" },
        { icon: "", label: "Flexible Scheduling" }
      ]
    };
  }

  function genericProfileData(tutor, profile) {
    return { ...sophiaProfileData(), name: tutor.name, photo: tutor.avatarUrl || "assets/profile-sophia.png", rate: profile.hourlyRate, rating: profile.ratingAvg || "5.0" };
  }

  function profileReviewCard(item) {
    return `
      <article class="profile-review-card">
        <div><img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name)}" /><span><strong>${escapeHtml(item.name)}</strong><b>★★★★★</b></span></div>
        <p>“${escapeHtml(item.text)}”</p>
        <small>▣ ${escapeHtml(item.date)}</small>
      </article>
    `;
  }

  function pageRequestCases(requestId) {
    const user = requireUser("student");
    if (!user) return "";
    const cases = state.cases.filter((item) => item.requestId === requestId);
    return layout(`
      <section class="workspace">
        <div class="section-head"><p class="eyebrow">Các cuộc trao đổi</p><h1>Bạn đang nói chuyện với gia sư nào?</h1></div>
        <div class="cards">${cases.map(caseCard).join("") || empty("Bạn chưa hỏi gia sư nào cho nhu cầu này.", "Mở danh sách gia sư phù hợp và chọn người bạn muốn hỏi trước.")}</div>
      </section>
    `, "dashboard");
  }

  function caseCard(item) {
    const request = requestOf(item.requestId);
    const letter = state.confirmationLetters.find((entry) => entry.caseId === item.id);
    const role = currentUser()?.role;
    return `
      <article class="card">
        <div class="row between">
          <h3>${escapeHtml(caseTitle(item))}</h3>
          <span class="badge ${item.status === "cancelled" ? "danger" : ""}">${labels[item.status]}</span>
        </div>
        <p>${request ? `${escapeHtml(request.grade)} · ${escapeHtml(request.region)} · ${labels[request.format]}` : ""}</p>
          ${letter ? `<p>Thư xác nhận: ${letter.lessonsCount} buổi · ${escapeHtml(letter.schedule)} · ${money(letter.fee)}/buổi</p>` : ""}
          ${item.status === "cancelled" ? `<p class="warning">Lý do: ${escapeHtml(item.cancelledReason)} · bởi ${escapeHtml(item.cancelledBy === "system" ? "hệ thống" : userName(item.cancelledBy))}</p>` : ""}
          <div class="actions">
            <a class="button small" href="#/case/${item.id}/chat">Mở trao đổi</a>
            ${paymentAction(item, role)}
            ${item.status === "awaiting_payment" && role === "student" ? `<a class="button small" href="#/case/${item.id}/payment">Thanh toán để mở liên hệ</a>` : ""}
            ${item.status === "awaiting_payment" && role === "tutor" ? `<span class="tiny">Đang chờ phụ huynh thanh toán</span>` : ""}
            ${["active", "paid", "completed"].includes(item.status) ? `<a class="button secondary small" href="#/case/${item.id}/active">Xem lịch học</a>` : ""}
          </div>
      </article>
    `;
  }

  function pageTutorDashboard() {
    const user = requireUser("tutor");
    if (!user) return "";
    const data = tutorDashboardFor(user.id);
    return tutorDashboardLayout(user, data);
  }

  function tutorDashboardFor(userId) {
    state.tutorDashboardData ||= {};
    if (!state.tutorDashboardData[userId]) {
      state.tutorDashboardData[userId] = structuredClone(seed.tutorDashboardData.u_tutor);
      save();
    }
    return state.tutorDashboardData[userId];
  }

  function tutorHubNav(active) {
    const items = [
      ["dashboard", "#/tutor", "", "Tổng quan"],
      ["profile", "#/tutor/profile", "", "Hồ sơ"],
      ["requests", "#/tutor/open-cases", "", "Yêu cầu mở"],
      ["schedule", "#/tutor/schedule", "", "Lịch dạy"],
      ["earnings", "#/tutor/earnings", "", "Thu nhập"],
      ["messages", "#/tutor/messages", "", "Tin nhắn"],
      ["settings", "#/tutor/settings", "", "Cài đặt"]
    ];
    return items.map(([key, href, icon, label]) => `<a class="${active === key ? "active" : ""}" href="${href}"><span>${icon}</span>${label}</a>`).join("");
  }

  function tutorHubShell(active, title, subtitle, content) {
    const user = requireUser("tutor");
    if (!user) return "";
    return `
      <main class="tutorhub-dashboard">
        <aside class="tutorhub-sidebar">
          <div class="tutorhub-logo"><img src="assets/tutorhub-mark.png" alt="" /><strong>TutorMatch</strong><small>Dạy đúng học sinh phù hợp.</small></div>
          <nav>${tutorHubNav(active)}</nav>
          <div class="tutorhub-books"></div>
        </aside>
        <section class="tutorhub-main">
          <header class="tutorhub-top">
            <div></div>
            <div class="tutorhub-userbar">
              <span class="bell"><b>3</b></span>
              ${avatarMarkup(user, "tiny")}
              <div><strong>${escapeHtml(user.name.split(" ")[0] || user.name)}</strong><small>Gia sư</small></div>
              <button data-action="logout">Đăng xuất</button>
            </div>
          </header>
          <div class="tutorhub-content tutorhub-page-content">
            <div class="hub-corner"></div>
            <div class="tutorhub-welcome">
              <h1>${escapeHtml(title)}</h1>
              <p>${escapeHtml(subtitle)}</p>
            </div>
            ${content}
          </div>
        </section>
      </main>
    `;
  }

  function tutorDashboardLayout(user, data) {
    const activePending = data.pendingRequests.filter((item) => item.status === "pending");
    const stats = { ...data.stats };
    return `
      <main class="tutorhub-dashboard">
        <aside class="tutorhub-sidebar">
          <div class="tutorhub-logo"><img src="assets/tutorhub-mark.png" alt="" /><strong>TutorMatch</strong><small>Dạy đúng học sinh phù hợp.</small></div>
          <nav>${tutorHubNav("dashboard")}</nav>
          <div class="tutorhub-books"></div>
        </aside>
        <section class="tutorhub-main">
          <header class="tutorhub-top">
            <div></div>
            <div class="tutorhub-userbar">
              <span class="bell"><b>3</b></span>
              ${avatarMarkup(user, "tiny")}
              <div><strong>${escapeHtml(user.name.split(" ")[0] || user.name)}</strong><small>Gia sư</small></div>
              <button data-action="logout">Đăng xuất</button>
            </div>
          </header>
          <div class="tutorhub-content">
            <div class="hub-corner"></div>
            <div class="tutorhub-welcome">
              <h1>Chào ${escapeHtml(user.name.split(" ")[0] || user.name)}, hôm nay có case nào phù hợp?</h1>
              <p>Theo dõi yêu cầu mới, lịch dạy sắp tới và thu nhập từ các buổi đã xác nhận.</p>
            </div>
            <section class="tutorhub-metrics">
              ${hubMetric("", "Học sinh đã dạy", stats.totalStudents, `${stats.totalStudentsDelta} học sinh mới`, "purple")}
              ${hubMetric("", "Yêu cầu đang chờ", stats.pendingRequests, "Xem và phản hồi", "orange")}
              ${hubMetric("", "Thu nhập tháng này", money(stats.monthlyEarnings), `${stats.monthlyEarningsDelta}% so với tháng trước`, "green")}
              ${hubMetric("", "Buổi đã hoàn tất", stats.completedSessions, `${stats.completedSessionsDelta} buổi trong tháng`, "purple")}
            </section>
            <section class="tutorhub-grid">
              <article class="hub-panel pending-panel">
                <div class="hub-panel-head"><h2>Yêu cầu đang chờ</h2><a href="#/tutor/open-cases">Xem tất cả</a></div>
                <div class="hub-list">${activePending.map(hubPendingRow).join("") || `<div class="hub-empty">Chưa có yêu cầu đang chờ.</div>`}</div>
                <a class="hub-footer-link" href="#/tutor/open-cases">Xem tất cả yêu cầu</a>
              </article>
              <article class="hub-panel lessons-panel">
                <div class="hub-panel-head"><h2>Lịch dạy sắp tới</h2><a href="#/tutor/schedule">Xem lịch</a></div>
                <div class="lesson-list">${data.upcomingLessons.map(hubLessonRow).join("")}</div>
                <a class="hub-footer-link" href="#/tutor/schedule">Xem toàn bộ lịch</a>
              </article>
              <article class="hub-panel earnings-panel">
                <div class="hub-panel-head"><h2>Tổng quan thu nhập</h2><a href="#/tutor/earnings">Năm nay</a></div>
                <p>Thu nhập theo tháng (VND)</p>
                <div class="earnings-value"><strong>${money(data.earnings.monthlyIncome)}</strong><span>${data.earnings.yearlyGrowth}%<small>so với năm trước</small></span></div>
                <div class="bar-chart">${data.earnings.months.map((month) => `<div><i style="height:${Math.max(16, Math.round(month.value / 25))}px"></i><small>${escapeHtml(month.label)}</small></div>`).join("")}</div>
                <div class="earnings-summary">
                  <div><span>Từ đầu năm</span><b>${money(data.earnings.ytd)}</b></div>
                  <div><span>Tháng cao nhất</span><b>${money(data.earnings.highestMonth)}</b><small>${escapeHtml(data.earnings.highestMonthLabel)}</small></div>
                  <div><span>Trung bình/tháng</span><b>${money(data.earnings.averagePerMonth)}</b></div>
                </div>
              </article>
            </section>
          </div>
        </section>
      </main>
    `;
  }

  function hubMetric(icon, label, value, delta, tone) {
    return `<article class="hub-metric ${tone}"><span>${icon}</span><div><p>${label}</p><strong>${value}</strong><small>${delta}</small></div></article>`;
  }

  function hubPendingRow(item) {
    return `
      <div class="hub-request-row">
        <img src="${escapeHtml(item.avatarUrl)}" alt="${escapeHtml(item.studentName)}" />
        <div class="request-main"><strong>${escapeHtml(item.studentName)}</strong><span>${escapeHtml(item.subject)} · ${escapeHtml(item.level)}</span><small>${escapeHtml(item.location)}</small></div>
        <div class="request-rate">${money(item.rate)}<small>/ buổi</small></div>
        <button class="accept" data-action="hub-request" data-request-id="${item.id}" data-status="accepted">Nhận case</button>
        <button class="decline" data-action="hub-request" data-request-id="${item.id}" data-status="declined">Từ chối</button>
      </div>
    `;
  }

  function hubLessonRow(item) {
    return `
      <div class="hub-lesson-row">
        <time><span>${escapeHtml(item.month)}</span><b>${escapeHtml(item.day)}</b><small>${escapeHtml(item.weekday)}</small></time>
        <div><strong>${escapeHtml(item.studentName)}</strong><span>${escapeHtml(item.subject)} · ${escapeHtml(item.level)}</span><small>${escapeHtml(item.time)}</small></div>
        <em>${escapeHtml(item.format)}</em>
      </div>
    `;
  }

  function pageTutorMessages() {
    const user = requireUser("tutor");
    if (!user) return "";
    const conversations = [
      ["Mai Anh", "Mình chốt Chủ nhật 16:00 nhé?", "assets/tutor-sophia.png", "2"],
      ["Quốc Huy", "Em cảm ơn, em sẽ làm bài trước.", "assets/tutor-ethan.png", ""],
      ["Minh Châu", "Tuần này em muốn học online.", "assets/tutor-isabella.png", "1"],
      ["Gia Bảo", "Ghi chú buổi học ổn rồi ạ.", "assets/student05-daniel.png", ""],
      ["Khánh Linh", "Thầy xem giúp em phần giới hạn.", "assets/profile-review-ava.png", ""]
    ];
    return tutorHubShell("messages", "Tin nhắn", "Trả lời học sinh và giữ mọi thỏa thuận trong app.", `
      <section class="tutor-messages">
        <aside>
          <input placeholder="Tìm cuộc trò chuyện..." />
          ${conversations.map((item, idx) => `<div class="${idx === 0 ? "active" : ""}"><img src="${item[2]}" alt="" /><p><b>${escapeHtml(item[0])}</b><span>${escapeHtml(item[1])}</span></p>${item[3] ? `<em>${item[3]}</em>` : ""}</div>`).join("")}
        </aside>
        <article>
          <header><img src="assets/tutor-sophia.png" alt="" /><h2>Mai Anh<small>Đang online</small></h2></header>
          <div class="chat-bubbles"><p>Thầy ơi, mình chốt Chủ nhật 16:00 được không ạ?</p><p class="mine">Được nhé, Chủ nhật 16:00 mình học buổi đầu.</p><p>Dạ em sẽ chuẩn bị bài trước.</p></div>
          <footer><input placeholder="Nhập tin nhắn..." /><button>Gửi</button></footer>
        </article>
      </section>
    `);
  }

  function pageTutorSchedule() {
    const user = requireUser("tutor");
    if (!user) return "";
    const data = tutorDashboardFor(user.id);
    return tutorHubShell("schedule", "Lịch dạy", "Quản lý buổi sắp tới, đổi lịch và đánh dấu hoàn tất.", `
      <section class="tutor-page-panel">
        <div class="hub-panel-head"><h2>Buổi sắp tới</h2><button class="tutor-soft-action">Xem lịch</button></div>
        <div class="tutor-schedule-list">${data.upcomingLessons.map((item) => `
          <article class="tutor-schedule-row">
            <time><span>${escapeHtml(item.month)}</span><b>${escapeHtml(item.day)}</b><small>${escapeHtml(item.weekday)}</small></time>
            <div><h3>${escapeHtml(item.studentName)}</h3><p>${escapeHtml(item.subject)} · ${escapeHtml(item.level)}</p><small>${escapeHtml(item.time)} · ${escapeHtml(item.format)}</small></div>
            <span>${escapeHtml(item.format)}</span>
            <footer><button>Đổi lịch</button><button>Đánh dấu đã học</button><button>Chi tiết</button></footer>
          </article>
        `).join("")}</div>
      </section>
    `);
  }

  function pageTutorEarnings() {
    const user = requireUser("tutor");
    if (!user) return "";
    const data = tutorDashboardFor(user.id);
    const rows = data.upcomingLessons.slice(0, 4).map((item, index) => [item.studentName, item.subject, item.time, `$${[75, 90, 80, 60][index]}.00`, index === 0 ? "Pending" : "Paid"]);
    return tutorHubShell("earnings", "Earnings", "Track lesson income and payment status.", `
      <section class="tutor-earnings-grid">
        <article class="hub-panel earnings-panel wide">
          <div class="hub-panel-head"><h2>Earnings Overview</h2><button class="tutor-soft-action">This Year</button></div>
          <p>Monthly Income (USD)</p>
          <div class="earnings-value"><strong>$${Number(data.earnings.monthlyIncome).toLocaleString("en-US")}</strong><span>${data.earnings.yearlyGrowth}%<small>vs last year</small></span></div>
          <div class="bar-chart">${data.earnings.months.map((month) => `<div><i style="height:${Math.max(16, Math.round(month.value / 25))}px"></i><small>${escapeHtml(month.label)}</small></div>`).join("")}</div>
          <div class="earnings-summary"><div><span>YTD Earnings</span><b>$${Number(data.earnings.ytd).toLocaleString("en-US")}</b></div><div><span>Highest Month</span><b>$${Number(data.earnings.highestMonth).toLocaleString("en-US")}</b><small>${escapeHtml(data.earnings.highestMonthLabel)}</small></div><div><span>Avg. per Month</span><b>$${Number(data.earnings.averagePerMonth).toLocaleString("en-US")}</b></div></div>
        </article>
        ${portalTable(["Student", "Subject", "Lesson Time", "Amount", "Status"], rows)}
      </section>
    `);
  }

  function pageTutorSettings() {
    const user = requireUser("tutor");
    if (!user) return "";
    const profile = profileOf(user.id) || {};
    return tutorHubShell("settings", "Settings", "Control account, teaching preferences and notifications.", `
      <section class="settings-grid tutor-settings">
        <article><h2>Account <button>Edit</button></h2><div class="settings-profile">${avatarMarkup(user, "large")}<p>Name <b>${escapeHtml(user.name)}</b></p><p>Email <b>${escapeHtml(user.email)}</b></p><p>Phone <b>${escapeHtml(user.phone)}</b></p></div></article>
        <article><h2>Teaching Preferences</h2><p>Subjects <b>${escapeHtml((profile.subjects || []).join(", ") || "Not set")}</b></p><p>Format <b>${escapeHtml(labels[profile.format] || "Both")}</b></p><p>Hourly Rate <b>${money(profile.hourlyRate || 0)}</b></p><p>Status <b>${escapeHtml(labels[profile.verificationStatus] || "Approved")}</b></p></article>
        <article><h2>Notification Settings</h2><p>New Requests <span class="toggle"></span></p><p>Lesson Reminders <span class="toggle"></span></p><p>Payment Updates <span class="toggle"></span></p></article>
        <article><h2>Privacy & Security</h2><p>Change Password</p><p>Two-Factor Auth <b>Enabled</b></p><p>Profile Visibility</p></article>
      </section>
    `);
  }

  function openRequestsForTutor(tutorId) {
    const profile = profileOf(tutorId);
    if (!profile || profile.verificationStatus !== "approved") return [];
    return state.requests
      .filter((request) => request.status === "open")
      .filter((request) => request.subjects.some((subject) => profile.subjects.includes(subject)))
      .filter((request) => profile.regions.includes(request.region) || profile.regions.includes("Online") || request.format === "online")
      .filter((request) => profile.format === "both" || profile.format === request.format);
  }

  function openRequestCard(request) {
    return `
      <article class="card">
        <div class="row between">
          <h3>${escapeHtml(request.subjects.join(", "))} · ${escapeHtml(request.grade)}</h3>
          <span class="badge">${labels[request.status]}</span>
        </div>
        <p>${escapeHtml(request.region)} · ${labels[request.format]} · ${request.schedule.map(escapeHtml).join(", ")}</p>
        <p>${request.studentsCount} học sinh · ${money(request.budgetMin)} - ${money(request.budgetMax)} · ${escapeHtml(request.note || "")}</p>
        <button class="button small" data-action="tutor-claim" data-request-id="${request.id}">Trao đổi với phụ huynh</button>
      </article>
    `;
  }

  function tutorStatusPage(status, reason) {
    return layout(`
      <section class="workspace narrow">
        <div class="panel status-panel">
          <span class="badge ${status === "rejected" ? "danger" : ""}">${labels[status]}</span>
          <h1>${status === "pending_review" ? "Hồ sơ của bạn đang được kiểm tra" : "Bạn cần bổ sung hồ sơ"}</h1>
          <p>${status === "pending_review" ? "Chúng tôi sẽ kiểm tra bằng cấp/minh chứng trước khi phụ huynh có thể thấy hồ sơ của bạn." : `Lý do từ chối: ${escapeHtml(reason || "Cần bổ sung minh chứng.")}`}</p>
          <a class="button" href="#/tutor/profile">Sửa và nộp lại hồ sơ</a>
        </div>
      </section>
    `, "dashboard");
  }

  function pageOpenCases() {
    const user = requireUser("tutor");
    if (!user) return "";
    const profile = profileOf(user.id);
    if (!profile || profile.verificationStatus !== "approved") return tutorStatusPage(profile?.verificationStatus || "pending_review", profile?.rejectionReason || "");
    const subject = routeQuery().subject || "";
    const region = routeQuery().region || "";
    let requests = openRequestsForTutor(user.id);
    if (subject) requests = requests.filter((request) => request.subjects.includes(subject));
    if (region) requests = requests.filter((request) => request.region === region);
    const pendingRequests = tutorDashboardFor(user.id).pendingRequests.filter((item) => item.status === "pending");
    const requestContent = requests.length
      ? requests.map(openRequestCard).join("")
      : pendingRequests.map(hubPendingRow).join("") || empty("Không có nhu cầu phù hợp bộ lọc này.", "Thử bỏ bớt môn hoặc khu vực để xem nhiều học sinh hơn.");
    return tutorHubShell("requests", "Requests", "Browse open student requests and start a conversation when the fit is right.", `
      <section class="workspace">
        <div class="section-head"><p class="eyebrow">Tìm học sinh phù hợp</p><h1>Nhu cầu đang mở</h1></div>
        <form class="filters" data-form="open-filter">
          ${select("subject", "Môn", ["", ...SUBJECTS], subject)}
          ${select("region", "Khu vực", ["", ...REGIONS], region)}
          <button class="button small" type="submit">Lọc</button>
        </form>
        <div class="cards tutor-request-results">${requestContent}</div>
      </section>
    `);
  }

  function pageTutorProfile(isFirst = false) {
    const user = requireUser("tutor");
    if (!user) return "";
    const profile = profileOf(user.id) || {};
    const content = `
      <section class="workspace narrow">
        <form class="panel form" data-form="tutor-profile">
          <p class="eyebrow">${isFirst ? "Để phụ huynh tin tưởng bạn" : "Hồ sơ gia sư"}</p>
          <h1>${isFirst ? "Nộp hồ sơ để bắt đầu nhận học sinh" : "Cập nhật cách phụ huynh nhìn thấy bạn"}</h1>
          <div class="policy-box"><b>Vì sao cần xác minh?</b><p>Phụ huynh sẽ yên tâm hơn khi biết bạn đủ 16 tuổi, có học vấn tối thiểu lớp 10 và có minh chứng năng lực rõ ràng.</p></div>
          <div class="two-col">
            <label>Tuổi<input name="age" type="number" min="16" required value="${profile.age || 18}" /></label>
            ${select("educationLevel", "Học vấn cao nhất", EDUCATION_LEVELS, profile.educationLevel || "grade_10")}
          </div>
          ${multiSelect("subjects", "Môn dạy", SUBJECTS, profile.subjects || ["Toán"])}
          ${multiSelect("regions", "Khu vực nhận dạy", REGIONS, profile.regions || ["Online"])}
          ${radioGroup("format", "Hình thức", FORMATS, profile.format || "both")}
          <label>Học phí đề xuất/buổi<input name="hourlyRate" type="number" required value="${profile.hourlyRate || 250000}" /></label>
          ${multiSelect("availability", "Lịch trống", SLOTS, profile.availability || ["T3 tối"])}
          <label>Giới thiệu để phụ huynh hiểu cách bạn dạy<textarea name="bio" required>${escapeHtml(profile.bio || "")}</textarea></label>
          <label>Bằng cấp/minh chứng giúp phụ huynh tin tưởng<input name="credentials" type="file" multiple accept=".pdf,image/*" /></label>
          <p class="tiny">Bản dùng thử lưu tên file trong trình duyệt. File hiện có: ${(profile.credentialFiles || []).map(escapeHtml).join(", ") || "chưa có"}</p>
          <button class="button" type="submit">Nộp hồ sơ để được xác minh</button>
        </form>
      </section>
    `;
    return tutorHubShell("profile", isFirst ? "Complete Your Profile" : "My Profile", isFirst ? "Submit your credentials before students can see you." : "Update how students and parents see your teaching profile.", content);
  }

  function pageChat(caseId) {
    const user = currentUser();
    if (!user) return pageAuth("login");
    const item = caseOf(caseId);
    if (!item) return notFound("Không tìm thấy cuộc trao đổi này.");
    const request = requestOf(item.requestId);
    const tutor = state.users.find((entry) => entry.id === item.tutorId);
    const student = state.users.find((entry) => entry.id === request?.studentId);
    if (!canAccessCase(user, item)) return notFound("Bạn không có quyền xem cuộc trao đổi này.");
    const messages = state.messages.filter((message) => message.caseId === caseId);
    const other = user.id === item.tutorId ? student : tutor;
    const showContact = ["paid", "active", "completed"].includes(item.status);
    const canCancel = !["paid", "active", "completed", "cancelled"].includes(item.status);

    return layout(`
      <section class="workspace chat-layout">
        <div class="panel chat-panel">
          <div class="row between">
            <div><p class="eyebrow">${escapeHtml(caseTitle(item))}</p><h1>Trao đổi trước khi chốt lịch</h1></div>
            <span class="badge">${labels[item.status]}</span>
          </div>
          <div class="messages">
            ${messages.map((message) => `<div class="message ${message.senderId === user.id ? "mine" : ""}"><b>${escapeHtml(userName(message.senderId))}</b><p>${escapeHtml(message.content)}</p><span>${fmtDate(message.createdAt)}</span></div>`).join("") || empty("Chưa có tin nhắn.", "Hãy hỏi về mục tiêu học, lịch rảnh, cách dạy hoặc học phí trước khi tạo thư xác nhận.")}
          </div>
          ${item.status !== "cancelled" ? `<form class="composer" data-form="message" data-case-id="${caseId}"><input name="content" required placeholder="Nhập tin nhắn..." /><button class="button small" type="submit">Gửi</button></form>` : ""}
        </div>
        <aside class="panel side-panel">
          <h2>Bước tiếp theo</h2>
          ${showContact ? `<div class="contact-box"><b>Bạn có thể liên hệ ${escapeHtml(other?.name || "")}</b><span>${escapeHtml(other?.phone || "")}</span><span>${escapeHtml(other?.email || "")}</span><span>${escapeHtml(other?.address || "")}</span></div>` : `<div class="locked">Số điện thoại/email vẫn được giữ kín. Xác nhận lịch học và thanh toán để mở liên hệ.</div>`}
          <div class="policy-box"><b>Nếu cần hủy hoặc đổi lịch</b><p>Trước khi thanh toán, bạn có thể hủy cuộc trao đổi. Sau khi đã xác nhận lịch, hủy sát giờ trong 48-72 giờ có thể phát sinh phí hủy.</p></div>
          <a class="button secondary full" href="#/case/${caseId}/confirm">Tạo hoặc xem thư xác nhận</a>
          ${paymentAction(item, user.role, "full")}
          ${item.status === "awaiting_payment" && user.role === "student" ? `<a class="button full" href="#/case/${caseId}/payment">Thanh toán để mở liên hệ</a>` : ""}
          ${item.status === "awaiting_payment" && user.role === "tutor" ? `<div class="locked">Đang chờ phụ huynh thanh toán để mở liên hệ trực tiếp.</div>` : ""}
          ${["paid", "active", "completed"].includes(item.status) ? `<a class="button full" href="#/case/${caseId}/active">Xem lịch học đã chốt</a>` : ""}
          ${canCancel ? `<form data-form="cancel-case" data-case-id="${caseId}" class="form mini"><label>Lý do hủy<input name="reason" required placeholder="Ví dụ: không phù hợp lịch, không thống nhất học phí..." /></label><button class="ghost danger full" type="submit">Dừng trao đổi này</button></form>` : ""}
        </aside>
      </section>
    `, "dashboard");
  }

  function pageConfirm(caseId) {
    const user = currentUser();
    if (!user) return pageAuth("login");
    const item = caseOf(caseId);
    if (!item) return notFound("Không tìm thấy cuộc trao đổi này.");
    if (!canAccessCase(user, item)) return notFound("Bạn không có quyền xem thư xác nhận này.");
    const letter = state.confirmationLetters.find((entry) => entry.caseId === caseId);
    return layout(`
      <section class="workspace narrow">
        <form class="panel form" data-form="confirmation" data-case-id="${caseId}">
          <p class="eyebrow">Để hai bên không hiểu nhầm</p>
          <h1>${letter ? "Xem lại lịch và học phí đã chốt" : "Ghi lại lịch học đã thống nhất"}</h1>
          <label>Số buổi đã thỏa thuận<input name="lessonsCount" type="number" min="1" required value="${letter?.lessonsCount || 1}" /></label>
          <label>Ngày/giờ học<input name="schedule" required value="${escapeHtml(letter?.schedule || "T3 19:00 - 20:30")}" /></label>
          <label>Học phí/buổi<input name="fee" type="number" required value="${letter?.fee || profileOf(item.tutorId)?.hourlyRate || 250000}" /></label>
          ${radioGroup("format", "Hình thức", ["online", "home"], letter?.format || requestOf(item.requestId)?.format || "home")}
          <label>Ghi chú thêm cho buổi đầu<textarea name="note">${escapeHtml(letter?.note || "")}</textarea></label>
          <div class="policy-box"><b>Trước khi bấm lưu</b><p>Hãy kiểm tra kỹ số buổi, giờ học, học phí và hình thức học. Đây là thông tin hai bên sẽ xem lại nếu có tranh chấp.</p></div>
          <button class="button" type="submit">Lưu lịch học đã thống nhất</button>
          ${letter ? paymentAction(item, user.role, "secondary") : ""}
          <a class="button secondary" href="#/case/${caseId}/chat">Quay lại trao đổi</a>
        </form>
      </section>
    `, "dashboard");
  }

  function pagePayment(caseId) {
    const user = requireUser("student");
    if (!user) return "";
    const item = caseOf(caseId);
    if (!item) return notFound("Không tìm thấy cuộc trao đổi này.");
    if (!canAccessCase(user, item) || user.id !== studentIdForCase(item)) return notFound("Bạn không có quyền thanh toán cuộc trao đổi này.");
    const letter = state.confirmationLetters.find((entry) => entry.caseId === caseId);
    if (!letter) return notFound("Cần tạo thư xác nhận trước khi thanh toán.");
    if (["paid", "active", "completed"].includes(item.status)) {
      navigate(`#/case/${caseId}/active`);
      return "";
    }
    const amount = connectionFee(letter);
    return layout(`
      <section class="workspace narrow">
        <div class="panel payment">
          <p class="eyebrow">Bước cuối trước khi mở liên hệ</p>
          <h1>Thanh toán để xác nhận lịch học</h1>
          <dl>
            <div><dt>Gia sư</dt><dd>${escapeHtml(userName(item.tutorId))}</dd></div>
            <div><dt>Số tiền</dt><dd>${money(amount)}</dd></div>
            <div><dt>Lịch học</dt><dd>${escapeHtml(letter.schedule)}</dd></div>
            <div><dt>Sau thanh toán</dt><dd>Bạn sẽ thấy số điện thoại/email của gia sư</dd></div>
          </dl>
          <button class="button full" data-action="pay-case" data-case-id="${caseId}">Xác nhận thanh toán</button>
          <p class="tiny">Số tiền được tính theo thư xác nhận, tối đa 2 buổi hoặc ${money(SERVICE_FEE_CAP)}, lấy số thấp hơn. Sau thanh toán, liên hệ trực tiếp được mở.</p>
        </div>
      </section>
    `, "dashboard");
  }

  function pageActiveCase(caseId) {
    const user = currentUser();
    if (!user) return pageAuth("login");
    const item = caseOf(caseId);
    if (!item) return notFound("Không tìm thấy cuộc trao đổi này.");
    if (!canAccessCase(user, item)) return notFound("Bạn không có quyền xem lịch học này.");
    const request = requestOf(item.requestId);
    const letter = state.confirmationLetters.find((entry) => entry.caseId === caseId);
    const student = state.users.find((entry) => entry.id === request?.studentId);
    const tutor = state.users.find((entry) => entry.id === item.tutorId);
    const other = user.id === item.tutorId ? student : tutor;
    const payments = state.payments.filter((payment) => payment.caseId === caseId);
    return layout(`
      <section class="workspace">
        <div class="panel">
          <div class="row between"><div><p class="eyebrow">Lịch học đã chốt</p><h1>${escapeHtml(caseTitle(item))}</h1></div><span class="badge">${labels[item.status]}</span></div>
          <div class="info-grid">
            <div><b>Lịch học</b><p>${escapeHtml(letter?.schedule || "Chưa có")}</p></div>
            <div><b>Số buổi</b><p>${letter?.lessonsCount || 1}</p></div>
            <div><b>Học phí/buổi</b><p>${money(letter?.fee || 0)}</p></div>
            <div><b>Hình thức</b><p>${labels[letter?.format || request?.format]}</p></div>
          </div>
          <div class="contact-box"><b>Liên hệ trực tiếp với ${escapeHtml(other?.name || "")}</b><span>${escapeHtml(other?.phone || "")}</span><span>${escapeHtml(other?.email || "")}</span><span>${escapeHtml(other?.address || "")}</span></div>
          <div class="payments-list">
            <h2>Các khoản đã thanh toán</h2>
            ${payments.map((payment) => `<div><span>Thanh toán xác nhận lịch học</span><b>${money(payment.amount)}</b><small>${fmtDate(payment.createdAt)}</small></div>`).join("") || "<p>Chưa có thanh toán.</p>"}
          </div>
          <div class="actions">
            ${item.status === "paid" ? `<button class="button" data-action="activate-case" data-case-id="${caseId}">Xác nhận đã bắt đầu học</button>` : ""}
            ${item.status === "active" ? `<button class="button" data-action="complete-case" data-case-id="${caseId}">Đánh dấu buổi học đã xong</button>` : ""}
            ${item.status === "completed" ? `<a class="button" href="#/case/${caseId}/review">Viết đánh giá</a>` : ""}
            <a class="button secondary" href="#/case/${caseId}/chat">Quay lại trao đổi</a>
          </div>
        </div>
      </section>
    `, "dashboard");
  }

  function pageReview(caseId) {
    const user = currentUser();
    if (!user) return pageAuth("login");
    const item = caseOf(caseId);
    if (!item) return notFound("Không tìm thấy cuộc trao đổi này.");
    if (!canAccessCase(user, item)) return notFound("Bạn không có quyền đánh giá cuộc trao đổi này.");
    const request = requestOf(item.requestId);
    const reviewee = user.id === item.tutorId ? request.studentId : item.tutorId;
    return layout(`
      <section class="workspace narrow">
        <form class="panel form" data-form="review" data-case-id="${caseId}" data-reviewee-id="${reviewee}">
          <p class="eyebrow">Giúp người sau quyết định dễ hơn</p>
          <h1>Bạn thấy trải nghiệm với ${escapeHtml(userName(reviewee))} thế nào?</h1>
          <label>Điểm đánh giá<input name="rating" type="number" min="1" max="5" required value="5" /></label>
          <label>Nhận xét<textarea name="comment" required placeholder="Ví dụ: đúng giờ, giải thích dễ hiểu, phản hồi nhanh, cần chuẩn bị bài kỹ hơn..."></textarea></label>
          <button class="button" type="submit">Gửi đánh giá</button>
        </form>
      </section>
    `, "history");
  }

  function pageHistory(role) {
    const user = requireUser(role);
    if (!user) return "";
    const status = routeQuery().status || "";
    let cases = role === "student"
      ? state.cases.filter((item) => requestOf(item.requestId)?.studentId === user.id)
      : state.cases.filter((item) => item.tutorId === user.id);
    if (status) cases = cases.filter((item) => item.status === status);
    return layout(`
      <section class="workspace">
        <div class="section-head"><p class="eyebrow">Lịch sử</p><h1>Tất cả cuộc trao đổi và lịch học</h1></div>
        <form class="filters" data-form="history-filter" data-role="${role}">
          ${select("status", "Trạng thái", ["", ...CASE_STATUSES], status)}
          <button class="button small" type="submit">Lọc</button>
        </form>
        <div class="cards">${cases.map(caseCard).join("") || empty("Không có mục nào trong bộ lọc này.", "Thử chọn trạng thái khác để xem lại các cuộc trao đổi cũ.")}</div>
      </section>
    `, "history");
  }

  function pageProfile(role) {
    const user = requireUser(role);
    if (!user) return "";
    if (role === "tutor") return pageTutorProfile();
    return layout(`
      <section class="workspace narrow">
        <form class="panel form" data-form="student-profile">
          <p class="eyebrow">Cài đặt</p>
          <h1>Hồ sơ cá nhân</h1>
          <label>Họ tên<input name="name" required value="${escapeHtml(user.name)}" /></label>
          ${radioGroup("studentKind", "Bạn là", ["parent", "self_student"], user.studentKind || "parent")}
          <label>Số điện thoại<input name="phone" required value="${escapeHtml(user.phone)}" /></label>
          <label>Địa chỉ<input name="address" required value="${escapeHtml(user.address)}" /></label>
          <button class="button" type="submit">Lưu</button>
        </form>
      </section>
    `, "profile");
  }

  function pageAdmin() {
    const user = requireUser("admin");
    if (!user) return "";
    const queue = state.tutorProfiles.filter((profile) => profile.verificationStatus !== "approved");
    return layout(`
      <section class="workspace">
        <div class="section-head"><p class="eyebrow">Kiểm duyệt hồ sơ</p><h1>Gia sư đang chờ xác minh</h1></div>
        <div class="cards">
          ${queue.map((profile) => {
            const tutor = state.users.find((entry) => entry.id === profile.userId);
            return `
              <article class="card">
                <div class="row between"><h3>${escapeHtml(tutor?.name || "")}</h3><span class="badge ${profile.verificationStatus === "rejected" ? "danger" : ""}">${labels[profile.verificationStatus]}</span></div>
                <p>${escapeHtml(profile.subjects.join(", "))} · ${escapeHtml(profile.regions.join(", "))} · ${money(profile.hourlyRate)}</p>
                <p>Tuổi ${profile.age || "chưa khai"} · ${labels[profile.educationLevel] || "Chưa khai học vấn"}</p>
                <p>${escapeHtml(profile.bio)}</p>
                <div class="files">${profile.credentialFiles.map((file) => `<span title="Demo file">${escapeHtml(file)}</span>`).join("")}</div>
                ${profile.rejectionReason ? `<p class="warning">Lý do từ chối trước đó: ${escapeHtml(profile.rejectionReason)}</p>` : ""}
                <div class="actions">
                  <button class="button small" data-action="approve-tutor" data-user-id="${profile.userId}">Xác minh hồ sơ</button>
                </div>
                <form data-form="reject-tutor" data-user-id="${profile.userId}" class="form mini">
                  <label>Lý do từ chối<input name="reason" required placeholder="Ví dụ: bằng cấp chưa rõ, thiếu minh chứng kinh nghiệm..." /></label>
                  <button class="ghost danger" type="submit">Từ chối hồ sơ</button>
                </form>
              </article>
            `;
          }).join("") || empty("Không còn hồ sơ chờ duyệt.", "Gia sư đã xác minh sẽ xuất hiện trong danh sách phù hợp của phụ huynh.")}
        </div>
      </section>
    `, "admin");
  }

  function select(name, label, options, selected = "") {
    return `<label>${label}<select name="${name}">${options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option ? labels[option] || option : "Tất cả")}</option>`).join("")}</select></label>`;
  }

  function radioGroup(name, label, options, selected) {
    return `<fieldset><legend>${label}</legend><div class="segmented">${options.map((option) => `<label><input type="radio" name="${name}" value="${option}" ${option === selected ? "checked" : ""} />${labels[option] || option}</label>`).join("")}</div></fieldset>`;
  }

  function multiSelect(name, label, options, selected = []) {
    return `<fieldset><legend>${label}</legend><div class="checks">${options.map((option) => `<label><input type="checkbox" name="${name}" value="${escapeHtml(option)}" ${selected.includes(option) ? "checked" : ""} />${escapeHtml(option)}</label>`).join("")}</div></fieldset>`;
  }

  function formValues(form) {
    const data = new FormData(form);
    const values = {};
    for (const [key, value] of data.entries()) {
      if (values[key]) {
        values[key] = Array.isArray(values[key]) ? [...values[key], value] : [values[key], value];
      } else {
        values[key] = value;
      }
    }
    ["subjects", "regions", "availability", "schedule"].forEach((key) => {
      if (form.querySelector(`[name="${key}"]`)) values[key] = data.getAll(key);
    });
    return values;
  }

  function empty(title, copy) {
    return `<div class="empty"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></div>`;
  }

  function notFound(message) {
    const user = currentUser();
    return layout(`<section class="workspace narrow"><div class="panel"><h1>Không tìm thấy</h1><p>${escapeHtml(message)}</p><a class="button" href="${dashboardPath(user)}">${user ? "Về trang của tôi" : "Về trang chủ"}</a></div></section>`);
  }

  function routeQuery() {
    const query = location.hash.split("?")[1] || "";
    return Object.fromEntries(new URLSearchParams(query));
  }

  function routePath() {
    return (location.hash.replace(/^#/, "") || "/").split("?")[0];
  }

  function render() {
    const path = routePath();
    const parts = path.split("/").filter(Boolean);

    if (path === "/" || ["how", "subjects", "resources", "about"].includes(path)) app.innerHTML = pageHome();
    else if (parts[0] === "auth") app.innerHTML = pageAuth(parts[1] || "login", parts[2] || "student");
    else if (path === "/student") app.innerHTML = pageStudentDashboard();
    else if (path === "/student/tutors") app.innerHTML = pageStudentTutors();
    else if (path === "/student/messages") app.innerHTML = pageStudentMessages();
    else if (path === "/student/payments") app.innerHTML = pageStudentPaymentsPortal();
    else if (path === "/student/sessions") app.innerHTML = pageStudentSessions();
    else if (path === "/student/reviews") app.innerHTML = pageStudentReviewsPortal();
    else if (path === "/student/settings") app.innerHTML = pageStudentSettingsPortal();
    else if (path === "/student/help") app.innerHTML = pageStudentHelp();
    else if (path === "/student/request/new") app.innerHTML = pageRequestForm();
    else if (parts[0] === "student" && parts[1] === "request" && parts[3] === "matches") app.innerHTML = pageMatches(parts[2]);
    else if (parts[0] === "student" && parts[1] === "request" && parts[3] === "cases") app.innerHTML = pageRequestCases(parts[2]);
    else if (parts[0] === "student" && parts[1] === "tutor") app.innerHTML = pageTutorDetail(parts[2], routeQuery().request);
    else if (path === "/tutor") app.innerHTML = pageTutorDashboard();
    else if (path === "/tutor/open-cases") app.innerHTML = pageOpenCases();
    else if (path === "/tutor/schedule") app.innerHTML = pageTutorSchedule();
    else if (path === "/tutor/earnings") app.innerHTML = pageTutorEarnings();
    else if (path === "/tutor/messages") app.innerHTML = pageTutorMessages();
    else if (path === "/tutor/settings") app.innerHTML = pageTutorSettings();
    else if (path === "/tutor/profile") app.innerHTML = pageTutorProfile();
    else if (parts[0] === "case" && parts[2] === "chat") app.innerHTML = pageChat(parts[1]);
    else if (parts[0] === "case" && parts[2] === "confirm") app.innerHTML = pageConfirm(parts[1]);
    else if (parts[0] === "case" && parts[2] === "payment") app.innerHTML = pagePayment(parts[1]);
    else if (parts[0] === "case" && parts[2] === "active") app.innerHTML = pageActiveCase(parts[1]);
    else if (parts[0] === "case" && parts[2] === "review") app.innerHTML = pageReview(parts[1]);
    else if (path === "/student/history") app.innerHTML = pageHistory("student");
    else if (path === "/tutor/history") app.innerHTML = pageHistory("tutor");
    else if (path === "/student/profile") app.innerHTML = pageProfile("student");
    else if (path === "/tutor/profile") app.innerHTML = pageProfile("tutor");
    else if (path === "/admin") app.innerHTML = pageAdmin();
    else app.innerHTML = notFound("Route không tồn tại.");
    const tutorFilterInput = document.querySelector?.("[data-tutor-filters] input");
    if (tutorFilterInput) filterPortalTutors(tutorFilterInput);
  }

  function portalToast(message) {
    document.querySelector(".portal-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "portal-toast";
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }

  function filterPortalTutors(input) {
    const portal = input.closest(".student-portal") || document;
    const filters = portal.querySelector("[data-tutor-filters]");
    const query = filters?.querySelector("input")?.value.trim().toLowerCase() || "";
    const [subjectSelect, statusSelect, locationSelect] = [...(filters?.querySelectorAll("select") || [])];
    const subject = subjectSelect?.value || "Tất cả môn";
    const status = statusSelect?.value || "Tất cả trạng thái";
    const location = locationSelect?.value || "Tất cả khu vực";
    const cards = [...document.querySelectorAll(".portal-tutor-card")];
    const pagination = portal.querySelector(".portal-pagination");
    let page = Number(pagination?.dataset.page || 1);
    const perPage = 6;
    const matched = [];
    cards.forEach((card) => {
      const text = (card.dataset.search || card.textContent).toLowerCase();
      const matchesQuery = !query || text.includes(query);
      const matchesSubject = ["All Subjects", "Tất cả môn"].includes(subject) || card.dataset.subject === subject;
      const matchesStatus = ["All Status", "Tất cả trạng thái"].includes(status) || card.dataset.status === status;
      const matchesLocation = ["All Locations", "Tất cả khu vực"].includes(location) || card.dataset.location === location;
      const match = matchesQuery && matchesSubject && matchesStatus && matchesLocation;
      card.dataset.filtered = match ? "true" : "false";
      if (match) matched.push(card);
    });
    const totalPages = Math.max(1, Math.ceil(matched.length / perPage));
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    if (pagination) pagination.dataset.page = String(page);
    cards.forEach((card) => {
      card.hidden = true;
    });
    matched.forEach((card, index) => {
      card.hidden = index < (page - 1) * perPage || index >= page * perPage;
    });
    const count = document.querySelector(".portal-pagination p");
    if (count) {
      const start = matched.length ? (page - 1) * perPage + 1 : 0;
      const end = Math.min(page * perPage, matched.length);
      count.textContent = `Đang hiển thị ${start}-${end} trong ${matched.length} gia sư`;
    }
    pagination?.querySelectorAll("b, span").forEach((item) => {
      item.classList.toggle("active-page", item.textContent.trim() === String(page));
    });
  }

  function filterPortalConversations(input) {
    const query = input.value.trim().toLowerCase();
    const chat = input.closest(".portal-chat, .tutor-messages");
    let visible = 0;
    chat?.querySelectorAll("aside > div").forEach((item) => {
      const match = item.textContent.toLowerCase().includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });
    const count = chat?.querySelector(".conversation-count");
    if (count) count.textContent = `${visible} conversation${visible === 1 ? "" : "s"}`;
    const empty = chat?.querySelector(".conversation-empty");
    if (empty) empty.hidden = visible !== 0;
  }

  function filterPayments(select) {
    const portal = select.closest(".student-portal") || document;
    const filters = portal.querySelector("[data-payment-filters]");
    const panel = portal.querySelector(".portal-result-panel");
    if (panel) panel.dataset.sticky = "false";
    const [dateSelect, statusSelect, tutorSelect] = [...(filters?.querySelectorAll("select") || [])];
    const status = statusSelect?.value || "Tất cả trạng thái";
    const tutor = tutorSelect?.value || "Tất cả gia sư";
    let visible = 0;
    portal.querySelectorAll(".payment-table tbody tr").forEach((row) => {
      const statusMatch = ["All Status", "Tất cả trạng thái"].includes(status) || row.dataset.status === status;
      const tutorMatch = ["All Tutors", "Tất cả gia sư"].includes(tutor) || row.dataset.tutor === tutor;
      row.hidden = !(statusMatch && tutorMatch);
      if (!row.hidden) visible += 1;
    });
    const count = portal.querySelector(".portal-pagination span");
    if (count) count.textContent = `Đang hiển thị ${visible ? 1 : 0}-${visible} trong ${visible} thanh toán`;
    if (panel && visible === 0) {
      panel.hidden = false;
      panel.innerHTML = `<h3>Không có thanh toán phù hợp</h3><p>Thử đổi trạng thái, gia sư hoặc khoảng thời gian.</p>`;
    } else if (panel && panel.dataset.sticky !== "true") {
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (dateSelect && !["Apr 1, 2025 - May 25, 2025", "01/05/2026 - 30/06/2026"].includes(dateSelect.value)) portalToast(`Đã chọn ${dateSelect.value}.`);
  }

  function showPortalPanel(portal, title, copy) {
    const panel = portal.querySelector(".portal-result-panel");
    if (!panel) return;
    panel.dataset.sticky = "true";
    panel.hidden = false;
    panel.innerHTML = `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p>`;
  }

  function switchPortalConversation(item) {
    const chat = item.closest(".portal-chat, .tutor-messages");
    if (!chat) return;
    if (chat.classList.contains("portal-chat")) {
      const user = currentUser();
      if (user?.role === "student") {
        const data = studentPortalDataFor(user.id);
        const conversation = data.conversations.find((entry) => entry.id === item.dataset.conversationId);
        if (conversation) {
          data.activeConversationId = conversation.id;
          conversation.unread = 0;
          save();
        }
      }
    }
    chat.querySelectorAll("aside > div").forEach((entry) => entry.classList.remove("active"));
    item.classList.add("active");
    item.querySelector("em")?.remove();
    const name = item.querySelector("b")?.textContent || "Tutor";
    const avatar = item.querySelector("img")?.getAttribute("src") || "assets/tutor-alex.png";
    const header = chat.querySelector("article header");
    if (header) {
      header.querySelector("img")?.setAttribute("src", avatar);
      const title = header.querySelector("h2");
      if (title) title.innerHTML = `${escapeHtml(name)}<small>● Online</small>`;
    }
    const user = currentUser();
    const data = user?.role === "student" ? studentPortalDataFor(user.id) : null;
    const conversation = data?.conversations.find((entry) => entry.id === item.dataset.conversationId);
    const bubbles = chat.querySelector(".chat-bubbles");
    if (bubbles && conversation) {
      bubbles.innerHTML = conversation.messages.map((message) => `<p class="${message.from === "student" ? "mine" : ""}">${escapeHtml(message.text)}</p>`).join("");
    } else if (bubbles) {
      bubbles.innerHTML = `
        <p>Hi Sarah, I reviewed your learning goals.</p>
        <p class="mine">Great, I want to focus on the next lesson plan.</p>
        <p>Perfect. I can prepare practice questions before our session.</p>
      `;
    }
  }

  function sendPortalMessage(button) {
    const footer = button.closest("footer");
    const input = footer?.querySelector("input");
    const message = input?.value.trim();
    if (!message) return;
    const bubbles = button.closest(".portal-chat, .tutor-messages")?.querySelector(".chat-bubbles");
    if (!bubbles) return;
    const user = currentUser();
    const chat = button.closest(".portal-chat, .tutor-messages");
    if (chat?.classList.contains("portal-chat") && user?.role === "student") {
      const data = studentPortalDataFor(user.id);
      const active = data.conversations.find((entry) => entry.id === data.activeConversationId) || data.conversations[0];
      active.messages.push({ from: "student", text: message });
      active.preview = message;
      save();
    }
    const bubble = document.createElement("p");
    bubble.className = "mine";
    bubble.textContent = message;
    bubbles.append(bubble);
    input.value = "";
    bubbles.scrollTop = bubbles.scrollHeight;
    portalToast("Message sent.");
  }

  function handlePortalClick(event) {
    const portal = event.target.closest(".student-portal");
    if (!portal) return false;
    const chatPerson = event.target.closest(".portal-chat aside > div");
    if (chatPerson) {
      event.preventDefault();
      switchPortalConversation(chatPerson);
      return true;
    }
    const chatSend = event.target.closest(".portal-chat footer button");
    if (chatSend) {
      event.preventDefault();
      sendPortalMessage(chatSend);
      return true;
    }
    const clearFilters = event.target.closest(".portal-filter a");
    if (clearFilters && clearFilters.textContent.includes("Clear")) {
      event.preventDefault();
      const filterBar = clearFilters.closest(".portal-filter");
      const input = filterBar?.querySelector("input");
      if (input) input.value = "";
      filterBar?.querySelectorAll("select").forEach((select) => {
        select.selectedIndex = 0;
      });
      const pagination = portal.querySelector(".portal-pagination");
      if (pagination) pagination.dataset.page = "1";
      if (input) filterPortalTutors(input);
      portalToast("Filters cleared.");
      return true;
    }
    const paymentAction = event.target.closest(".portal-filter a, .portal-table td");
    if (paymentAction && portal.querySelector(".portal-table")) {
      const text = paymentAction.dataset.paymentAction || paymentAction.textContent.trim();
      if (text.includes("Download")) {
        event.preventDefault();
        showPortalPanel(portal, "Invoice ready", "A demo invoice for the visible payment list is ready to download.");
        portalToast("Invoice download prepared.");
        return true;
      }
      if (text.includes("Add Payment")) {
        event.preventDefault();
        const user = currentUser();
        if (user?.role === "student") {
          studentPortalDataFor(user.id).paymentMethod = "Mastercard ending in 5678";
          save();
        }
        const method = portal.querySelector(".payment-summary article:last-child");
        if (method) method.innerHTML = `Payment Method<b>Mastercard ending in 5678</b><span>Added just now</span>`;
        showPortalPanel(portal, "Payment method added", "Mastercard ending in 5678 is now the default demo payment method.");
        portalToast("Payment method form opened.");
        return true;
      }
      if (text.includes("Receipt") || text.includes("Pay Now") || text.includes("Retry") || text.includes("View Details")) {
        event.preventDefault();
        const row = paymentAction.closest("tr");
        const cells = row ? [...row.children].map((cell) => cell.textContent.trim()) : [];
        const user = currentUser();
        const payment = user?.role === "student" ? studentPortalDataFor(user.id).payments.find((item) => item.id === row?.dataset.paymentId) : null;
        if (text.includes("Pay Now") && row) {
          if (payment) payment.status = "Completed";
          row.dataset.status = "Completed";
          row.querySelector(".status").textContent = "Completed";
          paymentAction.textContent = "Receipt";
          paymentAction.dataset.paymentAction = "Receipt";
          save();
          showPortalPanel(portal, "Payment completed", `${cells[4] || "Payment"} paid for ${cells[1] || "your tutor"}.`);
        } else if (text.includes("Retry") && row) {
          if (payment) payment.status = "Pending";
          row.dataset.status = "Pending";
          row.querySelector(".status").textContent = "Pending";
          paymentAction.textContent = "Pay Now";
          paymentAction.dataset.paymentAction = "Pay Now";
          save();
          showPortalPanel(portal, "Retry started", `Payment retry is ready for ${cells[1] || "this tutor"}.`);
        } else {
          showPortalPanel(portal, "Receipt opened", `${cells[0] || "Payment"} · ${cells[1] || "Tutor"} · ${cells[4] || "Amount"}`);
        }
        const select = portal.querySelector("[data-payment-filters] select");
        if (select) filterPayments(select);
        portalToast("Payment record updated.");
        return true;
      }
    }
    const calendarLink = event.target.closest(".portal-section-head a");
    if (calendarLink && calendarLink.textContent.includes("Calendar")) {
      event.preventDefault();
      const calendar = portal.querySelector(".session-calendar");
      if (calendar) {
        calendar.hidden = !calendar.hidden;
        portalToast(calendar.hidden ? "Calendar hidden." : "Calendar opened.");
      }
      return true;
    }
    const sessionButton = event.target.closest(".session-row button");
    if (sessionButton) {
      event.preventDefault();
      const row = sessionButton.closest(".session-row");
      const status = row?.querySelector(":scope > span");
      const text = sessionButton.dataset.sessionAction || sessionButton.textContent.trim();
      const user = currentUser();
      const session = user?.role === "student" ? studentPortalDataFor(user.id).sessions.find((item) => item.id === row?.dataset.sessionId) : null;
      if (text === "cancel" && row && status) {
        row.classList.add("cancelled");
        status.textContent = "Cancelled";
        if (session) {
          session.status = "Cancelled";
          save();
        }
        showPortalPanel(portal, "Session cancelled", `${row.dataset.tutor} · ${row.dataset.subject} on ${row.dataset.date}`);
        portalToast("Session cancelled.");
      } else if (text === "reschedule" && status) {
        status.textContent = "Reschedule requested";
        if (session) {
          session.status = "Reschedule requested";
          save();
        }
        showPortalPanel(portal, "Reschedule requested", `${row.dataset.tutor} will receive your request for ${row.dataset.date}.`);
        portalToast("Reschedule request sent.");
      } else {
        showPortalPanel(portal, "Session details", `${row?.dataset.tutor || "Tutor"} · ${row?.dataset.subject || "Subject"} · ${row?.dataset.date || "Date"}`);
        portalToast("Session details opened.");
      }
      return true;
    }
    const reviewFilter = event.target.closest(".review-filters button");
    if (reviewFilter) {
      event.preventDefault();
      const group = reviewFilter.closest(".review-filters");
      group.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
      reviewFilter.classList.add("active");
      portalToast(`${reviewFilter.textContent.trim()} applied.`);
      return true;
    }
    const toggle = event.target.closest(".toggle");
    if (toggle) {
      event.preventDefault();
      toggle.classList.toggle("off");
      portalToast(toggle.classList.contains("off") ? "Notification turned off." : "Notification turned on.");
      return true;
    }
    const settingsAction = event.target.closest(".settings-grid button, .settings-grid article:nth-child(4) p");
    if (settingsAction) {
      event.preventDefault();
      portalToast(`${settingsAction.textContent.trim()} opened.`);
      return true;
    }
    const helpButton = event.target.closest(".help-grid button");
    if (helpButton) {
      event.preventDefault();
      if (helpButton.textContent.includes("Live Chat")) navigate("#/student/messages");
      else portalToast("Support message sent.");
      return true;
    }
    const article = event.target.closest(".kb-grid div");
    if (article) {
      event.preventDefault();
      portalToast(`${article.childNodes[0].textContent.trim()} article opened.`);
      return true;
    }
    const pagination = event.target.closest(".portal-pagination button, .portal-pagination span");
    if (pagination && !pagination.textContent.includes("Showing")) {
      event.preventDefault();
      const pager = pagination.closest(".portal-pagination");
      const current = Number(pager?.dataset.page || 1);
      const filteredCount = [...portal.querySelectorAll(".portal-tutor-card")].filter((card) => card.dataset.filtered !== "false").length;
      const maxPage = Math.max(1, Math.ceil(filteredCount / 6));
      let nextPage = current;
      if (pagination.dataset.pageAction === "prev") nextPage = Math.max(1, current - 1);
      else if (pagination.dataset.pageAction === "next") nextPage = Math.min(maxPage, current + 1);
      else nextPage = Number(pagination.textContent.trim()) || current;
      if (pager) pager.dataset.page = String(nextPage);
      const input = portal.querySelector(".portal-filter input");
      if (input) filterPortalTutors(input);
      portalToast(`Page ${nextPage} selected.`);
      return true;
    }
    return false;
  }

  function handleTutorHubClick(event) {
    const hub = event.target.closest(".tutorhub-dashboard");
    if (!hub) return false;
    const chatPerson = event.target.closest(".tutor-messages aside > div");
    if (chatPerson) {
      event.preventDefault();
      switchPortalConversation(chatPerson);
      return true;
    }
    const chatSend = event.target.closest(".tutor-messages footer button");
    if (chatSend) {
      event.preventDefault();
      sendPortalMessage(chatSend);
      return true;
    }
    const scheduleButton = event.target.closest(".tutor-schedule-row button");
    if (scheduleButton) {
      event.preventDefault();
      const row = scheduleButton.closest(".tutor-schedule-row");
      const status = row?.querySelector(":scope > span");
      const text = scheduleButton.textContent.trim();
      if (text === "Mark Complete" && status) {
        row.classList.add("completed");
        status.textContent = "Completed";
        portalToast("Lesson marked complete.");
      } else if (text === "Reschedule" && status) {
        status.textContent = "Reschedule requested";
        portalToast("Reschedule request sent.");
      } else {
        portalToast("Lesson details opened.");
      }
      return true;
    }
    const softAction = event.target.closest(".tutor-soft-action");
    if (softAction) {
      event.preventDefault();
      portalToast(`${softAction.textContent.trim()} opened.`);
      return true;
    }
    const tableAction = event.target.closest(".tutor-earnings-grid .portal-table td");
    if (tableAction) {
      event.preventDefault();
      portalToast("Payment record opened.");
      return true;
    }
    const settingsAction = event.target.closest(".tutor-settings button, .tutor-settings article:nth-child(4) p");
    if (settingsAction) {
      event.preventDefault();
      portalToast(`${settingsAction.textContent.trim()} opened.`);
      return true;
    }
    return false;
  }

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.placeholder.includes("Search tutors") || input.placeholder.includes("Tìm theo tên gia sư")) filterPortalTutors(input);
    if (input.placeholder.includes("Search conversations") || input.placeholder.includes("Tìm cuộc trò chuyện")) filterPortalConversations(input);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.closest(".portal-chat footer, .tutor-messages footer")) {
      event.preventDefault();
      const button = input.closest("footer")?.querySelector("button");
      if (button) sendPortalMessage(button);
    }
  });

  document.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    if (select.closest("[data-tutor-filters]")) {
      const portal = select.closest(".student-portal");
      const pager = portal?.querySelector(".portal-pagination");
      if (pager) pager.dataset.page = "1";
      const input = select.closest("[data-tutor-filters]")?.querySelector("input");
      if (input) filterPortalTutors(input);
    }
    if (select.closest("[data-payment-filters]")) filterPayments(select);
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target && event.target.closest(".student-row-menu")) {
      portalToast("More options opened.");
      return;
    }
    if (!target && handlePortalClick(event)) return;
    if (!target && handleTutorHubClick(event)) return;
    if (!target) return;
    const action = target.dataset.action;

    if (action === "logout") {
      state.currentUserId = null;
      save();
      navigate("#/");
    }

    if (action === "start-chat") {
      const item = ensureCase(target.dataset.requestId, target.dataset.tutorId);
      navigate(`#/case/${item.id}/chat`);
    }

    if (action === "tutor-claim") {
      const user = currentUser();
      const item = ensureCase(target.dataset.requestId, user.id);
      navigate(`#/case/${item.id}/chat`);
    }

    if (action === "hub-request") {
      const user = currentUser();
      if (!user || user.role !== "tutor") return;
      const data = tutorDashboardFor(user.id);
      const request = data.pendingRequests.find((item) => item.id === target.dataset.requestId);
      if (!request) return;
      request.status = target.dataset.status;
      data.stats.pendingRequests = Math.max(0, Number(data.stats.pendingRequests || 0) - 1);
      if (target.dataset.status === "accepted") {
        data.stats.totalStudents += 1;
        data.stats.monthlyEarnings += Number(request.rate || 0);
        data.upcomingLessons.unshift({
          id: uid("tdl"),
          month: "JUN",
          day: "28",
          weekday: "SUN",
          studentName: request.studentName,
          subject: request.subject,
          level: request.level,
          time: "4:00 PM - 5:00 PM",
          format: "Online"
        });
      }
      save();
      render();
    }

    if (action === "student-request-action") {
      const user = currentUser();
      if (!user || user.role !== "student") return;
      const data = studentDashboardFor(user.id);
      const request = data.requests.find((item) => item.id === target.dataset.requestId);
      if (!request) return;
      if (request.action === "View Details") {
        navigate(`#/student/tutor/${target.dataset.tutorId || request.tutorId || "u_tutor_sophia"}?request=r_seed`);
        return;
      }
      if (request.action === "Message") {
        navigate("#/student/messages");
        return;
      }
      if (request.action === "View Lessons") {
        navigate("#/student/sessions");
        return;
      }
      save();
    }

    if (action === "approve-tutor") {
      const profile = profileOf(target.dataset.userId);
      profile.verificationStatus = "approved";
      profile.rejectionReason = "";
      save();
      render();
    }

    if (action === "prepare-payment") {
      const item = caseOf(target.dataset.caseId);
      if (!item || currentUser()?.id !== studentIdForCase(item)) return;
      setCaseStatus(item.id, "awaiting_payment");
      navigate(`#/case/${item.id}/payment`);
    }

    if (action === "pay-case") {
      const item = caseOf(target.dataset.caseId);
      if (!item || currentUser()?.id !== studentIdForCase(item)) return;
      const letter = state.confirmationLetters.find((entry) => entry.caseId === item.id);
      if (!letter) return;
      if (item.status === "confirmed") setCaseStatus(item.id, "awaiting_payment");
      state.payments.push({ id: uid("p"), caseId: item.id, payerId: currentUser().id, amount: connectionFee(letter), type: "connection_fee", status: "paid", createdAt: now() });
      setCaseStatus(item.id, "paid");
      navigate(`#/case/${item.id}/active`);
    }

    if (action === "await-payment") {
      const item = caseOf(target.dataset.caseId);
      if (!item || !canAccessCase(currentUser(), item)) return;
      setCaseStatus(item.id, "awaiting_payment");
      render();
    }

    if (action === "activate-case") {
      const item = caseOf(target.dataset.caseId);
      if (!item || !canAccessCase(currentUser(), item)) return;
      setCaseStatus(item.id, "active");
      render();
    }

    if (action === "complete-case") {
      const item = caseOf(target.dataset.caseId);
      if (!item || !canAccessCase(currentUser(), item)) return;
      setCaseStatus(item.id, "completed");
      navigate(`#/case/${item.id}/review`);
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const values = formValues(form);
    const type = form.dataset.form;

    if (type === "login") {
      const user = state.users.find((entry) => entry.email === values.email && entry.password === values.password);
      if (!user) {
        alert("Sai email hoặc mật khẩu.");
        return;
      }
      state.currentUserId = user.id;
      save();
      navigate(user.role === "admin" ? "#/admin" : `#/${user.role}`);
    }

    if (type === "register") {
      if (state.users.some((entry) => entry.email === values.email)) {
        alert("Email đã tồn tại.");
        return;
      }
      const user = {
        id: uid("u"),
        name: values.role === "tutor" ? "Alex" : values.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        email: values.email,
        password: values.password,
        role: values.role,
        studentKind: values.role === "student" ? values.studentKind || "parent" : "",
        phone: values.phone,
        address: "Chưa cập nhật",
        avatarUrl: values.role === "tutor" ? "assets/tutor-alex.png" : "",
        createdAt: now()
      };
      state.users.push(user);
      if (user.role === "tutor") {
        state.tutorDashboardData ||= {};
        state.tutorDashboardData[user.id] = structuredClone(seed.tutorDashboardData.u_tutor);
      } else {
        state.studentDashboardData ||= {};
        state.studentDashboardData[user.id] = structuredClone(seed.studentDashboardData.u_student);
      }
      state.currentUserId = user.id;
      save();
      navigate(user.role === "tutor" ? "#/tutor" : "#/student");
    }

    if (type === "request") {
      const request = {
        id: uid("r"),
        studentId: currentUser().id,
        subjects: values.subjects,
        grade: values.grade,
        region: values.region,
        format: values.format,
        schedule: values.schedule,
        budgetMin: Number(values.budgetMin),
        budgetMax: Number(values.budgetMax),
        studentsCount: Number(values.studentsCount),
        note: values.note || "",
        status: "open",
        createdAt: now()
      };
      state.requests.push(request);
      save();
      navigate(`#/student/request/${request.id}/matches`);
    }

    if (type === "tutor-profile") {
      const user = currentUser();
      let profile = profileOf(user.id);
      const files = [...(form.querySelector("[name='credentials']").files || [])].map((file) => file.name);
      const existingFiles = profile?.credentialFiles || [];
      if (Number(values.age) < 16) {
        alert("Gia sư cần đủ 16 tuổi để nộp hồ sơ.");
        return;
      }
      if (values.educationLevel === "below_grade_10") {
        alert("Học vấn tối thiểu cần tương đương lớp 10.");
        return;
      }
      if (!files.length && !existingFiles.length) {
        alert("Vui lòng upload ít nhất 1 bằng cấp/minh chứng.");
        return;
      }
      if (!profile) {
        profile = { userId: user.id, ratingAvg: 0, rejectionReason: "", credentialFiles: [] };
        state.tutorProfiles.push(profile);
      }
      Object.assign(profile, {
        subjects: values.subjects,
        regions: values.regions,
        format: values.format,
        hourlyRate: Number(values.hourlyRate),
        age: Number(values.age),
        educationLevel: values.educationLevel,
        availability: values.availability,
        bio: values.bio,
        credentialFiles: files.length ? files : profile.credentialFiles,
        verificationStatus: "pending_review",
        rejectionReason: ""
      });
      save();
      navigate("#/tutor");
    }

    if (type === "message") {
      const item = caseOf(form.dataset.caseId);
      if (!canAccessCase(currentUser(), item)) return;
      state.messages.push({ id: uid("m"), caseId: item.id, senderId: currentUser().id, content: values.content, createdAt: now() });
      if (item.status === "pending") setCaseStatus(item.id, "negotiating");
      save();
      render();
    }

    if (type === "confirmation") {
      const item = caseOf(form.dataset.caseId);
      if (!canAccessCase(currentUser(), item)) return;
      let letter = state.confirmationLetters.find((entry) => entry.caseId === form.dataset.caseId);
      if (!letter) {
        letter = { id: uid("cl"), caseId: form.dataset.caseId, createdAt: now() };
        state.confirmationLetters.push(letter);
      }
      Object.assign(letter, {
        lessonsCount: Number(values.lessonsCount),
        schedule: values.schedule,
        fee: Number(values.fee),
        format: values.format,
        note: values.note || ""
      });
      item.status = "confirmed";
      save();
      navigate(`#/case/${form.dataset.caseId}/chat`);
    }

    if (type === "cancel-case") {
      const item = caseOf(form.dataset.caseId);
      if (!canAccessCase(currentUser(), item)) return;
      setCaseStatus(item.id, "cancelled", { reason: values.reason, by: currentUser().id });
      render();
    }

    if (type === "review") {
      const item = caseOf(form.dataset.caseId);
      if (!canAccessCase(currentUser(), item)) return;
      state.reviews.push({
        id: uid("rv"),
        caseId: form.dataset.caseId,
        reviewerId: currentUser().id,
        revieweeId: form.dataset.revieweeId,
        rating: Number(values.rating),
        comment: values.comment,
        createdAt: now()
      });
      const tutorProfile = profileOf(form.dataset.revieweeId);
      if (tutorProfile) {
        const tutorReviews = state.reviews.filter((review) => review.revieweeId === form.dataset.revieweeId);
        tutorProfile.ratingAvg = Math.round((tutorReviews.reduce((sum, review) => sum + review.rating, 0) / tutorReviews.length) * 10) / 10;
      }
      save();
      navigate(`#/${currentUser().role}/history`);
    }

    if (type === "student-profile") {
      Object.assign(currentUser(), { name: values.name, studentKind: values.studentKind, phone: values.phone, address: values.address });
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

    if (type === "open-filter") {
      navigate(`#/tutor/open-cases?subject=${encodeURIComponent(values.subject || "")}&region=${encodeURIComponent(values.region || "")}`);
    }

    if (type === "history-filter") {
      navigate(`#/${form.dataset.role}/history?status=${encodeURIComponent(values.status || "")}`);
    }
  });

  window.addEventListener("hashchange", render);
  render();
})();
