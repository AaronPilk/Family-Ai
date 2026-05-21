import { Pressable, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import {
  useBranchStore,
  useIsMultiBranch,
  useVisibleBranches,
  useSelection,
  useCurrentBranch,
} from '../lib/branchStore';
import { BRANCHES } from '../lib/mockData';

const ALL_COLOR = '#7A4A8C';

/**
 * Top-of-screen branch indicator. Renders only when the user has 2+ branches.
 * Tapping cycles: All my family → first branch → second branch → All my family
 */
export function BranchSwitcher() {
  const isMulti = useIsMultiBranch();
  const cycle = useBranchStore((s) => s.cycle);
  const sel = useSelection();
  const current = useCurrentBranch();

  if (!isMulti) return null;

  const color = sel === 'all' ? ALL_COLOR : current.color;

  return (
    <Pressable
      onPress={cycle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: color + '15',
        borderWidth: 1,
        borderColor: color + '40',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color, fontWeight: '700', fontSize: 13 }}>
        {sel === 'all' ? 'All my family' : current.shortName}
      </Text>
      <Text style={{ color, fontSize: 13, opacity: 0.7 }}>▾</Text>
    </Pressable>
  );
}

/** List of branches you've joined (shown in Family tab only if 2+). */
export function BranchList() {
  const branches = useVisibleBranches();
  const sel = useSelection();
  const setSelection = useBranchStore((s) => s.setSelection);

  if (branches.length < 2) return null;

  const items: { key: string; label: string; color: string; selected: boolean; onPress: () => void; subtitle: string }[] = [
    {
      key: 'all',
      label: 'All my family',
      color: ALL_COLOR,
      selected: sel === 'all',
      onPress: () => setSelection('all'),
      subtitle: `${branches.length} branches combined`,
    },
    ...branches.map((b) => ({
      key: b.id,
      label: b.name,
      color: b.color,
      selected: sel === b.id,
      onPress: () => setSelection(b.id),
      subtitle: `${b.memberIds.length} members · ${b.memoryCount} memories`,
    })),
  ];

  return (
    <View style={{ gap: 10 }}>
      {items.map((b) => (
        <Pressable
          key={b.key}
          onPress={b.onPress}
          style={({ pressed }) => ({
            padding: 16,
            borderRadius: 16,
            backgroundColor: tokens.color.bgPrimary,
            borderWidth: 1.5,
            borderColor: b.selected ? b.color : tokens.color.borderSubtle,
            opacity: pressed ? 0.7 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          })}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: b.color }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
              {b.label}
            </Text>
            <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
              {b.subtitle}
            </Text>
          </View>
          {b.selected && (
            <Text style={{ color: b.color, fontWeight: '700', fontSize: 13 }}>active</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
