import { Button as TButton, type ButtonProps as TButtonProps } from 'tamagui';

export interface KinButtonProps extends TButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * Primary action button — see §K of docs/SPEC.md.
 * 52pt height, rose fill (primary), pill radius, medium haptic on press (wire in v1).
 */
export function Button({ variant = 'primary', ...props }: KinButtonProps) {
  const style =
    variant === 'primary'
      ? { bg: '$accent', color: 'white' as const }
      : variant === 'secondary'
        ? { bg: '$backgroundHover', color: '$accent' as const }
        : { bg: 'transparent' as const, color: '$accent' as const };

  return (
    <TButton
      size="$5"
      height={52}
      br="$10"
      fontWeight="600"
      pressStyle={{ opacity: 0.85 }}
      {...style}
      {...props}
    />
  );
}
