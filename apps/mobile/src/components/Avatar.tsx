import { View, Text } from 'react-native';
import type { Member } from '../lib/mockData';

type Size = 'sm' | 'md' | 'lg' | 'xl';
const SIZES: Record<Size, number> = { sm: 32, md: 44, lg: 64, xl: 96 };

export function Avatar({
  member,
  size = 'md',
  ring = false,
}: {
  member: Pick<Member, 'initials' | 'color' | 'name'>;
  size?: Size;
  ring?: boolean;
}) {
  const px = SIZES[size];
  const ringPad = ring ? 3 : 0;
  return (
    <View
      style={{
        width: px + ringPad * 2,
        height: px + ringPad * 2,
        borderRadius: (px + ringPad * 2) / 2,
        backgroundColor: ring ? '#C0345C' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: member.color + '22', // soft tint of their color
          borderWidth: 1,
          borderColor: member.color + '44',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: member.color,
            fontWeight: '700',
            fontSize: px / 2.4,
          }}
        >
          {member.initials}
        </Text>
      </View>
    </View>
  );
}
