import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { categories } from '../src/documents/formats';
import { mergeFiles, searchFiles } from '../src/documents/search';
import { viewerRoute } from '../src/documents/viewer-route';
import { FileRow } from '../src/ui/file-row';
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

  return (
    <Screen>
      <FlatList
        data={results}
        keyExtractor={file => file.id}
        renderItem={({ item }) => <FileRow file={item}
          onOpen={() => router.push(viewerRoute(item.id))} />}
        contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-6">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.hero }}>
                <Ionicons name="book-outline" size={25} color={colors.gold} />
              </View>
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
                    {categories.map(category => (
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

                <View className="gap-3">
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text accessibilityRole="header" className="text-xl font-bold" style={{ color: colors.ink }}>Recently opened</Text>
                    <Text className="text-sm" style={{ color: colors.muted }}>0 documents</Text>
                  </View>
                  <EmptyCard icon="time-outline" title="No reading history" description="Opened documents will appear here when viewing is available." />
                </View>

                <View className="gap-3">
                  <Text accessibilityRole="header" className="text-xl font-bold" style={{ color: colors.ink }}>Favorites</Text>
                  <EmptyCard icon="star-outline" title="No favorites yet" description="Favorite documents will appear here once saving favorites is available." />
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
