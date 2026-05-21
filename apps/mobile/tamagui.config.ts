import { createTamagui, createTokens, createFont } from 'tamagui';
import { tokens as kinTokens } from './src/theme/tokens';

// Map our spec tokens (see docs/SPEC.md §K) into Tamagui's expected token shape.
const tokens = createTokens({
  color: kinTokens.color,
  space: kinTokens.space,
  size: kinTokens.size,
  radius: kinTokens.radius,
  zIndex: { 0: 0, 1: 100, true: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
});

const bodyFont = createFont({
  family: 'System',
  size: {
    1: 13,
    2: 15,
    3: 17, // body.lg (Linda-friendly default)
    4: 19,
    5: 22,
    6: 28,
    7: 34,
  },
  lineHeight: {
    1: 18,
    2: 22,
    3: 24,
    4: 26,
    5: 28,
    6: 34,
    7: 40,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
  },
});

export const tamaguiConfig = createTamagui({
  tokens,
  fonts: { body: bodyFont, heading: bodyFont },
  themes: {
    light: {
      background: kinTokens.color.bgPrimary,
      backgroundHover: kinTokens.color.bgTinted,
      color: kinTokens.color.textPrimary,
      accent: kinTokens.color.accentPrimary,
      borderColor: kinTokens.color.borderSubtle,
    },
    dark: {
      background: '#15101A',
      backgroundHover: '#1F1825',
      color: '#F4ECEF',
      accent: kinTokens.color.accentPrimary,
      borderColor: '#2A2230',
    },
  },
  shorthands: {
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    m: 'margin',
    mx: 'marginHorizontal',
    my: 'marginVertical',
    br: 'borderRadius',
    bg: 'backgroundColor',
    fd: 'flexDirection',
    ai: 'alignItems',
    jc: 'justifyContent',
  } as const,
  defaultFont: 'body',
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
