import { useRef, useState } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';

import type { BookChapterContent } from '../types/book';

type ScrollReaderOptions = {
  bookId: string;
  chapter: BookChapterContent | null;
  chapters: BookChapterContent[];
  currentChapterId: number;
  followChapter: (chapterId: number) => void;
  onProgress: (chapterId: number, progress: number) => void;
  replaceChapter: (chapterId: number) => void;
  source: string;
};

export function useScrollReader({
  bookId: _bookId,
  chapter,
  chapters,
  currentChapterId,
  followChapter,
  onProgress,
  replaceChapter,
  source: _source,
}: ScrollReaderOptions) {
  const [contentKey, setContentKey] = useState(0);
  const [visibleChapter, setVisibleChapter] =
    useState<BookChapterContent | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const chapterLayoutRef = useRef<
    Record<number, { height: number; y: number }>
  >({});
  const scrollViewportHeightRef = useRef(0);
  const lastProgressUpdateRef = useRef(0);

  function follow(nextChapterId: number) {
    followChapter(nextChapterId);
  }

  function jumpToChapter(nextChapterId: number) {
    replaceChapter(nextChapterId);
    setContentKey((currentKey) => currentKey + 1);
  }

  function saveReadingProgress(
    currentChapter: BookChapterContent,
    chapterOffset: number,
    chapterHeight: number,
  ) {
    const chapterScrollableHeight = Math.max(
      0,
      chapterHeight - scrollViewportHeightRef.current,
    );
    const clampedChapterOffset = Math.max(
      0,
      Math.min(chapterScrollableHeight, chapterOffset),
    );
    const progress =
      chapterScrollableHeight > 0
        ? clampedChapterOffset / chapterScrollableHeight
        : 0;

    onProgress(currentChapter.chapter_id, progress);
  }

  function handleScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
    shouldSaveImmediately = false,
  ) {
    const { contentOffset, contentSize, layoutMeasurement } =
      event.nativeEvent;
    const scrolledChapter =
      chapters.reduce<BookChapterContent | null>(
        (lastVisibleChapter, item) => {
          const chapterLayout = chapterLayoutRef.current[item.chapter_id];

          return chapterLayout && chapterLayout.y <= contentOffset.y + 1
            ? item
            : lastVisibleChapter;
        },
        null,
      ) ?? chapter;
    const scrolledChapterLayout = scrolledChapter
      ? chapterLayoutRef.current[scrolledChapter.chapter_id]
      : null;

    if (scrolledChapter?.chapter_id !== visibleChapter?.chapter_id) {
      setVisibleChapter(scrolledChapter);
    }
    const previousChapter = chapters[0];

    if (
      chapter &&
      previousChapter &&
      previousChapter.chapter_id < chapter.chapter_id &&
      contentOffset.y <= 0
    ) {
      follow(previousChapter.chapter_id);
    }

    if (
      scrolledChapter &&
      scrolledChapterLayout &&
      (shouldSaveImmediately ||
        Date.now() - lastProgressUpdateRef.current >= 250)
    ) {
      lastProgressUpdateRef.current = Date.now();
      saveReadingProgress(
        scrolledChapter,
        contentOffset.y - scrolledChapterLayout.y,
        scrolledChapterLayout.height,
      );
    }

    if (
      chapter &&
      currentChapterId === chapter.chapter_id &&
      chapter.chapter_id < chapter.total_chapters &&
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 1
    ) {
      follow(chapter.chapter_id + 1);
    }
  }

  function onChapterLayout(
    chapterId: number,
    event: LayoutChangeEvent,
  ) {
    chapterLayoutRef.current[chapterId] = {
      height: event.nativeEvent.layout.height,
      y: event.nativeEvent.layout.y,
    };
  }

  function onViewportLayout(event: LayoutChangeEvent) {
    scrollViewportHeightRef.current = event.nativeEvent.layout.height;
  }

  return {
    contentKey,
    handleScroll,
    jumpToChapter,
    onChapterLayout,
    onViewportLayout,
    scrollViewRef,
    visibleChapter,
  };
}
