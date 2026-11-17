import { useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { utils, type WorkBook } from 'xlsx';
import { cellText, maxWorksheetRows } from '../documents/workbook';
import { useTheme } from '../theme/theme';
import { Choice, EmptyCard, IconButton } from './components';

const columnWidth = 116;
const columnsPerWindow = 20;

export function WorkbookViewer({ book }: { book: WorkBook }) {
  const { colors } = useTheme();
  const [sheetIndex, setSheet] = useState(0);
  const [columnOffset, setColumnOffset] = useState(0);
  const name = book.SheetNames[sheetIndex];
  const sheet = book.Sheets[name];
  const ref = sheet?.['!ref'];
  const range = ref ? utils.decode_range(ref) : undefined;
  const lastColumn = range?.e.c ?? 0;
  const firstColumn = (range?.s.c ?? 0) + columnOffset;
  const columns = Array.from({ length: Math.min(columnsPerWindow, lastColumn - firstColumn + 1) },
    (_, index) => utils.encode_col(firstColumn + index));
  const rows = range ? Array.from({ length: Math.max(0, Math.min(maxWorksheetRows, range.e.r - range.s.r + 1)) },
    (_, index) => range.s.r + index + 1) : [];

  function renderCell(value: string, header = false, rowNumber = false) {
    return (
      <Text numberOfLines={1}
        style={{ width: rowNumber ? 48 : columnWidth, padding: 8, color: colors.ink, borderColor: colors.border,
          borderRightWidth: 1, borderBottomWidth: 1, backgroundColor: header ? colors.soft : colors.surface,
          fontWeight: header ? '600' : '400' }}>{value}</Text>
    );
  }

  return (
    <View className="flex-1 gap-3 px-4 pb-3">
      <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {book.SheetNames.map((label, index) => (
          <Choice key={label} label={label} selected={sheetIndex === index} onPress={() => { setSheet(index); setColumnOffset(0); }} />
        ))}
      </ScrollView>
      {range && (
        <>
          {lastColumn - (range.s.c ?? 0) >= columnsPerWindow && (
            <View className="flex-row items-center gap-2">
              {columnOffset > 0 && <IconButton icon="chevron-back" label="Previous columns"
                onPress={() => setColumnOffset(columnOffset - columnsPerWindow)} />}
              <Text className="flex-1" style={{ color: colors.ink }}>{`Columns ${columns[0]}–${columns.at(-1)}`}</Text>
              {firstColumn + columnsPerWindow <= lastColumn && <IconButton icon="chevron-forward" label="Next columns"
                onPress={() => setColumnOffset(columnOffset + columnsPerWindow)} />}
            </View>
          )}
          {sheet['!fullref'] && <Text style={{ color: colors.muted }}>Showing up to 10,000 rows of this worksheet.</Text>}
          <ScrollView horizontal nestedScrollEnabled key={`${sheetIndex}-${columnOffset}`}>
            <View style={{ width: 48 + columnWidth * columns.length, flexShrink: 0 }}>
              <FlatList data={rows} keyExtractor={String} nestedScrollEnabled
                stickyHeaderIndices={[0]}
                ListHeaderComponent={<View className="flex-row">{renderCell('#', true, true)}
                  {columns.map(column => <View key={column}>{renderCell(column, true)}</View>)}
                </View>}
                renderItem={({ item }) => (
                  <View className="flex-row">
                    {renderCell(String(item), true, true)}
                    {columns.map(column => (
                      <View key={column}>{renderCell(cellText(sheet, column + item))}</View>
                    ))}
                  </View>
                )} />
            </View>
          </ScrollView>
        </>
      )}
      {!range && <EmptyCard icon="grid-outline" title="Empty worksheet" description="This worksheet has no cells to display." />}
    </View>
  );
}
