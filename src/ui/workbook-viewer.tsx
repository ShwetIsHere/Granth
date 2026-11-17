import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { utils, type WorkBook } from 'xlsx';
import { cellText, maxWorksheetRows } from '../documents/workbook';
import { useTheme } from '../theme/theme';
import { readWorkbookLayout, saveWorkbookLayout, type SheetLayout, type WorkbookLayout } from '../storage/settings';
import { Action, Choice, EmptyCard, IconButton } from './components';

const columnsPerWindow = 20;
const defaultLayout: SheetLayout = { zoom: 1, columns: {}, rows: {} };
const limitZoom = (value: number) => Math.min(3, Math.max(0.5, value));

type Dimension = { kind: 'columns' | 'rows'; id: string; size: number };

function ResizeDialog({ dimension, onClose, onSave, onReset }: {
  dimension: Dimension; onClose: () => void; onSave: (size: number) => void; onReset: () => void;
}) {
  const { colors } = useTheme();
  const [input, setInput] = useState(String(Math.round(dimension.size)));
  const size = Number(input);
  const row = dimension.kind === 'rows';
  const valid = Number.isInteger(size) && size >= (row ? 12 : 16) && size <= (row ? 600 : 1600);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-5">
        <View className="w-full max-w-sm gap-3 rounded-2xl p-5" style={{ backgroundColor: colors.surface }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold" style={{ color: colors.ink }}>
              {`Resize ${row ? 'row' : 'column'} ${dimension.id}`}
            </Text>
            <IconButton icon="close-outline" label="Cancel resize" onPress={onClose} />
          </View>
          <TextInput accessibilityLabel={row ? 'Row height' : 'Column width'} value={input} onChangeText={setInput}
            keyboardType="number-pad" selectTextOnFocus autoFocus className="rounded-xl border p-3 text-base"
            style={{ borderColor: colors.border, color: colors.ink }} />
          <Text style={{ color: colors.muted }}>{row ? '12–600 px' : '16–1600 px'}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Action label="Save size" icon="checkmark-outline" busy={!valid} onPress={() => onSave(size)} />
            <Choice label="Reset size" selected={false} onPress={onReset} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function WorkbookViewer({ book, uri }: { book: WorkBook; uri: string }) {
  const { colors } = useTheme();
  const [sheetIndex, setSheet] = useState(0);
  const [columnOffset, setColumnOffset] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number>();
  const [selectedCell, setSelectedCell] = useState<{ address: string; value: string }>();
  const [layouts, setLayouts] = useState<WorkbookLayout>({});
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [dimension, setDimension] = useState<Dimension>();
  const [pinchZoom, setPinchZoom] = useState<number>();
  const pinch = useRef<{ distance: number; start: number; zoom: number } | undefined>(undefined);
  const zoomControls = useRef({ start: 1, commit: (_: number) => {} });
  const pending = useRef(Promise.resolve());
  const name = book.SheetNames[sheetIndex];
  const layout = Object.hasOwn(layouts, name) ? layouts[name] : defaultLayout;
  const zoom = pinchZoom ?? layout.zoom;

  useEffect(() => {
    let active = true;
    readWorkbookLayout(uri).then(saved => { if (active) setLayouts(saved); })
      .catch(() => { if (active) setSaveError(true); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [uri]);

  function saveLayout(next: SheetLayout) {
    const updated = { ...layouts, [name]: next };
    setLayouts(updated);
    setSaveError(false);
    pending.current = pending.current.then(() => saveWorkbookLayout(uri, updated)).catch(() => setSaveError(true));
  }

  function setZoom(value: number) {
    saveLayout({ ...layout, zoom: limitZoom(value) });
  }
  zoomControls.current = { start: layout.zoom, commit: setZoom };

  function saveDimension(size?: number) {
    if (!dimension) return;
    const overrides = { ...layout[dimension.kind] };
    if (size === undefined) delete overrides[dimension.id];
    else overrides[dimension.id] = size;
    saveLayout({ ...layout, [dimension.kind]: overrides });
    setDimension(undefined);
  }

  function touchDistance(event: GestureResponderEvent) {
    const [a, b] = event.nativeEvent.touches;
    return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
  }

  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: event => touchDistance(event) > 0,
    onMoveShouldSetPanResponderCapture: event => touchDistance(event) > 0,
    onPanResponderGrant: event => {
      const start = zoomControls.current.start;
      pinch.current = { distance: touchDistance(event), start, zoom: start };
      setPinchZoom(start);
    },
    onPanResponderMove: event => {
      const distance = touchDistance(event);
      const active = pinch.current;
      if (!active || !active.distance || !distance) return;
      active.zoom = limitZoom(active.start * distance / active.distance);
      setPinchZoom(active.zoom);
    },
    onPanResponderRelease: () => {
      const active = pinch.current;
      pinch.current = undefined;
      setPinchZoom(undefined);
      if (active && active.zoom !== active.start) zoomControls.current.commit(active.zoom);
    },
    onPanResponderTerminate: () => {
      pinch.current = undefined;
      setPinchZoom(undefined);
    },
  }), []);
  const sheet = book.Sheets[name];
  const ref = sheet?.['!ref'];
  const range = ref ? utils.decode_range(ref) : undefined;
  const lastColumn = range?.e.c ?? 0;
  const firstColumn = (range?.s.c ?? 0) + columnOffset;
  const columns = useMemo(() => Array.from({ length: Math.max(0, Math.min(columnsPerWindow, lastColumn - firstColumn + 1)) },
    (_, index) => {
      const column = firstColumn + index;
      const label = utils.encode_col(column);
      const meta = sheet?.['!cols']?.[column];
      const declared = meta?.wpx ?? (meta?.wch ? meta.wch * 8 : undefined);
      let suggested = 72;
      if (!declared && sheet && ref) {
        const { s, e } = utils.decode_range(ref);
        for (let row = s.r; row <= Math.min(e.r, s.r + 119) && suggested < 300; row++) {
          const value = cellText(sheet, label + (row + 1));
          suggested = Math.max(suggested, Math.min(300, value.length * 8 + 18));
        }
      }
      return { label, width: Math.max(35, Math.min(1200, declared || suggested)) };
    }), [firstColumn, lastColumn, ref, sheet]);
  const rows = useMemo(() => {
    if (!ref) return [];
    const { s, e } = utils.decode_range(ref);
    return Array.from({ length: Math.max(0, Math.min(maxWorksheetRows, e.r - s.r + 1)) }, (_, index) => s.r + index + 1);
  }, [ref]);

  function renderCell(value: string, width: number, header = false, expanded = false, numeric = false) {
    return (
      <Text numberOfLines={expanded ? undefined : 1} allowFontScaling={false}
        style={{ width: width * zoom, paddingHorizontal: 7 * zoom, paddingVertical: 5 * zoom, fontSize: 14 * zoom,
        color: colors.ink, textAlign: numeric ? 'right' : 'left', fontWeight: header ? '600' : '400' }}>{value}</Text>
    );
  }

  if (!ready) return <ActivityIndicator className="flex-1" color={colors.accent} accessibilityLabel="Loading worksheet layout" />;

  return (
    <View className="flex-1 gap-3 px-4 pb-3">
      <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {book.SheetNames.map((label, index) => (
          <Choice key={label} label={label} selected={sheetIndex === index} onPress={() => {
            setSheet(index); setColumnOffset(0); setExpandedRow(undefined); setSelectedCell(undefined);
          }} />
        ))}
      </ScrollView>
      <View className="flex-row flex-wrap items-center gap-2">
        <IconButton icon="remove-outline" label="Zoom out" onPress={() => setZoom(layout.zoom - 0.25)} />
        <Choice label={`${Math.round(zoom * 100)}%`} selected={false} onPress={() => setZoom(1)} />
        <IconButton icon="add-outline" label="Zoom in" onPress={() => setZoom(layout.zoom + 0.25)} />
        <Text className="flex-1 text-xs" style={{ color: colors.muted }}>Tap a column letter or hold a row number to resize.</Text>
      </View>
      {saveError && <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Could not save the worksheet layout.</Text>}
      {range && (
        <>
          {lastColumn - (range.s.c ?? 0) >= columnsPerWindow && (
            <View className="flex-row items-center gap-2">
              {columnOffset > 0 && <IconButton icon="chevron-back" label="Previous columns"
                onPress={() => setColumnOffset(columnOffset - columnsPerWindow)} />}
              <Text className="flex-1" style={{ color: colors.ink }}>{`Columns ${columns[0]?.label}–${columns.at(-1)?.label}`}</Text>
              {firstColumn + columnsPerWindow <= lastColumn && <IconButton icon="chevron-forward" label="Next columns"
                onPress={() => setColumnOffset(columnOffset + columnsPerWindow)} />}
            </View>
          )}
          {sheet['!fullref'] && <Text style={{ color: colors.muted }}>Showing up to 10,000 rows of this worksheet.</Text>}
          <View className="flex-1" {...gestures.panHandlers}>
          <ScrollView horizontal nestedScrollEnabled scrollEnabled={pinchZoom === undefined}
            className="flex-1" key={`${sheetIndex}-${columnOffset}`}>
            <View style={{ width: zoom * (44 + columns.reduce((total, column) =>
              total + (layout.columns[column.label] ?? column.width), 0)), flexShrink: 0 }}>
              <FlatList data={rows} keyExtractor={String} nestedScrollEnabled scrollEnabled={pinchZoom === undefined}
                stickyHeaderIndices={[0]}
                ListHeaderComponent={<View className="flex-row" style={{ backgroundColor: colors.soft }}>
                  {renderCell('#', 44, true)}
                  {columns.map(column => {
                    const width = layout.columns[column.label] ?? column.width;
                    return <Pressable key={column.label} accessibilityRole="button" accessibilityLabel={`Resize column ${column.label}`}
                      onPress={() => setDimension({ kind: 'columns', id: column.label, size: width })}>
                      {renderCell(column.label, width, true)}
                    </Pressable>;
                  })}
                </View>}
                renderItem={({ item }) => {
                  const row = sheet['!rows']?.[item - 1];
                  const customHeight = layout.rows[String(item)];
                  const height = customHeight ?? row?.hpx ?? (row?.hpt ? row.hpt * 4 / 3 : 32);
                  return <View className="flex-row" style={{
                    height: customHeight && expandedRow !== item ? height * zoom : undefined,
                    minHeight: height * zoom, overflow: 'hidden',
                  }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${expandedRow === item ? 'Collapse' : 'Expand'} row ${item}`}
                      onPress={() => setExpandedRow(expandedRow === item ? undefined : item)}
                      onLongPress={() => setDimension({ kind: 'rows', id: String(item), size: height })}
                      accessibilityActions={[{ name: 'resize', label: 'Resize row' }]}
                      onAccessibilityAction={event => {
                        if (event.nativeEvent.actionName === 'resize') setDimension({ kind: 'rows', id: String(item), size: height });
                      }}
                      style={{ backgroundColor: colors.soft, borderBottomWidth: 1, borderColor: colors.border }}>
                      {renderCell(String(item), 44, true)}
                    </Pressable>
                    {columns.map(column => {
                      const address = column.label + item;
                      const value = cellText(sheet, address);
                      return <Pressable key={address} accessibilityRole="button" accessibilityLabel={`${address} ${value}`}
                        onPress={() => setSelectedCell({ address, value })}
                        style={{ backgroundColor: selectedCell?.address === address ? colors.soft : colors.surface,
                          borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
                        {renderCell(value, layout.columns[column.label] ?? column.width, false, expandedRow === item, sheet[address]?.t === 'n')}
                      </Pressable>;
                    })}
                  </View>;
                }} />
            </View>
          </ScrollView>
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
        </>
      )}
      {!range && <EmptyCard icon="grid-outline" title="Empty worksheet" description="This worksheet has no cells to display." />}
      {dimension && <ResizeDialog dimension={dimension} onClose={() => setDimension(undefined)}
        onSave={saveDimension} onReset={() => saveDimension()} />}
    </View>
  );
}
