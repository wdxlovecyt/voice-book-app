import { ScrollView, StyleSheet } from 'react-native';
import {
  ActivityIndicator,
  List,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BookChapter } from '../types/book';

type ChapterDirectorySheetProps = {
  chapters: BookChapter[];
  error: string | null;
  loading: boolean;
  onDismiss: () => void;
  onSelect: (chapterId: number) => void;
  visible: boolean;
};

export function ChapterDirectorySheet({
  chapters,
  error,
  loading,
  onDismiss,
  onSelect,
  visible,
}: ChapterDirectorySheetProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <Portal>
      <Modal
        contentContainerStyle={[
          styles.sheet,
          { paddingBottom: 12 + bottom },
        ]}
        onDismiss={onDismiss}
        style={styles.overlay}
        visible={visible}>
        <Text style={styles.title} variant="headlineSmall">
          目录
        </Text>
        {loading ? (
          <ActivityIndicator style={styles.feedback} />
        ) : error ? (
          <Text style={styles.feedback}>{error}</Text>
        ) : (
          <ScrollView>
            {chapters.map((chapter) => (
              <List.Item
                key={chapter.chapter_id}
                onPress={() => onSelect(chapter.chapter_id)}
                title={chapter.title}
              />
            ))}
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'flex-end',
    marginBottom: 0,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 12,
  },
  title: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feedback: {
    margin: 24,
  },
});
