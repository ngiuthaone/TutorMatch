// Tutoria Mobile Design System - Adapted from the web premium-charcoal theme

export const colors = {
  // Light surfaces
  background: "#e9ebed",
  surface: "#fafafa",
  surfaceElevated: "rgba(250,250,250,0.86)",
  surfaceSoft: "#eef0f2",
  
  // Dark chrome (sidebar, topbar equivalents)
  chrome: "#141517",
  chromeBorder: "rgba(255,255,255,0.055)",
  chromeText: "#d6d8dc",
  chromeMuted: "#777c83",
  
  // Text
  ink: "#17181a",
  muted: "#73777d",
  silver: "#9c9ca3",
  
  // Borders
  border: "#d9dadd",
  borderStrong: "#bfc1c5",
  
  // Semantic
  primary: "#17181a",
  primaryHover: "#050607",
  success: "#2f7557",
  warning: "#9a6425",
  danger: "#a44738",
  
  // Overlay
  overlay: "rgba(10,11,12,0.72)",
  glass: "rgba(250,250,250,0.78)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  topbarHeight: 64,
  sidebarWidth: 272,
  pageWrapPadding: { horizontal: 24, vertical: 24, bottom: 32 },
  panelRadius: 16,
  btnRadius: 12,
  btnSmRadius: 10,
  fieldRadius: 12,
  sectionGap: 36,
  cardShadow: {
    shadowColor: "#090a0c",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.035,
    shadowRadius: 18,
    elevation: 3,
  },
} as const;

export const typography = {
  fonts: {
    sans: "InstrumentSans_500Medium",
    sansBold: "InstrumentSans_700Bold",
    sansMedium: "InstrumentSans_600SemiBold",
    mono: "DMMono_400Regular",
    monoMedium: "DMMono_500Medium",
  },
  sizes: {
    xs: 10.5,
    sm: 12.5,
    base: 14,
    lg: 15.5,
    xl: 19,
    display: 34,
  },
  weights: { regular: "400", medium: "500", semibold: "600", bold: "700" },
  lineHeights: { tight: 1.08, normal: 1.45, relaxed: 1.62 },
  letterSpacing: { tight: -0.055, normal: -0.012, wide: 0.035 },
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Typography = typeof typography;
export type Radii = typeof radii;
