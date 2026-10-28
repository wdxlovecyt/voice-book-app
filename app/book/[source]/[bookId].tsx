import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Divider,
  Text,
} from 'react-native-paper';

import { useBookshelf } from '../../../src/contexts/bookshelf';
import { getBookDetail } from '../../../src/services/books';
import type { BookDetail } from '../../../src/types/book';

export default function BookDetailScreen() {
  const { source, bookId, sources } = useLocalSearchParams<{
    source: string;
    bookId: string;
    sources?: string;
  }>();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addBook, books, hasBook, removeBook } = useBookshelf();
  const savedProgress = books.find(
    (item) =>
      item.source.source === source &&
      item.source.book_id === bookId,
  )?.readingProgress;

  useEffect(() => {
    async function loadBook() {
      try {
        setBook(await getBookDetail(source, bookId));
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : '书籍详情获取失败。',
        );
      }
    }

    void loadBook();
  }, [bookId, source]);

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="书籍详情" />
      </Appbar.Header>

      {!book && !error ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Text style={styles.feedback}>{error}</Text>
      ) : book ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {book.cover ? (
              <Image source={{ uri: book.cover }} style={styles.cover} />
            ) : (
              <Avatar.Icon icon="book-outline" size={160} />
            )}

            <Text variant="headlineMedium">{book.title}</Text>
            {book.author ? (
              <Text variant="titleMedium">{book.author}</Text>
            ) : null}

            <View style={styles.sourceRow}>
              <Text variant="bodyLarge">来源：{book.source.source_name}</Text>
              <Button
                mode="text"
                onPress={() =>
                  router.push({
                    pathname: '/book/[source]/[bookId]/sources',
                    params: { source, bookId, sources: sources ?? '[]' },
                  })
                }>
                切换
              </Button>
            </View>

            <View style={styles.chapterRow}>
              <Text variant="bodyLarge">
                最新：{book.last_chapter ?? '暂无章节'}
              </Text>
              <Button
                mode="contained-tonal"
                onPress={() =>
                  router.push({
                    pathname: '/book/[source]/[bookId]/chapters',
                  params: { source, bookId, sources: sources ?? '[]' },
                  })
                }>
                查看目录
              </Button>
            </View>

            <Divider />
            <Text variant="headlineSmall">书籍简介</Text>
            <Text variant="bodyLarge">{book.description ?? '暂无简介'}</Text>
          </ScrollView>

          <View style={styles.actionBar}>
            <Button
              style={styles.actionButton}
              icon={
                hasBook(book.source.source, book.source.book_id)
                  ? 'bookshelf'
                  : 'plus'
              }
              mode="contained"
              onPress={() => {
                if (hasBook(book.source.source, book.source.book_id)) {
                  removeBook(book.source.source, book.source.book_id);
                } else {
                  addBook(book);
                }
              }}>
              {hasBook(book.source.source, book.source.book_id)
                ? '移出书架'
                : '加入书架'}
            </Button>
            <Button
              icon="book-open-page-variant"
              mode="contained-tonal"
              style={styles.actionButton}
              onPress={() =>
                router.push({
                  pathname: '/book/[source]/[bookId]/reader',
                  params: {
                    source,
                    bookId,
                    sources: sources ?? '[]',
                    ...(savedProgress
                      ? {
                          chapterId: String(savedProgress.chapterId),
                          initialOffset: String(savedProgress.offset),
                          initialProgressUnit:
                            savedProgress.offsetUnit ?? 'pixel',
                        }
                      : {}),
                  },
                })
              }>
              立即阅读
            </Button>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignItems: 'center', gap: 20, padding: 24 },
  cover: { borderRadius: 8, height: 240, width: 160 },
  sourceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  chapterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  actionButton: { flex: 1 },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  feedback: { alignSelf: 'center', marginTop: 24 },
});
