import '../global.css';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { readTheme } from '../src/storage/settings';
import { useDiscovery } from '../src/state/library';
import { useTheme, useThemePreference } from '../src/theme/theme';
import { PdfIntentHandler } from '../src/ui/pdf-intent-handler';

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { refresh } = useDiscovery.getState();
    void refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    readTheme().then(preference => {
      if (active) useThemePreference.getState().setPreference(preference);
    }).catch(() => {
      if (active) Alert.alert('Settings unavailable', 'GRANTH will use the system appearance for now.');
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {ready ? <><Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }} /><PdfIntentHandler /></> : (
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
          <ActivityIndicator accessibilityLabel="Loading settings" color={colors.accent} />
        </View>
      )}
    </>
  );
}
