import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View, useWindowDimensions, type FlatListProps } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { pickFiles, type SelectedFile } from '../src/documents/files';
import { categories, findCategory, type Category } from '../src/documents/formats';
import { mergeFiles, searchFiles, type SortOrder } from '../src/documents/search';
import { nativeStorage } from '../src/documents/native-storage';
import { viewerRoute } from '../src/documents/viewer-route';
import { useDiscovery, useLibrary } from '../src/state/library';
import { useTheme } from '../src/theme/theme';
import { Action, Choice, EmptyCard, Screen, SearchField, ScreenHeading } from '../src/ui/components';
import { FileGridCard } from '../src/ui/file-grid-card';
import { FileProperties } from '../src/ui/file-properties';
import { useResultPages } from '../src/ui/use-result-pages';
import { ResultFooter } from '../src/ui/result-footer';

const sorts: { id: SortOrder; label: string }[] = [
  { id: 'recent', label: 'Date' },
  { id: 'name', label: 'Name' },
  { id: 'size', label: 'Size' },
];

export default function Browse() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const slotWidth = Math.max(1, (Math.min(width, 680) - 40) / 2);
  const picked = useLibrary(state => state.files);
  const discovered = useDiscovery(state => state.files);
  const discoveryStatus = useDiscovery(state => state.status);
  const refresh = useDiscovery(state => state.refresh);
  const files = useMemo(() => mergeFiles(discovered, picked), [discovered, picked]);
  const add = useLibrary(state => state.add);
  const remove = useLibrary(state => state.remove);
  const [category, setCategory] = useState<Category | undefined>(() =>
    params.category === 'images' ? undefined : findCategory(params.category)?.id);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('recent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<SelectedFile>();
  const [visibleFiles, setVisibleFiles] = useState<Set<string>>(() => new Set());
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const updateVisibility = useRef<NonNullable<FlatListProps<SelectedFile>['onViewableItemsChanged']>>(({ viewableItems }) => {
    setVisibleFiles(new Set(viewableItems.map(entry => (entry.item as SelectedFile).id)));
  }).current;
  const viewability = useRef({ itemVisiblePercentThreshold: 20 }).current;
  const picking = useRef(false);
  const results = useMemo(() => searchFiles(files, query, category, sort), [files, query, category, sort]);
  const criteria = JSON.stringify([query, category, sort]);
  const { items, loadMore, loading, hasMore } = useResultPages(results, criteria);
  const list = useRef<FlatList<SelectedFile>>(null);
  const previousCriteria = useRef(criteria);
  useEffect(() => {
    if (previousCriteria.current !== criteria) list.current?.scrollToOffset({ offset: 0, animated: false });
    previousCriteria.current = criteria;
  }, [criteria]);

  function openFile(id: string) {
    router.push(viewerRoute(id));
  }

  async function requestAccess() {
    setError('');
    try {
      await nativeStorage?.requestAccess();
    } catch {
      setError('Could not open Android storage settings.');
    }
  }

  async function selectFiles() {
    if (picking.current) return;
    picking.current = true;
    setBusy(true);
    setError('');
    try {
      const selected = await pickFiles();
      if (selected?.length) {
        add(selected);
        setQuery('');
        if (!selected.every(file => file.category === category)) setCategory(undefined);
        if (selected.length === 1) openFile(selected[0].id);
      }
    } catch {
      setError('The system picker could not return your files. Try selecting them again.');
    } finally {
      picking.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeading title="Browse files" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <FlatList
        ref={list}
        data={items}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        removeClippedSubviews={false}
        ListFooterComponent={<ResultFooter loading={loading} hasMore={hasMore} onLoadMore={loadMore} />}
        numColumns={2}
        keyExtractor={file => file.id}
        onViewableItemsChanged={updateVisibility}
        viewabilityConfig={viewability}
        renderItem={({ item }) => (
          <View style={{ width: slotWidth, paddingHorizontal: 4 }}>
            <FileGridCard width={Math.max(1, slotWidth - 8)} file={item} visible={focused && visibleFiles.has(item.id)} onOpen={() => openFile(item.id)}
              onDetails={() => setDetails(item)} />
          </View>
        )}
        windowSize={5}
        refreshing={discoveryStatus === 'loading'}
        onRefresh={discoveryStatus === 'ready' || discoveryStatus === 'loading' || discoveryStatus === 'error'
          ? () => void refresh() : undefined}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
            <View className="gap-3 rounded-3xl p-5" style={{ backgroundColor: colors.hero }}>
              <Text className="text-lg font-bold" style={{ color: colors.heroText }}>Files on your device</Text>
              <Text className="leading-5" style={{ color: colors.heroMuted }}>
                {discoveryStatus === 'unavailable'
                  ? 'Automatic discovery requires the GRANTH Android build on Android 11 or later.'
                  : discoveryStatus === 'permission'
                    ? 'Allow access once to discover files in shared phone storage and on your SD card.'
                    : 'Browse shared phone storage and any mounted SD card.'}
              </Text>
              <View className="flex-row items-center gap-3">
                <Action label={busy ? 'Opening picker…' : 'Choose files'} icon="folder-open-outline" onPress={selectFiles} busy={busy} />
                {busy && <ActivityIndicator color={colors.gold} />}
              </View>
              {discoveryStatus === 'permission' &&
                <Action label="Allow storage access" icon="lock-open-outline" onPress={requestAccess} />}
            </View>
            {error !== '' && <EmptyCard icon="alert-circle-outline" title="Storage access" description={error} />}
            {discoveryStatus === 'loading' && <ActivityIndicator accessibilityLabel="Scanning storage" color={colors.accent} />}
            {discoveryStatus === 'error' && (
              <View className="gap-2">
                <EmptyCard icon="alert-circle-outline" title="Scan failed" description="Check that your storage is mounted and try again." />
                <Action label="Scan again" icon="refresh-outline" onPress={() => void refresh()} />
              </View>
            )}
            <SearchField value={query} onChangeText={setQuery} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8 }}>
              <Choice label="All formats" selected={!category} onPress={() => setCategory(undefined)} />
              {categories.filter(format => format.id !== 'images').map(format => (
                <Choice key={format.id} label={format.label} selected={category === format.id} onPress={() => setCategory(format.id)} />
              ))}
            </ScrollView>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="mr-1 text-sm" style={{ color: colors.muted }}>Sort by</Text>
              {sorts.map(option => (
                <Choice key={option.id} label={option.label} selected={sort === option.id} onPress={() => setSort(option.id)} />
              ))}
            </View>
            <View className="gap-1">
              <Text accessibilityRole="header" className="text-xl font-bold" style={{ color: colors.ink }}>
                Files · {results.length}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={discoveryStatus === 'loading' ? undefined : files.length === 0
          ? <EmptyCard icon="folder-outline" title="No files to show" description={
            discoveryStatus === 'permission' ? 'Allow storage access or choose individual files.' : 'Use Choose files to select a document.'
          } />
          : <EmptyCard icon="search-outline" title="No matching files" description="Try a different name or format filter." />}
      />
      {details && <FileProperties key={details.id} file={details} onClose={() => setDetails(undefined)}
        onRenamed={setDetails}
        onRemove={details.location ? undefined : () => { remove(details.id); setDetails(undefined); }} />}
    </Screen>
  );
}
