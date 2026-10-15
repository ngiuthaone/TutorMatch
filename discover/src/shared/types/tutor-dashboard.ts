export interface TutorDashboardRating {
  count: number;
  average: number | null;
}

export interface TutorProfile {
  id: string;
  displayName: string;
  headline: string | null;
  publicationStatus: string;
  verificationStatus: string;
  hourlyRateVnd: number | null;
  avatarObjectPath: string | null;
}

export interface TutorDashboardSummary {
  tutorProfile: TutorProfile;
  todayCount: number;
  upcomingCount: number;
  monthEarningsVnd: number;
  monthCompletedCount: number;
  rating: TutorDashboardRating;
  pendingBookingsCount: number;
}

export interface TutorDashboardResult {
  isTutor: boolean;
  dashboard: TutorDashboardSummary | null;
}

export interface TutorEarningsSummary {
  total: number;
  thisMonth: number;
  pending: number;
  lastPayout: number;
  payoutStatus: "pending" | "processing" | "completed" | "failed";
}

export interface TutorListing {
  id: string;
  title: string;
  type: "course" | "workshop" | "tutoring" | "community";
  status: "draft" | "published" | "archived" | "pending_review";
  location: string;
  rating: number | null;
  bookings: number;
  grossEarnings: number;
  imageUrl: string | null;
}

export interface TutorSession {
  id: string;
  title: string;
  date: string;
  time: string;
  learner: {
    id: string;
    displayName: string;
    avatarObjectPath: string | null;
  };
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  earnings: number;
  type: "course" | "workshop" | "tutoring" | "community";
  location: string;
}

export interface TutorAnalytics {
  sessionsCount: number;
  rating: number | null;
  retentionRate: number;
  conversionRate: number;
  revenueTrend: Array<{
    period: string;
    amount: number;
  }>;
  sessionHealth: Array<{
    date: string;
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }>;
}
