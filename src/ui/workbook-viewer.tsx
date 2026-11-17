import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, ScrollView, Text, View, VirtualizedList, type FlatListProps, type GestureResponderEvent } from 'react-native';
import { utils, type WorkBook, type WorkSheet } from 'xlsx';
import { cellText, maxWorksheetRows } from '../documents/workbook';
import { csvBuffer, type CsvRows, type CsvWindow } from '../documents/csv-window';
import { useTheme } from '../theme/theme';
import { readWorkbookLayout, saveWorkbookLayout, type SheetLayout, type WorkbookLayout } from '../storage/settings';
import { Choice, EmptyCard, IconButton } from './components';
import { SheetResizeHandle, type Dimension } from './sheet-resize-handle';

const columnsPerWindow = 20;
const defaultLayout: SheetLayout = { zoom: 1, columns: {}, rows: {} };
const limitZoom = (value: number) => Math.min(3, Math.max(0.5, value));

type Props =
  | { book: WorkBook; uri: string; loadSheet: (index: number) => Promise<WorkSheet | undefined>; csv?: never }
  | { csv: CsvWindow; uri: string; book?: never; loadSheet?: never };

function distance(event: GestureResponderEvent) {
  const [a, b] = event.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
}

export function WorkbookViewer({ book, uri, csv, loadSheet }: Props) {
  const { colors } = useTheme();
  const [sheetIndex, setSheet] = useState(0);
  const [columnOffset, setColumnOffset] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number>();
  const [selectedCell, setSelectedCell] = useState<{ address: string; value: string }>();
  const [layouts, setLayouts] = useState<WorkbookLayout>({});
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [readError, setReadError] = useState(false);
  const pinchScale = useMemo(() => new Animated.Value(1), []);
  const [csvRows, setCsvRows] = useState<CsvRows>();
  const [window, setWindow] = useState({ first: 0, last: 29 });
  const [loadedSheet, setLoadedSheet] = useState<{ index: number; sheet?: WorkSheet }>();
  const viewability = useRef({ itemVisiblePercentThreshold: 1 }).current;
  const pinch = useRef<{ distance: number; start: number; zoom: number } | undefined>(undefined);
  const zoomControls = useRef({ start: 1, commit: (_: number) => {} });
  const pending = useRef(Promise.resolve());
  const name = book?.SheetNames[sheetIndex] ?? 'CSV';
  const layout = Object.hasOwn(layouts, name) ? layouts[name] : defaultLayout;
  const zoom = layout.zoom;
  const onVisible = useRef<NonNullable<FlatListProps<number>['onViewableItemsChanged']>>(({ viewableItems }) => {
    if (!viewableItems.length) return;
    const first = Math.max(0, Number(viewableItems[0].item) - 1 - csvBuffer);
    const last = Number(viewableItems[viewableItems.length - 1].item) - 1 + csvBuffer;
    setWindow(current => current.first === first && current.last === last ? current : { first, last });
  }).current;

  useEffect(() => {
    let active = true;
    readWorkbookLayout(uri).then(saved => { if (active) setLayouts(saved); })
      .catch(() => { if (active) setSaveError(true); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [uri]);

  useEffect(() => {
    if (!csv) return;
    let active = true;
    const timer = setTimeout(() => {
      csv.window(window.first, window.last).then(result => {
        if (active) setCsvRows(result);
      }).catch(() => { if (active) setReadError(true); });
    }, 35);
    return () => { active = false; clearTimeout(timer); };
  }, [csv, window]);

  useEffect(() => {
    if (!loadSheet) return;
    let active = true;
    loadSheet(sheetIndex).then(sheet => {
      if (active) setLoadedSheet({ index: sheetIndex, sheet });
    }).catch(() => { if (active) setReadError(true); });
    return () => { active = false; };
  }, [loadSheet, sheetIndex]);

  function saveLayout(next: SheetLayout) {
    const updated = { ...layouts, [name]: next };
    setLayouts(updated);
    setSaveError(false);
    pending.current = pending.current.then(() => saveWorkbookLayout(uri, updated)).catch(() => setSaveError(true));
  }

  zoomControls.current = { start: layout.zoom, commit: value => saveLayout({ ...layout, zoom: limitZoom(value) }) };
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: event => distance(event) > 0,
    onMoveShouldSetPanResponderCapture: event => distance(event) > 0,
    onPanResponderGrant: event => {
      const start = zoomControls.current.start;
      pinch.current = { distance: distance(event), start, zoom: start };
      pinchScale.setValue(1);
    },
    onPanResponderMove: event => {
      const length = distance(event);
      const current = pinch.current;
      if (!current || !length) return;
      if (!current.distance) current.distance = length;
      current.zoom = limitZoom(current.start * length / current.distance);
      pinchScale.setValue(current.zoom / current.start);
    },
    onPanResponderRelease: () => {
      const current = pinch.current;
      pinch.current = undefined;
      pinchScale.setValue(1);
      if (current && current.zoom !== current.start) zoomControls.current.commit(current.zoom);
    },
    onPanResponderTerminate: () => {
      pinch.current = undefined;
      pinchScale.setValue(1);
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [pinchScale]);

  const sheet = loadedSheet?.index === sheetIndex ? loadedSheet.sheet : undefined;
  const ref = sheet?.['!ref'];
  const range = csv ? csvRows?.count && csvRows.columns ?
    { s: { r: 0, c: 0 }, e: { r: csvRows.count - 1, c: csvRows.columns - 1 } } : undefined :
    ref ? utils.decode_range(ref) : undefined;
  const lastColumn = range?.e.c ?? 0;
  const firstColumn = (range?.s.c ?? 0) + columnOffset;
  const rowStart = (range?.s.r ?? 0) + 1;
  const rowCount = range ? Math.min(csv ? Number.MAX_SAFE_INTEGER : maxWorksheetRows, range.e.r - range.s.r + 1) : 0;

  const columns = useMemo(() => Array.from({ length: Math.max(0, Math.min(columnsPerWindow, lastColumn - firstColumn + 1)) },
    (_, index) => {
      const column = firstColumn + index;
      const label = utils.encode_col(column);
      const meta = sheet?.['!cols']?.[column];
      const declared = meta?.wpx ?? (meta?.wch ? meta.wch * 8 : undefined);
      let suggested = csv ? 112 : 72;
      if (!declared && sheet && ref) {
        const { s, e } = utils.decode_range(ref);
        for (let row = s.r; row <= Math.min(e.r, s.r + 119) && suggested < 300; row++) {
          suggested = Math.max(suggested, Math.min(300, cellText(sheet, label + (row + 1)).length * 8 + 18));
        }
      }
      return { label, width: Math.max(35, Math.min(1200, declared || suggested)) };
    }), [csv, firstColumn, lastColumn, ref, sheet]);

  function handle(target: Dimension) {
    return <SheetResizeHandle target={target} zoom={zoom}
      onFinish={size => {
        if (size !== target.size) {
          saveLayout({ ...layout, [target.kind]: { ...layout[target.kind], [target.id]: size } });
        }
      }} />;
  }

  function renderCell(value: string, width: number, header = false, expanded = false, numeric = false) {
    return <Text numberOfLines={expanded ? undefined : 1} allowFontScaling={false}
      style={{ width: width * zoom, paddingHorizontal: 7 * zoom, paddingVertical: 5 * zoom, fontSize: 14 * zoom,
        color: colors.ink, textAlign: numeric ? 'right' : 'left', fontWeight: header ? '600' : '400' }}>{value}</Text>;
  }

  const sheetLoading = !!loadSheet && loadedSheet?.index !== sheetIndex;

  return (
    <View className="flex-1 gap-3 px-4 pb-3">
      {book && <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {book.SheetNames.map((label, index) => (
          <Choice key={label} label={label} selected={sheetIndex === index} onPress={() => {
            if (sheetIndex === index) return;
            setLoadedSheet(undefined); setReadError(false); setSheet(index); setColumnOffset(0);
            setExpandedRow(undefined); setSelectedCell(undefined);
          }} />
        ))}
      </ScrollView>}
      <Text className="text-xs" style={{ color: colors.muted }}>
        {`${Math.round(zoom * 100)}% · Pinch to zoom. Drag a header border to resize.`}
      </Text>
      {saveError && <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Could not save the worksheet layout.</Text>}
      {readError ? <EmptyCard icon="alert-circle-outline" title="Could not read worksheet" description="The file may be damaged or unavailable." /> :
        (!ready || (csv && !csvRows) || sheetLoading) ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading worksheet" /> :
        range ? <>
          {lastColumn - range.s.c >= columnsPerWindow && <View className="flex-row items-center gap-2">
            {columnOffset > 0 && <IconButton icon="chevron-back" label="Previous columns"
              onPress={() => setColumnOffset(columnOffset - columnsPerWindow)} />}
            <Text className="flex-1" style={{ color: colors.ink }}>{`Columns ${columns[0]?.label}–${columns.at(-1)?.label}`}</Text>
            {firstColumn + columnsPerWindow <= lastColumn && <IconButton icon="chevron-forward" label="Next columns"
              onPress={() => setColumnOffset(columnOffset + columnsPerWindow)} />}
          </View>}
          {sheet?.['!fullref'] && <Text style={{ color: colors.muted }}>Showing up to 10,000 rows of this worksheet.</Text>}
          <View className="flex-1 overflow-hidden" collapsable={false} {...gestures.panHandlers}>
            <Animated.View style={{ flex: 1, transform: [{ scale: pinchScale }] }}>
            <ScrollView horizontal nestedScrollEnabled
              className="flex-1" key={`${sheetIndex}-${columnOffset}`}>
              <View style={{ width: zoom * (44 + columns.reduce((total, column) =>
                total + (layout.columns[column.label] ?? column.width), 0)), flexShrink: 0 }}>
                <VirtualizedList data={rowCount} getItem={(_, index) => rowStart + index} getItemCount={() => rowCount}
                  keyExtractor={String} nestedScrollEnabled
                  onViewableItemsChanged={csv ? onVisible : undefined} viewabilityConfig={viewability}
                  initialNumToRender={10} maxToRenderPerBatch={8} windowSize={3} stickyHeaderIndices={[0]}
                  ListHeaderComponent={<View className="flex-row" style={{ backgroundColor: colors.soft }}>
                    {renderCell('#', 44, true)}
                    {columns.map(column => {
                      const width = layout.columns[column.label] ?? column.width;
                      return <View key={column.label}>
                        {renderCell(column.label, width, true)}
                        {handle({ kind: 'columns', id: column.label, size: width })}
                      </View>;
                    })}
                  </View>}
                  renderItem={({ item }) => {
                    const row = sheet?.['!rows']?.[item - 1];
                    const id = String(item);
                    const custom = layout.rows[id];
                    const height = custom ?? row?.hpx ?? (row?.hpt ? row.hpt * 4 / 3 : 32);
                    const displayed = height * zoom;
                    return <View className="flex-row" style={{
                      height: custom && expandedRow !== item ? displayed : undefined,
                      minHeight: displayed,
                    }}>
                      <View style={{ backgroundColor: colors.soft, borderBottomWidth: 1, borderColor: colors.border }}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`${expandedRow === item ? 'Collapse' : 'Expand'} row ${item}`}
                          onPress={() => setExpandedRow(expandedRow === item ? undefined : item)}>
                          {renderCell(id, 44, true)}
                        </Pressable>
                        {handle({ kind: 'rows', id, size: height })}
                      </View>
                      {columns.map((column, index) => {
                        const address = column.label + item;
                        const value = csv ? csvRows?.rows.get(item)?.[firstColumn + index] ?? '' : sheet ? cellText(sheet, address) : '';
                        return <Pressable key={address} accessibilityRole="button" accessibilityLabel={`${address} ${value}`}
                          onPress={() => setSelectedCell({ address, value })}
                          style={{ backgroundColor: selectedCell?.address === address ? colors.soft : colors.surface,
                            borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                          {renderCell(value, layout.columns[column.label] ?? column.width,
                            false, expandedRow === item, sheet?.[address]?.t === 'n')}
                        </Pressable>;
                      })}
                    </View>;
                  }} />
              </View>
            </ScrollView>
            </Animated.View>
          </View>
          {selectedCell && <View className="rounded-xl border px-3 py-2" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold" style={{ color: colors.ink }}>{selectedCell.address}</Text>
              <IconButton icon="close-outline" label="Close cell value" onPress={() => setSelectedCell(undefined)} />
            </View>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 140 }}>
              <Text selectable style={{ color: colors.ink }}>{selectedCell.value || 'Empty cell'}</Text>
            </ScrollView>
          </View>}
        </> : <EmptyCard icon="grid-outline" title="Empty worksheet" description="This worksheet has no cells to display." />}
    </View>
  );
}
