import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pickFiles } from '../src/documents/files';
import { categories, findCategory, type Category } from '../src/documents/formats';
import { searchFiles, type SortOrder } from '../src/documents/search';
import { useLibrary } from '../src/state/library';
import { useTheme } from '../src/theme/theme';
import { Action, Choice, EmptyCard, Screen, SearchField, ScreenHeading } from '../src/ui/components';
import { FileRow } from '../src/ui/file-row';

const sorts: { id: SortOrder; label: string }[] = [
  { id: 'recent', label: 'Date selected' },
  { id: 'name', label: 'Name' },
  { id: 'size', label: 'Size' },
];

export default function Browse() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { colors } = useTheme();
  const files = useLibrary(state => state.files);
  const add = useLibrary(state => state.add);
  const remove = useLibrary(state => state.remove);
  const [category, setCategory] = useState<Category | undefined>(findCategory(params.category)?.id);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('recent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const picking = useRef(false);
  const results = useMemo(() => searchFiles(files, query, category, sort), [files, query, category, sort]);

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
        data={results}
        keyExtractor={file => file.id}
        renderItem={({ item }) => <FileRow file={item} onRemove={() => remove(item.id)} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
            <View className="gap-3 rounded-3xl p-5" style={{ backgroundColor: colors.hero }}>
              <Text className="text-lg font-bold" style={{ color: colors.heroText }}>Files on your device</Text>
              <Text className="leading-5" style={{ color: colors.heroMuted }}>
                Choose files through your system picker. Your selection is kept for this session.
              </Text>
              <View className="flex-row items-center gap-3">
                <Action label={busy ? 'Opening picker…' : 'Choose files'} icon="folder-open-outline" onPress={selectFiles} busy={busy} />
                {busy && <ActivityIndicator color={colors.gold} />}
              </View>
            </View>
            {error !== '' && <EmptyCard icon="alert-circle-outline" title="Could not select files" description={error} />}
            <SearchField value={query} onChangeText={setQuery} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8 }}>
              <Choice label="All formats" selected={!category} onPress={() => setCategory(undefined)} />
              {categories.map(format => (
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
                Selected files · {results.length}
              </Text>
              <Text className="text-sm" style={{ color: colors.muted }}>Document previews arrive in later phases.</Text>
            </View>
          </View>
        }
        ListEmptyComponent={files.length === 0
          ? <EmptyCard icon="folder-outline" title="No files selected" description="Choose files to see their names, formats, and available details." />
          : <EmptyCard icon="search-outline" title="No matching files" description="Try a different name or format filter." />}
      />
    </Screen>
  );
}
