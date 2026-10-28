import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Appbar, List, Text } from 'react-native-paper';

import type { BookSource } from '../../../../src/types/book';

function parseSources(value: string): BookSource[] {
  try {
    const sources = JSON.parse(value) as unknown;
    return Array.isArray(sources) ? (sources as BookSource[]) : [];
  } catch {
    return [];
  }
}

export default function SourcesScreen() {
  const { source, bookId, sources } = useLocalSearchParams<{
    source: string;
    bookId: string;
    sources?: string;
  }>();
  const items = parseSources(sources ?? '[]');

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="切换来源" />
      </Appbar.Header>

      {items.length ? (
        items.map((item) => (
          <List.Item
            key={`${item.source}-${item.book_id}`}
            onPress={() =>
              router.replace({
                pathname: '/book/[source]/[bookId]',
                params: {
                  source: item.source,
                  bookId: item.book_id,
                  sources: sources ?? '[]',
                },
              })
            }
            right={() =>
              item.source === source && item.book_id === bookId ? (
                <List.Icon icon="check" />
              ) : null
            }
            title={item.source_name}
          />
        ))
      ) : (
        <Text style={styles.feedback}>没有可切换的来源</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  feedback: { alignSelf: 'center', marginTop: 24 },
});
