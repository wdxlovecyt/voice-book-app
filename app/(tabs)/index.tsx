import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Searchbar,
  Text,
} from 'react-native-paper';

import {
  APIBI_CATEGORIES,
  getApibiBookstoreIndex,
} from '../../src/services/books';
import type { BookstoreSection } from '../../src/types/book';

const categoryDescriptions: Record<string, string> = {
  玄幻: '修炼超自然',
  武侠: '江湖快意恩仇',
  都市: '都市生活故事',
  历史: '穿越历史长河',
  网游: '虚拟世界冒险',
  科幻: '星海未来想象',
};

export default function HomeScreen() {
  const [sections, setSections] = useState<BookstoreSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function loadBookstore() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const nextSections = await getApibiBookstoreIndex();
      if (requestId === requestIdRef.current) {
        setSections(nextSections);
      }
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : '书城内容获取失败。',
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadBookstore();
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  const categorySections = useMemo(
    () => sections.filter((section) => section.id.startsWith('sort')),
    [sections],
  );

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.Content title="书城" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}>
          <View pointerEvents="none">
            <Searchbar
              editable={false}
              placeholder="搜索书名、作者"
              style={styles.searchBar}
              value=""
            />
          </View>
        </Pressable>

        {isLoading ? (
          <View style={styles.feedback}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.feedback}>
            <Text>{error}</Text>
            <Button mode="contained-tonal" onPress={() => void loadBookstore()}>
              重试
            </Button>
          </View>
        ) : (
          <View style={styles.categoryGrid}>
            {categorySections.map((section) => {
              const cover = section.books[0]?.cover;
              const categorySortId =
                APIBI_CATEGORIES.find((category) => category.id === section.id)
                  ?.sortId ?? section.id;

              return (
                <Card
                  key={section.id}
                  style={styles.categoryCard}
                  onPress={() =>
                    router.push({
                      pathname: '/category/[categoryId]',
                      params: {
                        categoryId: categorySortId,
                        title: section.title,
                      },
                    })
                  }>
                  <Card.Content style={styles.categoryCardContent}>
                    <View style={styles.categoryText}>
                      <Text numberOfLines={1} variant="titleMedium">
                        {section.title}
                      </Text>
                      <Text numberOfLines={2} variant="bodySmall">
                        {categoryDescriptions[section.title]}
                      </Text>
                    </View>
                    {cover ? (
                      <Image
                        source={{ uri: cover }}
                        style={styles.categoryCover}
                      />
                    ) : null}
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  searchBar: {
    borderRadius: 6,
    marginHorizontal: 16,
  },
  feedback: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  categoryGrid: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 12,
    width: '100%',
  },
  categoryCard: {
    height: 96,
    minWidth: 0,
    overflow: 'hidden',
    width: '48%',
  },
  categoryCardContent: {
    alignItems: 'stretch',
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  categoryText: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 8,
  },
  categoryCover: {
    height: '100%',
    width: 64,
  },
});
