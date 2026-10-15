export const typography = {
  fonts: {
    sans: 'InstrumentSans_500Medium',
    sansBold: 'InstrumentSans_700Bold',
    sansMedium: 'InstrumentSans_600SemiBold',
    mono: 'DMMono_400Regular',
    monoMedium: 'DMMono_500Medium',
  },
  sizes: {
    xs: 10.5, sm: 12.5, base: 14, lg: 15.5, xl: 19, 
    display: 34, displayClamp: 'clamp(30, 3vw, 42)',
  },
  weights: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeights: { tight: 1.08, normal: 1.45, relaxed: 1.62 },
  letterSpacing: { tight: '-0.055em', normal: '-0.012em', wide: '0.035em' },
} as const;
