// Design tokens from the AI Stylist UI (iOS Liquid Glass, light).
export const colors = {
  ground: '#F4F3F0',
  studio: '#ECEAE6',
  surface: '#FFFFFF',
  ink: '#121216',
  inkSecondary: '#5E5E66',
  inkTertiary: '#8E8E93',
  accent: '#2F54EB',
  accentSoft: 'rgba(47,84,235,0.12)',
  fill: 'rgba(118,118,128,0.12)',
  separator: 'rgba(60,60,67,0.18)',
  danger: '#C42B2B',
  dangerSoft: 'rgba(196,43,43,0.1)',
  success: '#17603F',
  successSoft: '#E3F1EA',
  warning: '#B25E09',
  glassFallback: 'rgba(255,255,255,0.86)',
} as const;

export const radius = { sm: 12, md: 18, lg: 24, xl: 34, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export type TypeVariant = keyof typeof type;
