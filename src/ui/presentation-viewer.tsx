import { useMemo } from 'react';
import { Image, Text, View } from 'react-native';
import type { Presentation, Slide } from '../documents/presentation';
import { useTheme } from '../theme/theme';
import { EmptyCard } from './components';
import { ZoomList } from './zoom-list';
import { ZoomSurface } from './zoom-surface';

export function SlideCanvas({ slide, deckWidth, deckHeight, width }: {
  slide: Slide; deckWidth: number; deckHeight: number; width: number;
}) {
  const scale = width / deckWidth;
  return (
    <View style={{ width, height: deckHeight * scale, backgroundColor: slide.background, overflow: 'hidden' }}>
      {slide.elements.map((element, index) => (
        <View key={index} style={{ position: 'absolute', left: element.x * scale, top: element.y * scale,
          width: element.width * scale, height: element.height * scale, overflow: 'hidden',
          backgroundColor: element.fill, transform: [{ rotate: `${element.rotation}deg` }] }}>
          {element.image && <Image source={{ uri: element.image }} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />}
          {element.paragraphs?.map((paragraph, pIndex) => (
            <Text key={pIndex} allowFontScaling={false} style={{ textAlign: paragraph.align, color: '#182436',
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
  );
}

function PresentationSlide({ deck, index, width, reset, onZoom }: {
  deck: Presentation; index: number; width: number; reset: number; onZoom: (zoomed: boolean) => void;
}) {
  const { colors } = useTheme();
  const slide = useMemo(() => {
    try { return deck.slideAt(index); } catch { return undefined; }
  }, [deck, index]);

  return (
    <View accessibilityLabel={`Slide ${index + 1}`} className="gap-1">
      <Text style={{ color: colors.muted }}>{`Slide ${index + 1}`}</Text>
      {slide ? (
        <ZoomSurface key={reset} width={width} height={width * deck.height / deck.width} onZoom={onZoom}>
          <SlideCanvas slide={slide} deckWidth={deck.width} deckHeight={deck.height} width={width} />
        </ZoomSurface>
      ) : <EmptyCard icon="alert-circle-outline" title="Could not display slide" description="Continue scrolling to view the other slides." />}
      {slide?.partial && <Text style={{ color: colors.muted }}>Some elements are unavailable.</Text>}
    </View>
  );
}

export function PresentationViewer({ deck }: { deck: Presentation }) {
  const slides = useMemo(() => Array.from({ length: deck.count }, (_, index) => index), [deck]);
  return <ZoomList items={slides} label={`${deck.count} ${deck.count === 1 ? 'slide' : 'slides'}`}
    render={(index, _, width, reset, onZoom) => (
      <PresentationSlide deck={deck} index={index} width={width} reset={reset} onZoom={onZoom} />
    )} />;
}
