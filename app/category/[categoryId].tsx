import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  List,
  Text,
} from 'react-native-paper';

import { getApibiBookSort } from '../../src/services/books';
import type { ApibiSortBook } from '../../src/types/book';

export default function CategoryBooksScreen() {
  const { categoryId, title } = useLocalSearchParams<{
    categoryId: string;
    title?: string;
  }>();
  const [books, setBooks] = useState<ApibiSortBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function loadBooks() {
    if (!categoryId) {
      setError('分类参数缺失。');
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const nextBooks = await getApibiBookSort(categoryId);
      if (requestId === requestIdRef.current) {
        setBooks(nextBooks);
      }
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : '分类书籍获取失败。',
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadBooks();

    return () => {
      requestIdRef.current += 1;
    };
  }, [categoryId]);

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={title ?? '分类书籍'} />
      </Appbar.Header>

      {isLoading ? (
        <View style={styles.feedback}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.feedback}>
          <Text>{error}</Text>
          <Button mode="contained-tonal" onPress={() => void loadBooks()}>
            重试
          </Button>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(book) => book.id}
          ListEmptyComponent={<Text style={styles.feedback}>暂无书籍</Text>}
          renderItem={({ item }) => (
            <List.Item
              title={item.title}
              titleNumberOfLines={2}
              description={[item.author, item.lastchapter, item.intro]
                .filter(Boolean)
                .join('\n')}
              descriptionNumberOfLines={4}
              left={() =>
                item.cover ? (
                  <Image source={{ uri: item.cover }} style={styles.cover} />
                ) : (
                  <Avatar.Icon icon="book-outline" size={96} />
                )
              }
              onPress={() =>
                router.push({
                  pathname: '/book/[source]/[bookId]',
                  params: {
                    source: 'apibi',
                    bookId: item.id,
                  },
                })
              }
              style={styles.bookItem}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  feedback: {
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  bookItem: {
    minHeight: 132,
  },
  cover: {
    borderRadius: 6,
    height: 112,
    marginHorizontal: 16,
    marginVertical: 10,
    width: 80,
  },
});
