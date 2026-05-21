/**
 * Kin design tokens — single source of truth for color, spacing, type scale, radii, shadows.
 * Mirrors §K of docs/SPEC.md. If you change one, update the spec too.
 */

export const tokens = {
  color: {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#FFFBFA',
    bgTinted: '#FFF1F3',
    bgVault: '#2A1820',
    accentPrimary: '#C0345C',
    accentPrimaryPress: '#9B294A',
    accentSecondary: '#F2A9BC',
    accentGold: '#C09155',
    textPrimary: '#1A1418',
    textSecondary: '#5C545A',
    textMuted: '#908990',
    textOnAccent: '#FFFFFF',
    borderSubtle: '#F1E7EA',
    borderStrong: '#DCD0D4',
    success: '#2E8B57',
    warning: '#B9701D',
    danger: '#B23A48',
  },
  // NOTE: Tamagui requires a `true` key on size/space/radius/zIndex tokens to act
  // as the "default" the framework can scale relative to. We point it at the base
  // step we chose in §K of the spec (16pt = space.4 / size.4).
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    true: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
  },
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    true: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    14: 56,
    avatar: 40,
    avatarLg: 56,
    avatarXl: 96,
    buttonHeight: 52,
  },
  radius: {
    sm: 8,
    md: 14,
    true: 14,
    lg: 20,
    xl: 28,
    pill: 999,
  },
  shadow: {
    sm: {
      shadowColor: '#1A1418',
      shadowOpacity: 0.04,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    md: {
      shadowColor: '#1A1418',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    lg: {
      shadowColor: '#1A1418',
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
    },
    vault: {
      shadowColor: '#000000',
      shadowOpacity: 0.4,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 8 },
    },
  },
  motion: {
    springTap: { damping: 18, stiffness: 220 },
    sheetIn: 240,
    sheetOut: 180,
  },
} as const;

export type KinTokens = typeof tokens;
