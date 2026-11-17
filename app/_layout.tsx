import '../global.css';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { readTheme } from '../src/storage/settings';
import { useTheme, useThemePreference } from '../src/theme/theme';

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const [ready, setReady] = useState(false);

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
      {ready ? <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }} /> : (
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
          <ActivityIndicator accessibilityLabel="Loading settings" color={colors.accent} />
        </View>
      )}
    </>
  );
}
