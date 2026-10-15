/**
 * Tutoria Center — Standalone UI/UX Reference (v0.9)
 * ──────────────────────────────────────────────────
 * Self-contained TypeScript spec for the tutor dashboard conversion.
 *
 * This is a reference artifact only — it captures every design token,
 * data shape, navigation entry, component contract, and page-level payload
 * that appears in center-uxui-reference.html. It has NO runtime dependency
 * on the host project: no framework imports, no aliases, no JSX.
 *
 * Consumers should copy the types/constants they need into the real
 * codebase and adjust import paths to match local conventions.
 */

// 1. DESIGN TOKENS

/** Color palette extracted from the `:root` CSS vars and literal hex
 *  values in the reference HTML. Grouped by role. */
export const Colors = {
  // neutrals
  ink: "#171717", dark: "#111", muted: "#747474", line: "#e7e7e7", bg: "#f5f5f5",
  panel: "#fff", border: "#dedede", borderAlt: "#e4e4e4", borderMuted: "#e5e5e5",
  borderLight: "#eee", borderStrong: "#cfcfcf", bgAlt: "#fafafa", bgMuted: "#f7f7f7",
  bgField: "#fcfcfc", bgAccent: "#fffaf1", bgCard: "#f8f8f8", bgChart: "#2c2c2c",
  // text
  textPrimary: "#171717", textSecondary: "#555", textMuted: "#7b7b7b", textDim: "#747474",
  textHint: "#888", textSubtle: "#999", textOnDark: "#fff", placeholder: "#aaa",
  // status / semantic
  ok: "#247356", okBg: "#edf7f2", warn: "#966014", warnBg: "#fff5e7",
  warnBorder: "#f0d9ad", warnText: "#7a6a50", danger: "#b72b3a", dangerBg: "#fff0f1",
  dangerText: "#b52231", dangerBorder: "#efc8cd", neutral: "#555", neutralBg: "#f0f0f0",
  // brand
  brand: "#191919", brandHover: "#2a2a2a", brandText: "#fff",
  // data viz
  progressFill: "#242424", trendUp: "#247356", trendDown: "#b72b3a", notificationDot: "#ff4f65",
  // overlays
  overlay: "rgba(0,0,0,.35)", overlayDark: "rgba(0,0,0,.4)", overlayLight: "rgba(0,0,0,.04)",
} as const;
export type ColorKey = keyof typeof Colors;

/** Spacing on a 4px grid (px values). */
export const Spacing = {
  xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xl2: 20, xl3: 24, xl4: 32, xl5: 40, xl6: 48,
} as const;
export type SpacingKey = keyof typeof Spacing;

/** Typography scale — reference HTML remaps Tailwind size utilities to px. */
export const Typography = {
  fontSans: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  basePx: 13, lineHeight: 1.45,
  sizes: {
    micro: { px: 9, rem: 0.75 }, tiny: { px: 10, rem: 0.625 }, small: { px: 11, rem: 0.6875 },
    body: { px: 12, rem: 0.75 }, base: { px: 13, rem: 0.8125 }, medium: { px: 14, rem: 0.875 },
    large: { px: 15, rem: 0.9375 }, xl: { px: 16, rem: 1 }, heading: { px: 20, rem: 1.25 },
    subheading: { px: 13, rem: 0.8125 },
  },
  weights: { regular: 400, medium: 500, semibold: 600, bold: 650, extrabold: 700 },
} as const;

/** Shadow / elevation tokens. */
export const Shadows = {
  panel: "0 1px 2px rgba(0,0,0,.04)", float: "0 14px 40px rgba(0,0,0,.16)",
  insetLeft: "inset 2px 0 0 #171717",
} as const;

/** Z-index stack (header → sidebar → overlay → drawers → modal → toast). */
export const ZIndex = { header: 50, sidebar: 40, sidebarBackdrop: 30, overlay: 60, drawer: 65, notificationPanel: 75, modal: 80, toast: 100 } as const;

/** Breakpoints inferred from the reference CSS media queries. */
export const Breakpoints = { sm: 640, md: 1024, lg: 1280 } as const;

/** Border radius constants (px). */
export const BorderRadius = { sm: 4, md: 6, lg: 8, xl: 10, full: 999 } as const;

// 2. ENUMS & UNION TYPES
export type ListingType = "tutor" | "workshop" | "class" | "event" | "course" | "photobooth";
export interface ListingTypeMeta { label: string; badge: string; }
export const LISTING_TYPE_META: Record<ListingType, ListingTypeMeta> = {
  tutor: { label: "Tutor", badge: "1:1" }, workshop: { label: "Workshop", badge: "WS" },
  class: { label: "Class", badge: "CLS" }, event: { label: "Event", badge: "EVT" },
  course: { label: "Course", badge: "CRS" }, photobooth: { label: "Photobooth", badge: "PB" },
};
export type ListingStatus = "published" | "draft" | "action_needed" | "archived" | "scheduled";
export type BookingStage = "requests" | "awaiting" | "upcoming" | "past" | "cancelled";
export type PaymentState = "not_ready" | "required" | "paid" | "refunded" | "succeeded" | "failed";
export type BackendStatus = "requested" | "accepted" | "confirmed" | "completed" | "cancelled" | "rejected" | "refunded";
export type SessionStatus = "open" | "confirmed" | "booked" | "below_min" | "request" | "cancelled" | "paused";
export type PillVariant = "ok" | "warn" | "bad" | "neutral";
export type TabVariant = "subtab" | "nav-row" | "nav-sub";
export type BookingMode = "workspace" | "operations";
export type AcademyCategory = "Operations" | "Growth" | "Quality" | "Finance" | "Partners" | "Policy";
export type RoleName = "Owner" | "Administrator" | "Operations manager" | "Listing manager" | "Marketing" | "Customer support" | "Finance" | "Analyst";
export type QualityMetricKey = "rating" | "responseRate" | "cancellationRate" | "sessionCompletion" | "refundRate";
export type PromotionType = "discount" | "last_minute" | "bundle";
export type CampaignType = "platform" | "promotion";
export type TransactionStatus = "paid" | "pending" | "refunded" | "authorized" | "failed";
export type PayoutStatus = "scheduled" | "paid" | "failed" | "cancelled";
export const BOOKING_STAGE_COPY: Record<BookingStage, { empty: string; help: string }> = {
  requests: { empty: "Nothing needs approval", help: "Booking requests that require host approval will appear here." },
  awaiting: { empty: "Nothing awaiting payment", help: "Accepted requests stay here until the learner completes payment." },
  upcoming: { empty: "No upcoming or active bookings", help: "Confirmed sessions, event tickets and active course enrollments will appear here." },
  past: { empty: "No completed bookings", help: "Completed sessions, attended experiences and finished courses will appear here." },
  cancelled: { empty: "No closed bookings", help: "Rejected, cancelled and refunded bookings will appear here for reference." },
};

// 3. CORE DATA SHAPES
export interface TutorIdentity {
  id: string; name: string; role: string; location: string;
  avatarUrl?: string; initials: string;
  accountType: "individual" | "studio"; email?: string; phone?: string;
}
export interface Learner {
  id: string; name: string; avatarUrl?: string; initials: string;
  since: string; type: "repeat" | "first_time"; bookings: number;
  lifetimeValueVnd: number; lifetimeValueFormatted: string;
  lastBooking: string; upcoming: string;
  messageStatus: "ok" | "unread" | "neutral"; privateNote?: string;
}
export interface Listing {
  id: string; key: string; title: string; label: string;
  type: ListingType; status: ListingStatus; image: string; location: string;
  durationLabel?: string; rating: number | null; ratingCount: number;
  bookings: number; grossVnd: number; grossFormatted: string;
  availabilitySummary: string; conversion?: string | null;
  draftProgress?: number; sessionsPaused?: boolean;
  reviews?: ListingReviewSummary;
}
export interface ListingReviewSummary {
  rating: number; reviewCount: number;
  mentions: Array<{ label: string; count: number }>;
}
export interface Booking {
  id: string; type: ListingType; stage: BookingStage;
  backendStatus: BackendStatus; hostAccepted: boolean;
  paymentState: PaymentState; paymentStatus?: "succeeded" | "not_captured" | "failed";
  learner: string; offering: string; date: string; time: string | null;
  format: string; duration: number | null; participants: number; price: number;
  received: string; note?: string; approval: "host" | "auto" | "platform";
  new?: boolean; capacity?: string; access?: string; progress?: string;
  version?: number; canAccept?: boolean; canReject?: boolean; canTutorCancel?: boolean;
  cancelledBySessionId?: string;
  cancellation?: { actor: "host" | "attendee" | "system"; cancelledBySessionId?: string };
  refund?: { status: "processing" | "refunded" | "succeeded" | "needs_attention" | null; amountVnd?: number; refundedAmountVnd?: number };
}
export interface SessionSlot {
  id: string; listingId: string; listingTitle: string; type: ListingType;
  date: string; time: string; location: string;
  booked: number; max: number; minimum?: number;
  status: SessionStatus; isBelowMin: boolean; staff: string;
}
export interface BookingFunnelStep {
  label: string; value: number | string; percentage?: string; width: number;
}
export interface TrafficSource { label: string; percentage: number; width: number; }
export interface ListingAnalyticsRow {
  title: string; visitors: number; bookings: number; conversion: string;
  gross: string; trend: string; trendDirection: "up" | "down";
}
export interface AnalyticsOverview {
  impressions: number; listingVisits: number; availabilityViews: number;
  checkoutStarts: number; bookings: number;
  bookingFunnel: BookingFunnelStep[]; trafficSource: TrafficSource[];
  topListings: ListingAnalyticsRow[];
}
export interface EarningsSummary {
  availableBalanceVnd: number; availableBalanceFormatted: string;
  nextPayoutVnd: number; nextPayoutFormatted: string; nextPayoutDate: string;
  pendingSettlementVnd: number; pendingSettlementFormatted: string;
  pendingSettlementBookings: number;
  grossBookingsVnd: number; grossBookingsFormatted: string;
  refundsVnd: number; refundsFormatted: string;
  tutoriaFeeVnd: number; tutoriaFeeFormatted: string;
  partnerCommissionVnd: number; partnerCommissionFormatted: string;
  netEarningsVnd: number; netEarningsFormatted: string;
  settlementStatus: Array<{ label: string; valueFormatted: string; width: number }>;
}
export interface Transaction {
  id: string; date: string; time: string; bookingId: string;
  grossFormatted: string; feesFormatted: string; netFormatted: string;
  status: TransactionStatus; statusPill: { variant: PillVariant; label: string };
}
export interface Payout {
  id: string; period: string; amountFormatted: string;
  bank: string; accountMasked: string; status: PayoutStatus;
  statusPill: { variant: PillVariant; label: string }; bookingsCount: number;
}
export interface BankAccount {
  id: string; bankName: string; accountMasked: string;
  accountHolder: string; isPrimary: boolean;
}
export interface TaxInfo { id: string; name: string; taxCode: string; }
export interface QualityMetric {
  key: QualityMetricKey; label: string; performance: string; target: string;
  status: { variant: PillVariant; label: string };
}
export interface QualityAction {
  id: string; text: string; detail: string;
  status: { variant: PillVariant; label: string };
  ctaLabel: string; ctaVariant: "dark" | "default";
}
export interface Incident {
  id: string; title: string; date: string;
  impact: { variant: PillVariant; label: string }; actionLabel: string;
}
export interface Promotion {
  id: string; name: string; listingId: string; listingTitle: string;
  uses: number; bookings: number; status: { variant: PillVariant; label: string };
}
export interface Campaign {
  id: string; type: CampaignType; title: string; description: string;
  eligibleListings: number; isJoined: boolean;
}
export interface PromoCode {
  id: string; code: string; offer: string; uses: number; usageLimit: number;
  expires: string; status: { variant: PillVariant; label: string };
}
export interface Partner {
  id: string; name: string; category: string;
  audience: number; conversion: string; gmvFormatted: string;
}
export interface PartnerMetrics {
  gmvFormatted: string; gmvTrend: string; attributionBookings: number;
  commissionOwedFormatted: string; activePartners: number;
}
export interface CollaborationTerms {
  listingId: string; listingTitle: string;
  bookingPriceFormatted: string; commissionRate: string;
  partnerEarnFormatted: string;
}
export interface DemandInsight {
  id: string;
  category: "High demand" | "Improve conversion" | "Fill capacity" | "New category";
  title: string; description: string;
  metrics: Array<{ label: string; value: string }>;
  ctaLabel: string; ctaVariant: "dark" | "default";
  ctaPage?: string; ctaListing?: string; ctaAction?: string;
}
export interface DemandExplorerRow {
  id: string; searchDemand: string; change: string;
  supply: "Low" | "Medium" | "High"; hasCoverage: boolean;
  ctaLabel: string; ctaTarget: { type: "page" | "listing" | "action"; value: string };
}
export interface AcademyModule {
  id: string; category: AcademyCategory; durationMinutes: number;
  title: string; description: string;
  status: "completed" | "in_progress" | "locked";
  ctaLabel: string; ctaVariant: "dark" | "outline" | "default";
}
export interface Branch {
  id: string; name: string; city: string; status: "active" | "inactive";
  listings: number; staff: number;
}
export interface TeamMember {
  id: string; name: string; email: string; role: RoleName;
  scope: string; status: { variant: PillVariant; label: string };
}
export interface PermissionRow {
  role: string; bookings: string; listings: string; marketing: string;
  analytics: string; earnings: string; team: string;
}

// 4. COMPONENT PROP INTERFACES
export interface PillProps {
  variant: PillVariant; label: string; icon?: string; truncate?: boolean;
}
export interface MetricCardProps {
  label: string; value: string | number; sublabel?: string;
  trend?: "up" | "down" | "neutral";
  cta?: { label: string; variant?: "dark" | "default"; onClick?: string };
  variant?: "default" | "inline"; minHeight?: boolean;
}
export interface PanelProps {
  title?: string; subtitle?: string;
  actions?: Array<{ label: string; icon?: string; variant?: "dark" | "default"; dataAction?: string }>;
  subTabs?: Array<{ id: string; label: string; count?: string; active?: boolean; dataAttr?: Record<string, string> }>;
  overflowX?: boolean; children?: unknown;
}
export interface ProgressBarProps {
  width: number; label?: string; rightContent?: string;
  variant?: "default" | "track"; color?: "default" | "ok" | "warn" | "danger";
}
export interface TableCell {
  content: string | number;
  pill?: { variant: PillVariant; label: string };
  progress?: { width: number; label: string };
  trend?: { value: string; direction: "up" | "down" };
  action?: { label: string; variant?: "dark" | "default"; onClick?: string };
  className?: string; align?: "left" | "right" | "center";
  checkbox?: boolean; checked?: boolean;
}
export interface TableRow {
  id: string; cells: TableCell[];
  data?: Record<string, string>; status?: string; selected?: boolean;
}
export interface DenseTableProps {
  columns: Array<{ label: string; align?: "left" | "right" | "center"; isCheckbox?: boolean }>;
  rows: TableRow[]; minWidth?: string;
  enableSelection?: boolean; hover?: boolean;
}
export interface NavRowProps {
  id: string; icon?: string; label: string; page?: string; action?: string;
  badge?: { count: number; variant: "danger" | "default" };
  children?: NavNode[]; defaultOpen?: boolean; active?: boolean;
  section?: string;
}
export interface NavNode {
  id: string; icon?: string; label: string; page?: string; action?: string;
  badge?: { countKey: string; variant: "danger" | "default" };
  children?: NavNode[]; defaultOpen?: boolean; section?: string; active?: boolean;
}
export interface NavSubProps {
  id: string; label: string; page: string; target?: string;
  active?: boolean; badge?: { count: number; variant: "danger" };
}
export interface InputProps {
  label?: string; placeholder?: string; value?: string;
  type?: "text" | "email" | "tel" | "password" | "date" | "time" | "number";
  labelPosition?: "above" | "inline"; width?: string; compact?: boolean;
}
export interface ButtonProps {
  label: string; variant?: "default" | "dark" | "danger" | "outline";
  size?: "sm" | "md" | "lg"; icon?: string; dataAction?: string;
  dataPage?: string; dataId?: string; minWidth?: string;
}
export interface ChartBarProps { day: string; heightPct: number; value: number; formatted: string; }
export interface CalendarCellProps {
  day: number; isCurrentMonth: boolean;
  sessions: Array<{
    id: string; time: string; listing: string; booked: string;
    status: SessionStatus; backgroundColor?: string; textColor?: string;
  }>;
}
export interface AvatarProps {
  initials: string; size?: number; backgroundColor?: string;
  textColor?: string; fontSizePx?: number;
}
export interface DrawerProps {
  id: string; title: string; subtitle?: string;
  width?: { base: string; md?: string; xl?: string }; closable?: boolean;
}
export interface ModalProps {
  id: string; eyebrow: string; title: string; body: string;
  actions?: { primary: { label: string; variant?: "dark" | "default" }; secondary: { label: string; variant?: "default" } };
}
export interface BookingDecisionDialogProps {
  eyebrow: string; title: string; body: string;
  confirmLabel: string; confirmVariant: "dark" | "danger"; cancelLabel: string;
}
export interface ListingDrawerProps {
  listingId: string; title: string;
  tabs: Array<{ id: string; label: string; active?: boolean }>;
  activeTab: string;
}
export interface AcademyCardProps {
  category: AcademyCategory; durationMinutes: number; title: string;
  description: string; status: "completed" | "in_progress" | "locked";
  ctaLabel: string; ctaVariant: "dark" | "outline" | "default";
}
export interface OpportunityCardProps {
  category: "High demand" | "Improve conversion" | "Fill capacity" | "New category";
  title: string; description: string;
  metrics: Array<{ label: string; value: string }>;
  ctaLabel: string; ctaVariant: "dark" | "default";
  ctaTarget: { page?: string; listing?: string; action?: string };
}
export interface CampaignCardProps {
  type: CampaignType; title: string; description: string;
  eligibleListings: number; isJoined: boolean;
}
export interface SettingsTabProps { id: string; label: string; active: boolean; }
export interface SettingToggleProps { label: string; enabled: boolean; }

// 5. PAGE DATA SHAPES
export interface HomePageData {
  lastUpdated: string; dateRange: string;
  metrics: Array<{ id: string; label: string; value: string; trend: string; trendDirection: "up" | "down"; href: string; isExternalLink: boolean }>;
  toDos: Array<{ id: string; label: string; value: string; urgency?: string; page?: string; action?: string }>;
  promotionBanner: { eyebrow: string; title: string; description: string;
    primary: { label: string; page: string }; secondary: { label: string; page: string } };
  performanceChart: { title: string; subtitle: string; ctaLabel: string; ctaPage: string; bars: ChartBarProps[] };
  upcoming: { title: string; subtitle: string; ctaLabel: string; ctaPage: string; items: UpcomingItem[] };
  sessionHealth: { title: string; subtitle: string; ctaLabel: string; ctaPage: string; rows: SessionHealthRow[] };
  notifications: Notification[];
}
export interface UpcomingItem {
  id: string; time: string; listingBadge: string; listingType: ListingType;
  title: string; subtitle: string; ctaLabel: string;
  ctaPage?: string; ctaAction?: string; ctaListing?: string;
}
export interface SessionHealthRow {
  id: string; listingTitle: string; date: string; booked: string; bookedWidth: number;
  capacity: string; gross: string; status: { variant: PillVariant; label: string };
  ctaLabel: string; ctaVariant?: "dark" | "default"; ctaPage?: string; ctaAction?: string; ctaListing?: string;
}
export interface BookingsPageData {
  mode: BookingMode;
  typeFilterActive: ListingType | "all";
  activeStage: BookingStage;
  searchTerm: string;
  bookings: Booking[];
  stageCounts: Record<BookingStage, number>;
  navCounts: { requests: number; awaiting: number };
}
export interface ListingsPageData {
  statusFilter: "all" | ListingStatus;
  statusCounts: Record<string, number>;
  searchTerm: string;
  typeFilter: ListingType | "all";
  statusFilterSelect: ListingStatus | "all";
  listings: Listing[];
}
export interface CalendarPageData {
  monthLabel: string; monthIndex: number;
  listings: Array<{ id: string; label: string }>;
  staff: Array<{ id: string; label: string }>;
  locations: Array<{ id: string; label: string }>;
  viewType: "month" | "week";
  cells: CalendarCellProps[];
}
export interface LearnersPageData {
  metrics: Array<{ label: string; value: string | number }>;
  searchTerm: string;
  learnerType: "all" | "repeat" | "first_time";
  listingFilter: string;
  learners: Learner[];
}
export interface MarketingPageData {
  activeView: "promotions" | "campaigns" | "codes";
  promotionTypes: Array<{ type: string; title: string; description: string }>;
  activePromotions: Promotion[];
  campaigns: Campaign[];
  promoCodes: PromoCode[];
}
export interface PartnersPageData {
  metrics: PartnerMetrics;
  collaboration: CollaborationTerms;
  searchTerm: string;
  categoryFilter: string;
  partners: Partner[];
}
export interface AnalyticsPageData {
  dateRange: string;
  activeView: "overview" | "listings" | "traffic" | "learners" | "partners";
  overview: AnalyticsOverview;
}
export interface EarningsPageData {
  activeView: "overview" | "transactions" | "payouts" | "refunds" | "invoices" | "tax" | "bank";
  summary: EarningsSummary;
  transactions: Transaction[];
  payouts: Payout[];
  taxInfo: TaxInfo;
  bankAccount: BankAccount;
}
export interface QualityPageData {
  qualityScore: number; qualityScoreMax: number;
  qualityScoreLabel: string; qualityScoreDescription: string;
  metrics: QualityMetric[];
  actions: QualityAction[];
  incidents: Incident[];
}
export interface OpportunitiesPageData {
  insights: DemandInsight[];
  demandExplorer: DemandExplorerRow[];
}
export interface AcademyPageData {
  searchTerm: string;
  progress: { completed: number; total: number; percentage: number };
  modules: AcademyModule[];
}
export interface SettingsPageData {
  activeTab: "account" | "branches" | "team" | "holiday" | "communication" | "security" | "delegation";
  account: { displayName: string; accountType: "Individual host" | "Studio / organization"; email: string; phone: string };
  branches: Branch[];
  team: TeamMember[];
  permissionMatrix: PermissionRow[];
  communication: SettingToggleProps[];
  holidayEnabled: boolean;
  bankAccount: BankAccount;
  taxInfo: TaxInfo;
}
export interface Notification {
  id: string; type: string; title: string;
  subtitle: string; time: string; page?: string;
}

// 6. NAVIGATION CONFIG

/** Navigation tree mirroring the `<aside id="sidebar">` structure.
 *  Each node maps to a `.nav-row` / `.nav-parent` / `.nav-sub` button.
 *  Order matches the sidebar top-to-bottom. */
export const NAV_CONFIG: NavNode[] = [
  { id: "home", icon: "⌂", label: "Home", page: "home", active: true },
  {
    id: "bookings-group", icon: "▣", label: "Bookings", defaultOpen: true, children: [
      { id: "bookings-requests", icon: "→", label: "Requests", page: "bookings", badge: { countKey: "requests", variant: "default" }, active: true },
      { id: "bookings-awaiting", icon: "→", label: "Awaiting payment", page: "bookings", badge: { countKey: "awaiting", variant: "default" } },
      { id: "bookings-upcoming", icon: "→", label: "Upcoming", page: "bookings" },
      { id: "bookings-past", icon: "→", label: "Past", page: "bookings" },
      { id: "bookings-cancelled", icon: "→", label: "Closed", page: "bookings" },
      { id: "bookings-operations", icon: "→", label: "All business bookings", page: "bookings" },
    ],
  },
  {
    id: "listings-group", icon: "□", label: "Listings", defaultOpen: true, children: [
      { id: "listings-manage", icon: "→", label: "Manage listings", page: "listings" },
      { id: "listings-add", icon: "→", label: "Add listing", action: "addListing" },
      { id: "calendar-from-listings", icon: "→", label: "Availability & capacity", page: "calendar" },
    ],
  },
  { id: "calendar", icon: "◷", label: "Calendar", page: "calendar" },
  { id: "learners", icon: "☰", label: "Learners", page: "learners" },

  // Growth
  { id: "growth", icon: "", label: "", section: "Growth" },
  { id: "marketing", icon: "↗", label: "Marketing", defaultOpen: true, children: [
    { id: "marketing-promotions", label: "Promotions", page: "marketing" }, { id: "marketing-campaigns", label: "Campaign Center", page: "marketing" }, { id: "marketing-codes", label: "Promo codes", page: "marketing" } ] },
  { id: "partners", icon: "♢", label: "Partners / Affiliate", page: "partners" },
  { id: "opportunities", icon: "✦", label: "Opportunities", page: "opportunities", badge: { countKey: "opportunities", variant: "default" } },

  // Performance
  { id: "performance", icon: "", label: "", section: "Performance" },
  { id: "analytics", icon: "▥", label: "Analytics", page: "analytics" },
  {
    id: "earnings-group", icon: "₫", label: "Earnings", defaultOpen: true, children: [
      { id: "earnings-overview", icon: "→", label: "Overview", page: "earnings" },
      { id: "earnings-transactions", icon: "→", label: "Transactions", page: "earnings" },
      { id: "earnings-payouts", icon: "→", label: "Payouts", page: "earnings" },
    ],
  },
  { id: "quality", icon: "♡", label: "Quality & Trust", page: "quality" },

  // Host Center
  { id: "host-center", icon: "", label: "", section: "Host Center" },
  { id: "host-dashboard", icon: "◈", label: "Dashboard", page: "host-dashboard" },
  { id: "host-offerings", icon: "□", label: "Offerings", page: "host-offerings" },
  { id: "host-sessions", icon: "◷", label: "Sessions", page: "host-sessions" },
  { id: "host-attendees", icon: "☰", label: "Attendees", page: "host-attendees" },
  { id: "host-earnings", icon: "₫", label: "Earnings", page: "host-earnings" },
  { id: "host-analytics", icon: "▥", label: "Analytics", page: "host-analytics" },
  { id: "host-team", icon: "⊕", label: "Team", page: "host-team" },
  { id: "host-promocodes", icon: "%", label: "Promo Codes", page: "host-promocodes" },
  { id: "host-checkin", icon: "✓", label: "Check-in", page: "host-checkin" },
  { id: "host-payout-failures", icon: "⚠", label: "Payout failures", page: "host-payout-failures" },
  { id: "host-payout-statements", icon: "≡", label: "Payout statements", page: "host-payout-statements" },

  // Support
  { id: "support", icon: "", label: "", section: "Support" },
  { id: "academy", icon: "?", label: "Host Academy", page: "academy" },
  { id: "settings", icon: "⚙", label: "Settings", page: "settings" },
];

/** Header quick-navigation search results. */
export const SEARCH_RESULTS: Array<{ label: string; category: string; page: string }> = [
  { label: "Booking #T28484 · Interview Practice", category: "Bookings", page: "bookings" },
  { label: "Pizza-Making Workshop", category: "Listing", page: "listings" },
  { label: "Payout arriving 12 Aug", category: "Finance", page: "earnings" },
  { label: "How minimum-participant confirmation works", category: "Academy", page: "academy" },
];
export const HEADER_ACTIONS = {
  mobileMenu: "mobileMenu", globalSearch: "globalSearch",
  messageButton: "messageButton", notificationButton: "notificationButton",
  helpButton: "helpButton", profileButton: "profileButton",
} as const;
export const LISTING_DRAWER_TABS = ["overview","details","gallery","sessions","locations","pricing","bookings","reviews","marketing","analytics","settings"] as const;
export const EARNINGS_TABS = ["overview","transactions","payouts","refunds","invoices","tax","bank"] as const;
export const ANALYTICS_TABS = ["overview","listings","traffic","learners","partners"] as const;
export const SETTINGS_TABS = ["account","branches","team","holiday","communication","security","delegation"] as const;
export const MARKETING_TABS = ["promotions","campaigns","codes"] as const;
export const ROLES: RoleName[] = ["Administrator","Operations manager","Marketing","Finance"];
export const PROMOTION_TYPES = [
  { type: "First booking discount", title: "First booking discount", description: "Convert new learners with an introductory price." },
  { type: "Last-minute seats", title: "Last-minute seats", description: "Discount remaining workshop/class seats near start time." },
  { type: "Bundle sessions", title: "Bundle sessions", description: "Reward learners who book multiple tutor sessions." },
] as const;
export const MODAL_ACTIONS = ["addListing","addSession","blockTime","createPromotion","createCode","invitePartner","editCommission","inviteTeam","editPermissions","refund","reschedule","newBooking"] as const;

// 7. MOCK DATA (representative)
export const MOCK_BOOKINGS_COUNT: Record<BookingStage, number> = { requests: 3, awaiting: 2, upcoming: 2, past: 2, cancelled: 1 };
export const MOCK_NAV_COUNTS = { requests: 3, awaiting: 2, opportunities: 2 };
export const MOCK_BOOKING: Booking = {
  id: "T28484", type: "tutor", stage: "requests", backendStatus: "requested",
  hostAccepted: false, paymentState: "not_ready",
  learner: "Dang Nguyen", offering: "Interview Practice",
  date: "Mon, 17 Aug", time: "14:00-15:00", format: "Online",
  duration: 60, participants: 1, price: 300000, received: "8 minutes ago",
  note: "I want to practise concise interview answers and get direct feedback.",
  approval: "host", new: true, canAccept: true, canReject: true, version: 1,
};
export const MOCK_LISTING: Listing = {
  id: "pizza", key: "pizza", title: "Pizza-Making Workshop", label: "Pizza-Making Workshop", type: "workshop", status: "published",
  image: "/images/listing-pizza.png", location: "Hoan Kiem, 2.5h",
  rating: 4.9, ratingCount: 124, bookings: 124,
  grossVnd: 21800000, grossFormatted: "21.8m", availabilitySummary: "6 upcoming sessions",
  conversion: "8.2%",
  reviews: { rating: 4.9, reviewCount: 214,
    mentions: [{ label: "Fun atmosphere", count: 68 }, { label: "Beginner friendly", count: 52 }] },
};
export const MOCK_EARNINGS: EarningsSummary = {
  availableBalanceVnd: 12480000, availableBalanceFormatted: "12,480,000",
  nextPayoutVnd: 4850000, nextPayoutFormatted: "4,850,000", nextPayoutDate: "12 Aug",
  pendingSettlementVnd: 2145000, pendingSettlementFormatted: "2,145,000", pendingSettlementBookings: 9,
  grossBookingsVnd: 18200000, grossBookingsFormatted: "18,200,000",
  refundsVnd: 650000, refundsFormatted: "-650,000",
  tutoriaFeeVnd: 1755000, tutoriaFeeFormatted: "-1,755,000",
  partnerCommissionVnd: 320000, partnerCommissionFormatted: "-320,000",
  netEarningsVnd: 15475000, netEarningsFormatted: "15,475,000",
  settlementStatus: [
    { label: "Available", valueFormatted: "12.48m", width: 72 },
    { label: "Pending", valueFormatted: "2.15m", width: 22 },
    { label: "Held for refund window", valueFormatted: "845k", width: 9 },
  ],
};
export const MOCK_ANALYTICS: AnalyticsOverview = {
  impressions: 42800, listingVisits: 8988, availabilityViews: 1258, checkoutStarts: 390, bookings: 281,
  bookingFunnel: [
    { label: "Impressions", value: 42800, width: 100 },
    { label: "Listing visits", value: "8,988 21%", percentage: "21%", width: 72 },
    { label: "Checkout starts", value: "390 31%", percentage: "31%", width: 28 },
    { label: "Bookings", value: "281 72%", percentage: "72%", width: 20 },
  ],
  trafficSource: [
    { label: "Discover", percentage: 38, width: 38 },
    { label: "Search", percentage: 27, width: 27 },
    { label: "Map", percentage: 14, width: 14 },
  ],
  topListings: [
    { title: "Pizza-Making Workshop", visitors: 2841, bookings: 124, conversion: "8.2%", gross: "21.8m", trend: "+14%", trendDirection: "up" },
    { title: "IELTS Speaking", visitors: 2130, bookings: 42, conversion: "7.1%", gross: "4.3m", trend: "+9%", trendDirection: "up" },
  ],
};
export const MOCK_QUALITY: QualityPageData = {
  qualityScore: 92, qualityScoreMax: 100, qualityScoreLabel: "Excellent",
  qualityScoreDescription: "Strong service delivery with one credential action required.",
  metrics: [
    { key: "rating", label: "Rating", performance: "4.9", target: ">= 4.5", status: { variant: "ok", label: "Good" } },
    { key: "responseRate", label: "Response rate", performance: "96%", target: ">= 90%", status: { variant: "ok", label: "Good" } },
    { key: "cancellationRate", label: "Cancellation rate", performance: "1.2%", target: "< 3%", status: { variant: "ok", label: "Good" } },
    { key: "sessionCompletion", label: "Session completion", performance: "99%", target: ">= 97%", status: { variant: "ok", label: "Good" } },
    { key: "refundRate", label: "Refund rate", performance: "0.8%", target: "< 2%", status: { variant: "ok", label: "Good" } },
  ],
  actions: [{ id: "a1", text: "Professional credential expires in 21 days", detail: "Update the proof document to keep your credential badge active.", status: { variant: "warn", label: "Action needed" }, ctaLabel: "Update document", ctaVariant: "dark" }],
  incidents: [
    { id: "i1", title: "Late host cancellation", date: "24 Jul", impact: { variant: "neutral", label: "No action" }, actionLabel: "Details" },
    { id: "i2", title: "Listing image review", date: "18 Jul", impact: { variant: "ok", label: "Resolved" }, actionLabel: "View" },
  ],
};
export const MOCK_OPPORTUNITIES: OpportunitiesPageData = {
  insights: [
    { id: "o1", category: "High demand", title: "Saturday IELTS sessions", description: "482 people searched for IELTS tutors with Saturday availability in Ha Noi this week.", metrics: [{ label: "Estimated lift", value: "+6-11 bookings/mo" }, { label: "Supply level", value: "Low" }], ctaLabel: "Open Saturday availability", ctaVariant: "dark", ctaPage: "calendar" },
    { id: "o2", category: "Fill capacity", title: "Pottery Sunday 14:00", description: "4 seats remain and 12 people have saved this workshop.", metrics: [], ctaLabel: "Create targeted offer", ctaVariant: "dark", ctaAction: "createPromotion" },
  ],
  demandExplorer: [
    { id: "d1", searchDemand: "IELTS mock interview", change: "+42%", supply: "Low", hasCoverage: true, ctaLabel: "Add availability", ctaTarget: { type: "page", value: "calendar" } },
    { id: "d2", searchDemand: "Pottery this weekend", change: "+24%", supply: "Low", hasCoverage: false, ctaLabel: "Create listing", ctaTarget: { type: "action", value: "addListing" } },
  ],
};
export const MOCK_HOME_PAGE: HomePageData = {
  lastUpdated: "8 Aug 14:58", dateRange: "Last 7 days",
  metrics: [
    { id: "gross", label: "Gross bookings", value: "8.42m", trend: "+12.4%", trendDirection: "up", href: "analytics", isExternalLink: true },
    { id: "bookings", label: "Bookings", value: "37", trend: "+8.8%", trendDirection: "up", href: "analytics", isExternalLink: true },
    { id: "learners", label: "Learners", value: "31", trend: "+5.1%", trendDirection: "up", href: "analytics", isExternalLink: true },
    { id: "visitors", label: "Listing visitors", value: "1,482", trend: "-2.1%", trendDirection: "down", href: "analytics", isExternalLink: true },
    { id: "conversion", label: "Booking conversion", value: "6.8%", trend: "+0.7pt", trendDirection: "up", href: "analytics", isExternalLink: true },
  ],
  toDos: [
    { id: "requests", label: "Booking requests", value: "3", urgency: "Urgent: 1", page: "bookings" },
    { id: "today", label: "Sessions today", value: "5", urgency: "Next at 15:30", page: "calendar" },
    { id: "messages", label: "Unread learner messages", value: "7", urgency: "2 need a reply today", action: "messages" },
    { id: "quality", label: "Quality actions", value: "1", urgency: "Credential expires soon", page: "quality" },
  ],
  promotionBanner: {
    eyebrow: "Proven strategies to grow your business",
    title: "Fill Saturday capacity while demand is high.",
    description: "482 people searched for IELTS tutors with Saturday availability in Ha Noi this week.",
    primary: { label: "View opportunity", page: "opportunities" },
    secondary: { label: "Open availability", page: "calendar" },
  },
  performanceChart: {
    title: "Performance overview", subtitle: "Gross bookings by day", ctaLabel: "View analytics", ctaPage: "analytics",
    bars: [ { day: "Mon", heightPct: 34, value: 0, formatted: "" }, { day: "Tue", heightPct: 52, value: 0, formatted: "" }, { day: "Wed", heightPct: 41, value: 0, formatted: "" }, { day: "Thu", heightPct: 68, value: 0, formatted: "" }, { day: "Fri", heightPct: 58, value: 0, formatted: "" }, { day: "Sat", heightPct: 92, value: 0, formatted: "" }, { day: "Sun", heightPct: 78, value: 0, formatted: "" } ],
  },
  upcoming: {
    title: "Upcoming", subtitle: "Today - Hanoi time", ctaLabel: "Calendar", ctaPage: "calendar",
    items: [
      { id: "upc-1", time: "15:30", listingBadge: "1:1", listingType: "tutor", title: "IELTS Speaking - Mai Anh", subtitle: "Online - 60 min", ctaLabel: "Join", ctaAction: "join" },
      { id: "upc-2", time: "17:00", listingBadge: "WS", listingType: "workshop", title: "Pizza-Making Workshop", subtitle: "Hoan Kiem - 8 / 15", ctaLabel: "Manage", ctaListing: "pizza" },
      { id: "upc-3", time: "19:30", listingBadge: "1:1", listingType: "tutor", title: "Interview Practice - Trang", subtitle: "Online - booking request", ctaLabel: "Review", ctaPage: "bookings" },
    ],
  },
  sessionHealth: {
    title: "Session health", subtitle: "Capacity is Tutoria inventory.", ctaLabel: "Manage sessions", ctaPage: "calendar",
    rows: [
      { id: "sh-1", listingTitle: "Pizza-Making Workshop", date: "Sun 9 Aug - 17:00", booked: "8 / 15", bookedWidth: 53, capacity: "5 / 15", gross: "5.20m", status: { variant: "ok", label: "Confirmed" }, ctaLabel: "Manage", ctaListing: "pizza" },
      { id: "sh-2", listingTitle: "Pottery for Beginners", date: "Sun 10 Aug - 14:00", booked: "3 / 10", bookedWidth: 30, capacity: "5 / 10", gross: "1.35m", status: { variant: "warn", label: "Needs 2 bookings" }, ctaLabel: "Promote", ctaPage: "marketing" },
      { id: "sh-3", listingTitle: "IELTS Speaking", date: "Tomorrow - 09:00", booked: "3 / 4", bookedWidth: 75, capacity: "- / 4 slots", gross: "600k", status: { variant: "neutral", label: "1 slot left" }, ctaLabel: "Calendar", ctaPage: "calendar" },
    ],
  },
  notifications: [
    { id: "n1", type: "booking", title: "New booking request", subtitle: "Pizza-Making Workshop - 8 minutes ago", time: "8m", page: "bookings" },
    { id: "n2", type: "quality", title: "Credential expires soon", subtitle: "Update within 21 days", time: "now", page: "quality" },
  ],
};
