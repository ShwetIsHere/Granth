import { useEffect, useRef } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useListCheckpoint<T>(criteria: string, count: number, append: () => void) {
  const list = useRef<FlatList<T>>(null);
  const offset = useRef(0);
  const checkpoint = useRef<{ count: number; offset: number } | null>(null);

  useEffect(() => {
    checkpoint.current = null;
    offset.current = 0;
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [criteria]);

  return {
    list,
    onLoadMore() {
      if (!checkpoint.current) checkpoint.current = { count, offset: offset.current };
      append();
    },
    onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
      offset.current = event.nativeEvent.contentOffset.y;
    },
    onContentSizeChange() {
      const previous = checkpoint.current;
      if (!previous || count <= previous.count) return;
      checkpoint.current = null;
      list.current?.scrollToOffset({ offset: previous.offset, animated: false });
    },
  };
}
