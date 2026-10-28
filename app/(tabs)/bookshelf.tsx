import { useState } from 'react';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Appbar, Avatar, Text } from 'react-native-paper';

import { useBookshelf } from '../../src/contexts/bookshelf';
import { isLocalBook } from '../../src/services/localBooks';

export default function BookshelfScreen() {
  const { addLocalBook, books } = useBookshelf();
  const [isImporting, setIsImporting] = useState(false);
  const items = [
    { type: 'import' as const },
    ...books.map((book) => ({ type: 'book' as const, book })),
  ];

  async function handleImport() {
    try {
      setIsImporting(true);
      const pickedFile = await DocumentPicker.getDocumentAsync({
        // Android 直接读取授权 URI，避免 Expo Go 的宿主缓存目录限制。
        copyToCacheDirectory: Platform.OS !== 'android',
        type: '*/*',
      });

      if (pickedFile.canceled) {
        return;
      }

      const asset = pickedFile.assets[0];
      if (!asset.name.trim().toLowerCase().endsWith('.txt')) {
        Alert.alert('仅支持 TXT 文件', '请选择扩展名为 .txt 的文本书籍。');
        return;
      }

      await addLocalBook(
        asset.name,
        await new File(asset.uri).text(),
      );
    } catch (error) {
      Alert.alert(
        '导入失败',
        error instanceof Error ? error.message : '无法读取该文本文件。',
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.Content title="书架" />
      </Appbar.Header>
      <FlatList
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) =>
          item.type === 'import'
            ? 'local-import'
            : `${item.book.source.source}-${item.book.source.book_id}`
        }
        numColumns={3}
        renderItem={({ item }) => (
          item.type === 'import' ? (
            <Pressable
              accessibilityLabel="导入本地 TXT 书籍"
              disabled={isImporting}
              onPress={() => void handleImport()}
              style={styles.bookCard}>
              <View style={[styles.coverPlaceholder, styles.importCover]}>
                {isImporting ? (
                  <ActivityIndicator />
                ) : (
                  <Avatar.Icon icon="plus" size={40} />
                )}
              </View>
              <Text numberOfLines={1} variant="titleSmall">
                导入本地书
              </Text>
              <Text numberOfLines={1} variant="bodySmall">
                免费畅听
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/book/[source]/[bookId]/reader',
                  params: {
                    source: item.book.source.source,
                    bookId: item.book.source.book_id,
                    chapterId: String(item.book.readingProgress.chapterId),
                    initialOffset: String(item.book.readingProgress.offset),
                    initialProgressUnit:
                      item.book.readingProgress.offsetUnit ?? 'pixel',
                  },
                })
              }
              style={styles.bookCard}>
              {isLocalBook(item.book.source.source) ? (
                <View style={styles.cover}>
                  <Image
                    source={require('../../assets/images/local-book-cover.png')}
                    resizeMode="contain"
                    style={{ width: '100%', height: '100%' }}
                  />
                  <Text style={styles.localBookTag}>本地书</Text>
                </View>
              ) : item.book.cover ? (
                <Image source={{ uri: item.book.cover }} style={styles.cover} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text variant="headlineMedium">📚</Text>
                </View>
              )}
              <Text numberOfLines={2} variant="titleSmall">
                {item.book.title}
              </Text>
              {item.book.author ? (
                <Text numberOfLines={1} variant="bodySmall">
                  {item.book.author}
                </Text>
              ) : null}
            </Pressable>
          )
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { padding: 12 },
  row: { gap: 12, justifyContent: 'flex-start', marginBottom: 16 },
  bookCard: { flex: 1, maxWidth: '31%' },
  cover: { borderRadius: 6, height: 150, marginBottom: 8, width: '100%' },
  coverPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 6,
    height: 150,
    justifyContent: 'center',
    marginBottom: 8,
  },
  localBookTag: {
    position: 'absolute',
    top: 16,
    right: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: '#dceee5',
    color: '#39765a',
    fontSize: 10,
    lineHeight: 14,
  },
  importCover: {
    backgroundColor: '#f3edf7',
    borderColor: '#79747e',
    borderStyle: 'dashed',
    borderWidth: 1,
  },
});
