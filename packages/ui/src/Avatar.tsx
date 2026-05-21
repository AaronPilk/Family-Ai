import { View, Image } from 'react-native';
import { Paragraph } from 'tamagui';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, number> = { sm: 40, md: 56, lg: 96 };

export function Avatar({
  uri,
  name,
  size = 'md',
  unread = false,
}: {
  uri?: string | null;
  name: string;
  size?: Size;
  unread?: boolean;
}) {
  const px = SIZES[size];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={{
        width: px + (unread ? 4 : 0),
        height: px + (unread ? 4 : 0),
        borderRadius: (px + (unread ? 4 : 0)) / 2,
        backgroundColor: unread ? '#C0345C' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: px, height: px, borderRadius: px / 2 }}
          accessibilityLabel={`${name}'s photo`}
        />
      ) : (
        <View
          style={{
            width: px,
            height: px,
            borderRadius: px / 2,
            backgroundColor: '#FFF1F3',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Paragraph fontSize={px / 3} fontWeight="600" color="#C0345C">
            {initials}
          </Paragraph>
        </View>
      )}
    </View>
  );
}
