import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { nativeStorage, type PdfPage } from '../documents/native-storage';
import { useTheme } from '../theme/theme';
import { Choice, EmptyCard, IconButton } from './components';

export function PdfViewer({ uri }: { uri: string }) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState<PdfPage>();
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setPage(undefined);
    setError(false);
    nativeStorage?.renderPdfPage(uri, index).then(result => {
      if (!active) return;
      setPage(result);
      setPageCount(result.pageCount);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [uri, index]);

  const displayWidth = Math.max(1, screenWidth - 32) * zoom;

  return (
    <View className="flex-1 gap-3 px-4 pb-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {index > 0 && <IconButton icon="chevron-back" label="Previous page" onPress={() => setIndex(index - 1)} />}
        <Text className="flex-1 font-semibold" style={{ color: colors.ink }} accessibilityLiveRegion="polite">
          {pageCount ? `Page ${index + 1} of ${pageCount}` : 'PDF'}
        </Text>
        {index + 1 < pageCount && <IconButton icon="chevron-forward" label="Next page" onPress={() => setIndex(index + 1)} />}
      </View>
      {page && (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Choice label="Fit width" selected={zoom === 1} onPress={() => setZoom(1)} />
            <Choice label="150%" selected={zoom === 1.5} onPress={() => setZoom(1.5)} />
            <Choice label="200%" selected={zoom === 2} onPress={() => setZoom(2)} />
          </View>
          <ScrollView key={index}>
            <ScrollView horizontal nestedScrollEnabled>
              <Image accessibilityLabel={`PDF page ${index + 1}`} source={{ uri: page.image }}
                style={{ width: displayWidth, height: displayWidth * page.height / page.width }} />
            </ScrollView>
          </ScrollView>
        </>
      )}
      {error && <EmptyCard icon="alert-circle-outline" title="Could not display this page"
        description="The PDF may be inaccessible, damaged, or password-protected. Try opening it in another app." />}
      {!page && !error && <ActivityIndicator accessibilityLabel="Rendering PDF page" color={colors.accent} />}
    </View>
  );
}
