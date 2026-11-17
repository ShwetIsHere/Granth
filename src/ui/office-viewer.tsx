import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { File } from 'expo-file-system';
import type { WorkBook, WorkSheet } from 'xlsx';
import type { CsvWindow } from '../documents/csv-window';
import type { SelectedFile } from '../documents/files';
import { maxOfficeBytes } from '../documents/office-file';
import type { Presentation } from '../documents/presentation';
import type { WordSection } from '../documents/word';
import { useTheme } from '../theme/theme';
import { EmptyCard } from './components';
import { PresentationViewer } from './presentation-viewer';
import { WorkbookViewer } from './workbook-viewer';
import { WordViewer } from './word-viewer';

type Preview = { type: 'workbook'; book: WorkBook; loadSheet: (index: number) => Promise<WorkSheet | undefined> }
  | { type: 'csv'; csv: CsvWindow } | { type: 'presentation'; deck: Presentation } |
  { type: 'word'; sections: WordSection[] } | { type: 'error'; message: string };

export function OfficeViewer({ file }: { file: SelectedFile }) {
  const { colors } = useTheme();
  const [preview, setPreview] = useState<Preview>();

  useEffect(() => {
    let active = true;
    async function open() {
      if (file.extension === 'csv') {
        const { openCsv } = await import('../documents/csv-file');
        return { type: 'csv', csv: openCsv(file.id) } as const;
      }
      const source = new File(file.id);
      if ((file.size ?? source.size) > maxOfficeBytes) {
        return { type: 'error', message: 'In-app Office previews support files up to 32 MB.' } as const;
      }
      const bytes = await source.bytes();
      if (!active || !bytes.length) return;
      if (bytes.length > maxOfficeBytes) {
        return { type: 'error', message: 'In-app Office previews support files up to 32 MB.' } as const;
      }
      if (file.extension === 'pptx') {
        const { readPresentation } = await import('../documents/presentation');
        return { type: 'presentation', deck: readPresentation(bytes) } as const;
      }
      if (file.extension === 'docx') {
        const { readWord } = await import('../documents/word');
        return { type: 'word', sections: readWord(bytes) } as const;
      }
      const { readWorkbook } = await import('../documents/workbook');
      const { SheetNames } = readWorkbook(bytes, { bookSheets: true });
      const book: WorkBook = { SheetNames, Sheets: {} };
      return {
        type: 'workbook', book,
        loadSheet: async (index: number) => readWorkbook(await source.bytes(), { sheets: index }).Sheets[book.SheetNames[index]],
      } as const;
    }
    open().then(result => {
      if (active) setPreview(result ?? { type: 'error', message: 'The file is empty.' });
    }).catch(() => {
      if (active) setPreview({ type: 'error', message: 'The file may be inaccessible, damaged, or contain unsupported content.' });
    });
    return () => { active = false; };
  }, [file.extension, file.id, file.size]);

  if (preview?.type === 'workbook') return <WorkbookViewer book={preview.book} loadSheet={preview.loadSheet} uri={file.id} />;
  if (preview?.type === 'csv') return <WorkbookViewer csv={preview.csv} uri={file.id} />;
  if (preview?.type === 'presentation') return <PresentationViewer deck={preview.deck} />;
  if (preview?.type === 'word') return <WordViewer sections={preview.sections} />;
  return (
    <View className="flex-1 px-4">
      {preview?.type === 'error'
        ? <EmptyCard icon="alert-circle-outline" title="Could not preview file" description={preview.message + ' Try opening it in another app.'} />
        : <ActivityIndicator accessibilityLabel="Opening document" color={colors.accent} />}
    </View>
  );
}
