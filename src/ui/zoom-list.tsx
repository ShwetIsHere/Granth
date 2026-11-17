import { useState, type ReactNode } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { IconButton } from './components';

export function ZoomList<T>({ items, label, render }: {
  items: T[]; label: string;
  render: (item: T, index: number, width: number, reset: number, onZoom: (zoomed: boolean) => void) => ReactNode;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [reset, setReset] = useState(0);

  return (
    <View className="flex-1 gap-2 px-3 pb-2" onLayout={event => setWidth(Math.max(0, event.nativeEvent.layout.width - 24))}>
      <View className="min-h-12 flex-row items-center justify-between">
        <Text className="font-semibold" style={{ color: colors.ink }}>{label}</Text>
        {zoomed && <IconButton icon="contract-outline" label="Reset zoom" onPress={() => {
          setZoomed(false);
          setReset(value => value + 1);
        }} />}
      </View>
      {width > 0 && <FlatList data={items} keyExtractor={(_, index) => String(index)}
        scrollEnabled={!zoomed} renderItem={({ item, index }) => render(item, index, width, reset, setZoomed)}
        ItemSeparatorComponent={() => <View className="h-3" />} initialNumToRender={3} windowSize={5} />}
    </View>
  );
}
