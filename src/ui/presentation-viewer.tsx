import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { Presentation } from '../documents/presentation';
import { useTheme } from '../theme/theme';
import { EmptyCard, IconButton } from './components';

export function PresentationViewer({ deck }: { deck: Presentation }) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const slide = useMemo(() => {
    try { return deck.slideAt(index); } catch { return undefined; }
  }, [deck, index]);
  const scale = Math.min(viewport.width / deck.width, viewport.height / deck.height);

  return (
    <View className="flex-1 gap-2 px-3 pb-3">
      <View className="flex-row items-center gap-2">
        {index > 0 && <IconButton icon="chevron-back" label="Previous slide" onPress={() => setIndex(index - 1)} />}
        <Text className="flex-1 font-semibold" style={{ color: colors.ink }}>{`Slide ${index + 1} of ${deck.count}`}</Text>
        {index + 1 < deck.count && <IconButton icon="chevron-forward" label="Next slide" onPress={() => setIndex(index + 1)} />}
      </View>
      {slide ? (
        <View className="flex-1 items-center justify-center" onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setViewport({ width, height });
        }}>
          {scale > 0 && (
            <View accessibilityLabel={`Slide ${index + 1}`} style={{ width: deck.width * scale, height: deck.height * scale,
              backgroundColor: slide.background, overflow: 'hidden' }}>
              {slide.elements.map((element, elementIndex) => (
                <View key={elementIndex} style={{ position: 'absolute', left: element.x * scale, top: element.y * scale,
                  width: element.width * scale, height: element.height * scale, overflow: 'hidden',
                  backgroundColor: element.fill, transform: [{ rotate: `${element.rotation}deg` }] }}>
                  {element.image && <Image source={{ uri: element.image }} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />}
                  {element.paragraphs?.map((paragraph, paragraphIndex) => (
                    <Text key={paragraphIndex} allowFontScaling={false} style={{ textAlign: paragraph.align, color: '#182436',
                      fontSize: Math.max(1, 1800 * 127 * scale), includeFontPadding: false }}>
                      {paragraph.runs.map((run, runIndex) => (
                        <Text key={runIndex} style={{ color: run.color, fontSize: Math.max(1, run.size * 127 * scale),
                          fontWeight: run.bold ? 'bold' : 'normal', fontStyle: run.italic ? 'italic' : 'normal' }}>{run.text}</Text>
                      ))}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      ) : <EmptyCard icon="alert-circle-outline" title="Could not display slide" description="Try a different slide or open the presentation in another app." />}
      {slide?.partial && <Text style={{ color: colors.muted }}>Some slide elements are unavailable in this preview.</Text>}
    </View>
  );
}
