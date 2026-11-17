import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { WordParagraph, WordSection } from '../documents/word';
import { layoutWordPages, wordLineHeight } from '../documents/word-pages';
import { EmptyCard } from './components';
import { ZoomList } from './zoom-list';
import { ZoomSurface } from './zoom-surface';

function WordParagraphView({ paragraph, width, scale }: { paragraph: WordParagraph; width: number; scale: number }) {
  const fontSize = paragraph.runs.reduce((size, run) => Math.max(size, run.size ?? 15), 0) || 15;
  const inner = Math.max(1, width - (paragraph.left + paragraph.right) * scale);
  return (
    <View style={{ marginTop: paragraph.before * scale, marginBottom: paragraph.after * scale,
      marginLeft: paragraph.left * scale, marginRight: paragraph.right * scale }}>
      {(paragraph.runs.length > 0 || paragraph.images.length === 0) && (
        <Text allowFontScaling={false} style={{ color: '#253044', fontSize: fontSize * scale, textAlign: paragraph.align,
          lineHeight: wordLineHeight(paragraph, fontSize) * scale, includeFontPadding: false }}>
          {paragraph.list ? '•  ' : ''}
          {paragraph.runs.length === 0 ? ' ' : paragraph.runs.map((run, index) => (
            <Text key={index} style={{ fontSize: (run.size ?? 15) * scale, color: run.color, fontFamily: run.font,
              fontWeight: run.bold ? 'bold' : undefined, fontStyle: run.italic ? 'italic' : undefined,
              textDecorationLine: run.underline ? 'underline' : undefined }}>{run.text}</Text>
          ))}
        </Text>
      )}
      {paragraph.images.map((image, index) => {
        const drawWidth = Math.min(inner, image.width ? image.width * scale : inner);
        return <Image key={index} source={{ uri: image.uri }} resizeMode="contain"
          style={{ width: drawWidth, height: drawWidth / image.ratio,
            alignSelf: paragraph.align === 'center' ? 'center' : paragraph.align === 'right' ? 'flex-end' : 'flex-start' }} />;
      })}
    </View>
  );
}

function WordPage({ page, width, reset, onZoom }: {
  page: WordSection; width: number; reset: number; onZoom: (zoomed: boolean) => void;
}) {
  const { setup, blocks } = page;
  const scale = width / setup.width;
  const paperHeight = setup.height * scale;
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const inner = Math.max(1, (setup.width - setup.left - setup.right) * scale);
  const cellPadding = 6 * scale;
  const kind = page.firstPage && page.distinctFirst ? 'first' : 'default';

  return (
    <ZoomSurface key={`${reset}:${width}`} width={width} height={Math.max(paperHeight, measuredHeight)} onZoom={onZoom}>
      <View onLayout={event => setMeasuredHeight(event.nativeEvent.layout.height)}
        style={{ minHeight: paperHeight, backgroundColor: '#FFFFFF', paddingTop: setup.top * scale,
          paddingBottom: setup.bottom * scale, paddingLeft: setup.left * scale, paddingRight: setup.right * scale,
          justifyContent: setup.vertical }}>
        {page.header?.[kind]?.length ? <View style={{ position: 'absolute', top: setup.header * scale,
          left: setup.left * scale, width: inner }}>
          {page.header[kind].map((p, index) => <WordParagraphView key={index} paragraph={p} width={inner} scale={scale} />)}
        </View> : null}
        {page.footer?.[kind]?.length ? <View style={{ position: 'absolute', bottom: setup.footer * scale,
          left: setup.left * scale, width: inner }}>
          {page.footer[kind].map((p, index) => <WordParagraphView key={index} paragraph={p} width={inner} scale={scale} />)}
        </View> : null}
        {blocks.map((block, index) => block.type === 'paragraph'
          ? <WordParagraphView key={index} paragraph={block} width={inner} scale={scale} />
          : <View key={index} style={{ borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#CDD4DE' }}>
            {block.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: 'row' }}>
                {row.map((cell, cellIndex) => (
                  <View key={cellIndex} style={{ flex: 1, padding: cellPadding, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#CDD4DE' }}>
                    {cell.map((paragraph, pIndex) => <WordParagraphView key={pIndex} paragraph={paragraph} scale={scale}
                      width={Math.max(1, inner / row.length - 2 * cellPadding)} />)}
                  </View>
                ))}
              </View>
            ))}
          </View>)}
      </View>
    </ZoomSurface>
  );
}

export function WordViewer({ sections }: { sections: WordSection[] }) {
  const pages = useMemo(() => layoutWordPages(sections), [sections]);
  if (!pages.length) return <EmptyCard icon="document-outline" title="Empty document" description="This document has no body content." />;
  return <ZoomList items={pages} label="Word document"
    render={(page, _, width, reset, onZoom) => <WordPage page={page} width={width} reset={reset} onZoom={onZoom} />} />;
}
