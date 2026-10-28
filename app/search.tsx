import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Chip,
  List,
  Searchbar,
  Text,
} from 'react-native-paper';

import { searchBooks } from '../src/services/books';
import {
  getSearchHistory,
  saveSearchHistory,
} from '../src/services/searchHistory';
import type { BookSearchResult } from '../src/types/book';

export default function SearchScreen() {
  const { keyword: historyKeyword } = useLocalSearchParams<{
    keyword?: string;
  }>();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    void getSearchHistory().then(setSearchHistory);
  }, []);

  useEffect(() => {
    if (historyKeyword) {
      setKeyword(historyKeyword);
    }
  }, [historyKeyword]);

  async function handleSearch(searchKeyword = keyword) {
    const value = searchKeyword.trim();
    if (!value) {
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setError(null);
    void saveSearchHistory(value).then(setSearchHistory);

    try {
      const data = await searchBooks(value);
      setResults(data.items);
    } catch (requestError) {
      setResults([]);
      setError(
        requestError instanceof Error ? requestError.message : '书籍搜索失败。',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.Action
          accessibilityLabel="返回"
          icon="chevron-left"
          onPress={() => router.back()}
        />
        <Searchbar
          onChangeText={setKeyword}
          onIconPress={() => void handleSearch()}
          onSubmitEditing={() => void handleSearch()}
          placeholder="输入书名"
          returnKeyType="search"
          style={styles.headerSearchBar}
          value={keyword}
        />
      </Appbar.Header>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Text style={styles.feedback}>{error}</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.title}-${item.author ?? ''}`}
          ListEmptyComponent={
            hasSearched ? (
              <Text style={styles.feedback}>没有搜索结果</Text>
            ) : (
              <View style={styles.historySection}>
                <Text variant="titleMedium">历史搜索</Text>
                <View style={styles.historyList}>
                  {searchHistory.map((item) => (
                    <Chip
                      key={item}
                      mode="outlined"
                      onPress={() => {
                        setKeyword(item);
                        void handleSearch(item);
                      }}>
                      {item}
                    </Chip>
                  ))}
                  {!searchHistory.length ? (
                    <Text variant="bodyMedium">暂无搜索记录</Text>
                  ) : null}
                </View>
              </View>
            )
          }
          renderItem={({ item }) => (
            <List.Item
              description={[item.author, item.description]
                .filter(Boolean)
                .join('\n')}
              descriptionNumberOfLines={3}
              left={() =>
                item.cover ? (
                  <Image source={{ uri: item.cover }} style={styles.cover} />
                ) : (
                  <List.Icon icon="book-outline" />
                )
              }
              onPress={() => {
                const source = item.sources[0];
                if (source) {
                  router.push({
                    pathname: '/book/[source]/[bookId]',
                    params: {
                      source: source.source,
                      bookId: source.book_id,
                      sources: JSON.stringify(item.sources),
                    },
                  });
                }
              }}
              title={item.title}
              titleNumberOfLines={2}
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
  headerSearchBar: {
    flex: 1,
    marginRight: 12,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  feedback: {
    alignSelf: 'center',
    marginTop: 24,
  },
  cover: {
    borderRadius: 4,
    height: 72,
    marginHorizontal: 16,
    marginVertical: 8,
    width: 54,
  },
  historySection: {
    gap: 12,
    padding: 16,
  },
  historyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
