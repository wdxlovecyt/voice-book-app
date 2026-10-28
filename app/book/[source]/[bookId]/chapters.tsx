import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  List,
  Searchbar,
  Text,
} from 'react-native-paper';

import { useBookshelf } from '../../../../src/contexts/bookshelf';
import {
  getBookChapters,
  getCachedBookChapterIds,
} from '../../../../src/services/books';
import type { BookChapter } from '../../../../src/types/book';

const CHAPTER_ITEM_HEIGHT = 56;

export default function ChaptersScreen() {
  const { source, bookId, sources, currentChapterId } = useLocalSearchParams<{
    source: string;
    bookId: string;
    sources?: string;
    currentChapterId?: string;
  }>();
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [cachedChapterIds, setCachedChapterIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isDescending, setIsDescending] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const { books } = useBookshelf();
  const bookshelfBook = books.find(
    (book) =>
      book.source.source === source && book.source.book_id === bookId,
  );
  const currentReadingChapterId =
    Number(currentChapterId) || bookshelfBook?.readingProgress.chapterId;
  const filteredChapters = chapters.filter((chapter) =>
    chapter.title
      .toLocaleLowerCase()
      .includes(searchKeyword.trim().toLocaleLowerCase()),
  );
  const displayedChapters = isDescending
    ? [...filteredChapters].reverse()
    : filteredChapters;
  const currentReadingChapterIndex = displayedChapters.findIndex(
    (chapter) => chapter.chapter_id === currentReadingChapterId,
  );

  useEffect(() => {
    async function loadChapters() {
      try {
        const data = await getBookChapters(source, bookId);
        setChapters(data.items);
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : '目录获取失败。',
        );
      }
    }

    void loadChapters();
  }, [bookId, source]);

  useEffect(() => {
    setCachedChapterIds(getCachedBookChapterIds(source, bookId));
  }, [bookId, source]);

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="目录" />
        <Appbar.Action
          accessibilityLabel={isDescending ? '正序' : '倒序'}
          icon={isDescending ? 'sort-ascending' : 'sort-descending'}
          onPress={() => setIsDescending((value) => !value)}
        />
      </Appbar.Header>

      <Searchbar
        onChangeText={setSearchKeyword}
        placeholder="搜索章节"
        style={styles.searchBar}
        value={searchKeyword}
      />

      {error ? (
        <Text style={styles.feedback}>{error}</Text>
      ) : chapters.length === 0 ? (
        <ActivityIndicator style={styles.feedback} />
      ) : (
        <FlatList
          data={displayedChapters}
          getItemLayout={(_, index) => ({
            index,
            length: CHAPTER_ITEM_HEIGHT,
            offset: CHAPTER_ITEM_HEIGHT * index,
          })}
          initialScrollIndex={
            currentReadingChapterIndex > 0
              ? currentReadingChapterIndex
              : undefined
          }
          keyExtractor={(item) => String(item.chapter_id)}
          ListEmptyComponent={
            <Text style={styles.feedback}>没有匹配章节</Text>
          }
          renderItem={({ item }) => (
            <List.Item
              onPress={() =>
                router.push({
                  pathname: '/book/[source]/[bookId]/reader',
                  params: {
                    source,
                    bookId,
                    chapterId: String(item.chapter_id),
                    sources: sources ?? '[]',
                  },
                })
              }
              style={styles.chapterItem}
              right={() =>
                cachedChapterIds.has(item.chapter_id) ? (
                  <Text style={styles.cachedLabel} variant="labelSmall">
                    已缓存
                  </Text>
                ) : null
              }
              title={item.title}
              titleNumberOfLines={1}
              titleStyle={[
                item.chapter_id === currentReadingChapterId
                  ? styles.readingChapter
                  : !cachedChapterIds.has(item.chapter_id)
                    ? styles.dimmedChapter
                    : undefined,
              ]}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBar: { margin: 12 },
  feedback: { alignSelf: 'center', marginTop: 24 },
  chapterItem: { height: CHAPTER_ITEM_HEIGHT },
  cachedLabel: {
    alignSelf: 'center',
    color: '#757575',
    marginRight: 16,
  },
  dimmedChapter: { color: '#9e9e9e' },
  readingChapter: { color: '#2196f3' },
});
