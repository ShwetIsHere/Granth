import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, View, type FlatListProps } from 'react-native';
import { nativeStorage, type PdfPage } from '../documents/native-storage';
import { ZoomSurface } from './zoom-surface';
import { useTheme } from '../theme/theme';
import { EmptyCard, IconButton } from './components';

function PdfRow({ uri, index, first, width, reset, onZoom }: {
  uri: string; index: number; first: PdfPage; width: number; reset: number; onZoom: (zoomed: boolean) => void;
}) {
  const { colors } = useTheme();
  const [page, setPage] = useState<PdfPage | undefined>(index === 0 ? first : undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (index === 0) return;
    let mounted = true;
    nativeStorage?.renderPdfPage(uri, index).then(result => {
      if (mounted) setPage(result);
    }).catch(() => {
      if (mounted) setError(true);
    });
    return () => { mounted = false; };
  }, [index, uri]);

  return (
    <View style={{ paddingBottom: 12 }}>
      {page ? <ZoomSurface key={reset} width={width} height={width * page.height / page.width} onZoom={onZoom}>
        <Image accessibilityLabel={`PDF page ${index + 1}`} source={{ uri: page.image }}
          style={{ width, height: width * page.height / page.width, backgroundColor: '#FFFFFF' }} />
      </ZoomSurface> : (
        <View style={{ minHeight: error ? 90 : width * first.height / first.width, justifyContent: 'center' }}>
          {error ? <EmptyCard icon="alert-circle-outline" title={`Page ${index + 1} could not load`}
            description="Continue scrolling to view other pages." /> : <ActivityIndicator color={colors.accent} />}
        </View>
      )}
    </View>
  );
}

export function PdfViewer({ uri }: { uri: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [first, setFirst] = useState<PdfPage>();
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [reset, setReset] = useState(0);
  const list = useRef<FlatList<number>>(null);
  const onVisible = useRef<NonNullable<FlatListProps<number>['onViewableItemsChanged']>>(({ viewableItems }) => {
    const index = viewableItems[0]?.index;
    if (index != null) setVisible(index);
  }).current;
  const viewability = useRef({ viewAreaCoveragePercentThreshold: 20 }).current;
  const pages = useMemo(() => Array.from({ length: first?.pageCount ?? 0 }, (_, index) => index), [first]);
  const onZoom = useMemo(() => (value: boolean) => setZoomed(value), []);

  useEffect(() => {
    let mounted = true;
    nativeStorage?.renderPdfPage(uri, 0).then(page => {
      if (mounted) setFirst(page);
    }).catch(() => {
      if (mounted) setError(true);
    });
    return () => { mounted = false; };
  }, [uri]);

  function resetZoom() {
    setZoomed(false);
    setReset(value => value + 1);
  }

  function goTo(index: number) {
    resetZoom();
    list.current?.scrollToIndex({ index });
  }

  return (
    <View className="flex-1 gap-2 px-3" onLayout={event => setWidth(Math.max(0, event.nativeEvent.layout.width - 24))}>
      {first && (
        <View className="flex-row items-center gap-2">
          {visible > 0 && <IconButton icon="chevron-back" label="Previous page" onPress={() => goTo(visible - 1)} />}
          <Text className="flex-1 font-semibold" style={{ color: colors.ink }}>
            {`Page ${visible + 1} of ${first.pageCount}`}
          </Text>
          {zoomed && <IconButton icon="contract-outline" label="Reset zoom" onPress={resetZoom} />}
          {visible + 1 < first.pageCount && <IconButton icon="chevron-forward" label="Next page" onPress={() => goTo(visible + 1)} />}
        </View>
      )}
      {first && width > 0 && (
        <FlatList ref={list} data={pages} keyExtractor={String} scrollEnabled={!zoomed}
          onViewableItemsChanged={onVisible} viewabilityConfig={viewability}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            list.current?.scrollToOffset({ offset: index * (averageItemLength || width * first.height / first.width + 12) });
          }}
          renderItem={({ item }) => <PdfRow uri={uri} index={item} first={first} width={width}
            reset={reset} onZoom={onZoom} />}
          initialNumToRender={2} maxToRenderPerBatch={2} windowSize={5} />
      )}
      {error && <EmptyCard icon="alert-circle-outline" title="Could not open PDF"
        description="The PDF may be inaccessible, damaged, or password-protected. Try opening it in another app." />}
      {!first && !error && <ActivityIndicator accessibilityLabel="Opening PDF" color={colors.accent} />}
    </View>
  );
}
