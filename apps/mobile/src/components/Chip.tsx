import { View, Text } from 'react-native';
import { tokens } from '../theme/tokens';

export function Chip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'rose' | 'gold' | 'green';
}) {
  const palette = {
    neutral: { bg: tokens.color.bgTinted, fg: tokens.color.textSecondary },
    rose:    { bg: '#FFE3EA',              fg: tokens.color.accentPrimary },
    gold:    { bg: '#FFF1E0',              fg: '#A56627' },
    green:   { bg: '#E1F1E7',              fg: '#286B43' },
  }[tone];

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: palette.bg,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
