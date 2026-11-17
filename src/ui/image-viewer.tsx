import { useState } from 'react';
import { Image, View } from 'react-native';
import { EmptyCard, IconButton } from './components';
import { ZoomSurface } from './zoom-surface';

export function ImageViewer({ uri, name }: { uri: string; name: string }) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [original, setOriginal] = useState<{ width: number; height: number }>();
  const [zoomed, setZoomed] = useState(false);
  const [reset, setReset] = useState(0);
  const [error, setError] = useState(false);
  const factor = original ? Math.min(area.width / original.width, area.height / original.height) : 1;
  const width = original ? original.width * factor : area.width;
  const height = original ? original.height * factor : area.height;

  return (
    <View className="flex-1 px-3 pb-3">
      {error ? <EmptyCard icon="alert-circle-outline" title="Could not display image" description="Try opening the original in another app." /> : (
        <>
          <View className="flex-1 items-center justify-center" onLayout={event => {
            const { width: availableWidth, height: availableHeight } = event.nativeEvent.layout;
            setArea({ width: availableWidth, height: availableHeight });
          }}>
            {width > 0 && height > 0 && (
              <ZoomSurface key={reset} width={width} height={height} onZoom={setZoomed}>
                <Image source={{ uri }} accessibilityLabel={name} style={{ width, height }} resizeMode="contain"
                  resizeMethod="scale" onError={() => setError(true)} onLoad={event => {
                    const { width: sourceWidth, height: sourceHeight } = event.nativeEvent.source;
                    if (sourceWidth > 0 && sourceHeight > 0) setOriginal({ width: sourceWidth, height: sourceHeight });
                  }} />
              </ZoomSurface>
            )}
          </View>
          {zoomed && <View className="absolute right-3 top-0">
            <IconButton icon="contract-outline" label="Reset zoom" onPress={() => {
              setZoomed(false);
              setReset(value => value + 1);
            }} />
          </View>}
        </>
      )}
    </View>
  );
}
