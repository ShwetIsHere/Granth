import type { ComponentProps, PropsWithChildren } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>{children}</SafeAreaView>;
}

export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl border active:opacity-70"
      style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <Ionicons name={icon} size={21} color={colors.ink} />
    </Pressable>
  );
}

export function SearchField({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const { colors } = useTheme();
  return (
    <View className="min-h-14 flex-row items-center rounded-2xl border px-4"
      style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <Ionicons name="search-outline" size={20} color={colors.muted} />
      <TextInput accessibilityLabel="Search file names" placeholder="Search file names"
        placeholderTextColor={colors.muted} style={{ color: colors.ink }} className="ml-3 flex-1 py-3 text-base"
        value={value} onChangeText={onChangeText} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      {value !== '' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12}
          onPress={() => onChangeText('')} className="ml-2 p-2">
          <Ionicons name="close-circle" size={19} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

export function Action({ label, icon, onPress, busy = false }: {
  label: string; icon: IconName; onPress: () => void; busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
      onPress={onPress} disabled={busy} className="min-h-12 flex-row items-center justify-center gap-2 self-start rounded-xl px-4 py-3 active:opacity-80"
      style={{ backgroundColor: colors.gold, opacity: busy ? 0.65 : 1 }}>
      <Ionicons name={icon} color="#223044" size={20} />
      <Text className="text-base font-bold" style={{ color: '#223044' }}>{label}</Text>
    </Pressable>
  );
}

export function EmptyCard({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border p-4"
      style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.soft }}>
        <Ionicons name={icon} size={19} color={colors.accent} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold" style={{ color: colors.ink }}>{title}</Text>
        <Text className="mt-1 text-sm leading-5" style={{ color: colors.muted }}>{description}</Text>
      </View>
    </View>
  );
}

export function ScreenHeading({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View className="w-full max-w-[680px] flex-row items-center gap-3 self-center px-5 pb-4 pt-3">
      <IconButton icon="arrow-back-outline" label="Go back" onPress={onBack} />
      <Text accessibilityRole="header" className="flex-1 text-2xl font-bold" style={{ color: colors.ink }}>{title}</Text>
    </View>
  );
}

export function Choice({ label, selected, disabled = false, onPress }: {
  label: string; selected: boolean; disabled?: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      className="min-h-11 justify-center rounded-full border px-3 py-2 active:opacity-70"
      style={{
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.soft : colors.surface,
        opacity: disabled ? 0.65 : 1,
      }}>
      <Text className="text-sm font-semibold" style={{ color: selected ? colors.accent : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
