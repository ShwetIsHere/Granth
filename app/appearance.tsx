import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { saveTheme, type ThemePreference } from '../src/storage/settings';
import { useTheme, useThemePreference } from '../src/theme/theme';
import { Choice, EmptyCard, Screen, ScreenHeading } from '../src/ui/components';

const preferences: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function Appearance() {
  const router = useRouter();
  const { colors } = useTheme();
  const preference = useThemePreference(state => state.preference);
  const setPreference = useThemePreference(state => state.setPreference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const saving = useRef(false);

  async function changeTheme(value: ThemePreference) {
    if (saving.current || value === preference) return;
    saving.current = true;
    setBusy(true);
    setError(false);
    try {
      await saveTheme(value);
      setPreference(value);
    } catch {
      setError(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeading title="Appearance" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, gap: 16 }}>
        <Text className="text-base" style={{ color: colors.muted }}>Choose a theme or follow your device’s appearance.</Text>
        <View className="flex-row flex-wrap gap-2">
          {preferences.map(option => (
            <Choice key={option.id} label={option.label} selected={preference === option.id}
              disabled={busy} onPress={() => changeTheme(option.id)} />
          ))}
        </View>
        {error && <EmptyCard icon="alert-circle-outline" title="Could not save appearance" description="Select a theme to try again." />}
      </ScrollView>
    </Screen>
  );
}
