import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { File } from 'expo-file-system';
import type { SelectedFile } from '../documents/files';
import { findCategory } from '../documents/formats';
import { nativeStorage } from '../documents/native-storage';
import type { Slide } from '../documents/presentation';
import { useTheme } from '../theme/theme';
import { SlideCanvas } from './presentation-viewer';

type Preview =
  | { type: 'image'; uri: string }
  | { type: 'slide'; slide: Slide; width: number; height: number }
  | { type: 'text'; lines: string[] };

let previewQueue = Promise.resolve();
const thumbnailCache = new Map<string, Preview | undefined>();

async function loadPreview(id: string, extension: string, size?: number): Promise<Preview | undefined> {
  if (extension === 'pdf' && nativeStorage) {
    return { type: 'image', uri: (await nativeStorage.renderPdfPage(id, 0)).image };
  }
  if (extension === 'csv') {
    const { openCsv } = await import('../documents/csv-file');
    const { rows } = await openCsv(id).window(0, 4);
    return { type: 'text', lines: [...rows.values()].map(row => row.slice(0, 4).join('   │   ')) };
  }
  if (!['docx', 'pptx', 'xlsx', 'xls', 'csv', 'ods'].includes(extension)) return;
  const source = new File(id);
  // Large documents can still open normally from a format tile.
  const limit = 4 * 1024 * 1024;
  if ((size ?? source.size) > limit) return;
  const bytes = await source.bytes();
  if (bytes.byteLength > limit) return;
  if (extension === 'pptx') {
    const { readPresentation } = await import('../documents/presentation');
    const deck = readPresentation(bytes);
    return { type: 'slide', slide: deck.slideAt(0), width: deck.width, height: deck.height };
  }
  if (extension === 'docx') {
    const { readWord } = await import('../documents/word');
    return { type: 'text', lines: readWord(bytes).flatMap(section => section.blocks).flatMap(block =>
      block.type === 'paragraph' ? [block.runs.map(run => run.text).join('')] : []).filter(Boolean).slice(0, 8) };
  }

  const { cellText, readWorkbook } = await import('../documents/workbook');
  const book = readWorkbook(bytes, { sheetRows: 5, sheets: 0 });
  const { utils } = await import('xlsx');
  const sheet = book.Sheets[book.SheetNames[0]];
  const ref = sheet?.['!ref'];
  if (!ref) return;
  const { s, e } = utils.decode_range(ref);
  const lines = Array.from({ length: Math.min(5, e.r - s.r + 1) }, (_, index) =>
    Array.from({ length: Math.min(4, e.c - s.c + 1) }, (_, column) =>
      cellText(sheet, utils.encode_cell({ c: s.c + column, r: s.r + index }))).join('   │   '));
  return { type: 'text', lines };
}

export function FileGridCard({ file, width, visible, onOpen, onDetails }: {
  file: SelectedFile; width: number; visible: boolean; onOpen: () => void; onDetails: () => void;
}) {
  const { colors } = useTheme();
  const { id, extension, size, category, name } = file;
  const icon = findCategory(category)?.icon ?? 'document-outline';
  const cacheKey = JSON.stringify([id, size, file.modifiedAt]);
  const [preview, setPreview] = useState<Preview | undefined>(() => thumbnailCache.get(cacheKey));
  const [failed, setFailed] = useState(false);
  const previewWidth = Math.max(1, width - 2);
  const previewHeight = Math.round(previewWidth / 1.3);

  useEffect(() => {
    if (!visible || category === 'images') return;
    let active = true;
    previewQueue = previewQueue.then(async () => {
      if (!active) return;
      try {
        const result = thumbnailCache.has(cacheKey) ? thumbnailCache.get(cacheKey) : await loadPreview(id, extension, size);
        thumbnailCache.delete(cacheKey);
        thumbnailCache.set(cacheKey, result);
        if (thumbnailCache.size > 20) {
          const oldest = thumbnailCache.keys().next();
          if (!oldest.done) thumbnailCache.delete(oldest.value);
        }
        if (active) setPreview(result);
      } catch {
        // The file tile remains usable if its preview cannot be generated.
      }
    });
    return () => { active = false; };
  }, [visible, id, extension, size, category, cacheKey]);

  const image = category === 'images' ? id : preview?.type === 'image' ? preview.uri : undefined;
  return (
    <View className="overflow-hidden rounded-2xl border"
      style={{ width, height: previewHeight + 50, backgroundColor: colors.surface, borderColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={onOpen}
        className="items-center justify-center overflow-hidden active:opacity-70"
        style={{ width: previewWidth, height: previewHeight, backgroundColor: colors.soft }}>
        {image && !failed ? (
          <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }}
            resizeMethod="resize" resizeMode={category === 'images' ? 'cover' : 'contain'} onError={() => setFailed(true)} />
        ) : preview?.type === 'slide' ? (
          <SlideCanvas slide={preview.slide} deckWidth={preview.width} deckHeight={preview.height} width={previewWidth} />
        ) : preview?.type === 'text' && preview.lines.length > 0 ? (
          <View className="h-full w-full gap-1 bg-white px-2 py-3">
            {preview.lines.map((line, index) => (
              <Text key={index} numberOfLines={2} allowFontScaling={false} style={{ fontSize: index === 0 ? 10 : 8,
                color: '#263242', fontWeight: index === 0 ? '700' : '400' }}>{line}</Text>
            ))}
          </View>
        ) : <Ionicons name={icon} size={34} color={colors.accent} />}
      </Pressable>
      <View className="flex-row items-center pl-2" style={{ height: 48 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={onOpen}
          className="min-h-12 flex-1 flex-row items-center gap-1.5 active:opacity-70">
          <Ionicons name={icon} size={15} color={colors.accent} />
          <Text numberOfLines={1} className="flex-1 text-sm font-semibold" style={{ color: colors.ink }}>{name}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Properties for ${name}`} onPress={onDetails}
          className="h-12 w-10 items-center justify-center active:opacity-70">
          <Ionicons name="information-circle-outline" size={22} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
