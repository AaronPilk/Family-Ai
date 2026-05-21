import { XStack, Paragraph } from 'tamagui';
import type { VisibilityScope } from '@kin/shared';

const LABELS: Record<VisibilityScope, string> = {
  only_me: 'Only me',
  specific_users: 'Just us',
  relationship_types: 'Selected family',
  entire_circle: 'Family',
  vault: 'Vault',
  future_release: 'Locked',
};

export function VisibilityChip({ scope }: { scope: VisibilityScope }) {
  const isVault = scope === 'vault' || scope === 'future_release';
  return (
    <XStack
      ai="center"
      px="$3"
      py="$1"
      br="$10"
      bg={isVault ? '#FFF1E5' : '$backgroundHover'}
    >
      <Paragraph
        fontSize={13}
        fontWeight="500"
        color={isVault ? '#A56627' : '$accent'}
      >
        {LABELS[scope]}
      </Paragraph>
    </XStack>
  );
}
