import { View } from 'react-native';
import { Action } from './components';

export function ResultFooter({ loading, hasMore, onLoadMore }: {
  loading: boolean; hasMore: boolean; onLoadMore: () => void;
}) {
  if (!hasMore) return null;
  return (
    <View className="items-center py-4" accessibilityLiveRegion="polite">
      <Action label={loading ? 'Loading…' : 'Load More'} icon="chevron-down-outline" busy={loading} onPress={onLoadMore} />
    </View>
  );
}
