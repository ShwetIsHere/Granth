import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { categories } from '../src/documents/formats';
import type { SelectedFile } from '../src/documents/files';
import { mergeFiles, searchFiles } from '../src/documents/search';
import { viewerRoute } from '../src/documents/viewer-route';
import { FileRow } from '../src/ui/file-row';
import { useResultPages } from '../src/ui/use-result-pages';
import { ResultFooter } from '../src/ui/result-footer';
import { useListCheckpoint } from '../src/ui/use-list-checkpoint';
import { useDiscovery, useLibrary } from '../src/state/library';
import { useTheme } from '../src/theme/theme';
import { Action, EmptyCard, IconButton, Screen, SearchField } from '../src/ui/components';

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  const files = useLibrary(state => state.files);
  const discovered = useDiscovery(state => state.files);
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const results = useMemo(() => searching ? searchFiles(mergeFiles(discovered, files), query) : [], [discovered, files, query, searching]);
  const { items, loadMore, loading, hasMore } = useResultPages(results, query);
  const checkpoint = useListCheckpoint<SelectedFile>(query, items.length, loadMore);

  return (
    <Screen>
      <FlatList
        ref={checkpoint.list}
        data={items}
        onScroll={checkpoint.onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={checkpoint.onContentSizeChange}
        ListFooterComponent={<ResultFooter loading={loading} hasMore={hasMore} onLoadMore={checkpoint.onLoadMore} />}
        keyExtractor={file => file.id}
        renderItem={({ item }) => <FileRow file={item}
          onOpen={() => router.push(viewerRoute(item.id))} />}
        contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-6">
            <View className="flex-row items-center gap-3">
              <Image source={require('../public/logo.png')} className="h-12 w-12 rounded-xl" />
              <Text accessibilityRole="header" className="flex-1 text-2xl font-bold tracking-widest" style={{ color: colors.ink }}>GRANTH</Text>
              <IconButton icon="contrast-outline" label="Appearance" onPress={() => router.push('/appearance')} />
            </View>

            <SearchField value={query} onChangeText={setQuery} />
            {!searching && (
              <>
                <View className="gap-3 rounded-3xl p-6" style={{ backgroundColor: colors.hero }}>
                  <Text accessibilityRole="header" className="text-3xl font-semibold" style={{ color: colors.heroText, fontFamily: 'serif' }}>
                    Every Document.{ '\n'}One Granth.
                  </Text>
                  <Text className="mb-2 text-base leading-6" style={{ color: colors.heroMuted }}>
                    Find documents on your phone and SD card.
                  </Text>
                  <Action label="Browse files" icon="folder-open-outline" onPress={() => router.push('/browse')} />
                </View>

                <View className="gap-3">
                  <Text accessibilityRole="header" className="text-xl font-bold" style={{ color: colors.ink }}>Formats</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {categories.filter(category => category.id !== 'images').map(category => (
                      <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={`Browse ${category.label}`}
                        onPress={() => router.push({ pathname: '/browse', params: { category: category.id } })}
                        className="min-h-20 grow basis-1/4 items-start justify-center gap-2 rounded-2xl border px-3 py-3 active:opacity-70"
                        style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                        <Ionicons name={category.icon} size={21} color={colors.accent} />
                        <Text className="text-sm font-semibold" style={{ color: colors.ink }}>{category.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

              </>
            )}
            {searching && <Text accessibilityRole="header" className="mb-3 text-xl font-bold" style={{ color: colors.ink }}>Matching files</Text>}
          </View>
        }
        ListEmptyComponent={searching
          ? <EmptyCard icon="search-outline" title="No matching files" description="Search includes discovered files and files you selected." />
          : undefined}
        ItemSeparatorComponent={() => <View className="h-2" />}
      />
    </Screen>
  );
}
