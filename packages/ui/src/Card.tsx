import { YStack, type YStackProps } from 'tamagui';

/**
 * Card — white surface on the tinted page background. See §K.
 */
export function Card(props: YStackProps) {
  return (
    <YStack
      bg="$background"
      br="$5"
      p="$5"
      shadowColor="#1A1418"
      shadowOpacity={0.06}
      shadowRadius={12}
      shadowOffset={{ width: 0, height: 4 }}
      {...props}
    />
  );
}
