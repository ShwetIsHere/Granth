import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import type { ThemePreference } from '../storage/settings';

const light = {
  background: '#F7F4ED', surface: '#FFFDFA', ink: '#182436', muted: '#57616F',
  border: '#E3DED2', accent: '#825619', soft: '#F3E8D2',
  hero: '#172438', heroText: '#F9F2E7', heroMuted: '#D0DAE6', gold: '#F0C782',
};

const dark: typeof light = {
  background: '#101823', surface: '#182435', ink: '#F8F1E7', muted: '#B4C0CE',
  border: '#344357', accent: '#F0C782', soft: '#2C3440',
  hero: '#21334B', heroText: '#F9F2E7', heroMuted: '#D0DAE6', gold: '#F0C782',
};

export const useThemePreference = create<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>(set => ({
  preference: 'system',
  setPreference: preference => set({ preference }),
}));

export function useTheme() {
  const scheme = useColorScheme();
  const preference = useThemePreference(state => state.preference);
  const isDark = preference === 'dark' || (preference === 'system' && scheme === 'dark');
  return { colors: isDark ? dark : light, isDark };
}
