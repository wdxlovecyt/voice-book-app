import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import type { BookChapterContent } from '../types/book';

const INITIAL_SLIDE_PAGE_CHARACTERS = 240;

export type ReaderPage = {
  chapter: BookChapterContent;
  content: string;
  endOffset: number;
  id: string;
  isFirstPage: boolean;
  startOffset: number;
};

type SlideMeasurement = {
  page: ReaderPage;
  resolve: (pageId: string, measuredHeight: number) => void;
};

type PaginationCursor = {
  chapterIndex: number;
  end: number;
  start: number;
};

type SlideReaderOptions = {
  chapter: BookChapterContent | null;
  chapters: BookChapterContent[];
  currentChapterId: number;
  followChapter: (chapterId: number) => void;
  fontSize: number;
  initialOffset?: string;
  initialProgressUnit?: 'pixel' | 'ratio';
  onProgress: (chapterId: number, progress: number) => void;
  replaceChapter: (chapterId: number) => void;
  windowWidth: number;
};

function getChapterText(chapter: BookChapterContent) {
  return chapter.content.trim();
}

function createReaderPage(
  chapter: BookChapterContent,
  start: number,
  end: number,
): ReaderPage {
  const content = getChapterText(chapter);
  const contentLength = content.length;

  return {
    chapter,
    content: content.slice(start, end).trim(),
    endOffset: contentLength ? end / contentLength : 1,
    id: `${chapter.chapter_id}-${start}`,
    isFirstPage: start === 0,
    startOffset: contentLength ? start / contentLength : 0,
  };
}

function getInitialPaginationCursor(
  chapters: BookChapterContent[],
  startChapterId: number,
): PaginationCursor | null {
  if (!chapters.length) {
    return null;
  }

  const chapterIndex = chapters.findIndex(
    (item) => item.chapter_id === startChapterId,
  );
  const startingChapterIndex = chapterIndex >= 0 ? chapterIndex : 0;
  const contentLength = getChapterText(
    chapters[startingChapterIndex],
  ).length;

  return {
    chapterIndex: startingChapterIndex,
    end: Math.min(contentLength, INITIAL_SLIDE_PAGE_CHARACTERS),
    start: 0,
  };
}

function getNextPaginationCursor(
  chapters: BookChapterContent[],
  cursor: PaginationCursor,
): PaginationCursor | null {
  const currentContent = getChapterText(chapters[cursor.chapterIndex]);

  if (cursor.end < currentContent.length) {
    return {
      chapterIndex: cursor.chapterIndex,
      end: Math.min(
        currentContent.length,
        cursor.end + INITIAL_SLIDE_PAGE_CHARACTERS,
      ),
      start: cursor.end,
    };
  }

  const nextChapterIndex = cursor.chapterIndex + 1;

  if (nextChapterIndex >= chapters.length) {
    return null;
  }

  const nextContentLength = getChapterText(
    chapters[nextChapterIndex],
  ).length;

  return {
    chapterIndex: nextChapterIndex,
    end: Math.min(nextContentLength, INITIAL_SLIDE_PAGE_CHARACTERS),
    start: 0,
  };
}

function useMeasuredSlidePages(
  chapter: BookChapterContent | null,
  startChapterId: number,
  fontSize: number,
  pageHeight: number,
) {
  const chapters = useMemo(
    () => (chapter ? [chapter] : []),
    [chapter],
  );
  const [slidePages, setSlidePages] = useState<ReaderPage[]>([]);
  const [cursor, setCursor] = useState<PaginationCursor | null>(null);

  useEffect(() => {
    if (pageHeight <= 0 || !chapters.length) {
      setSlidePages([]);
      setCursor(null);

      return;
    }

    setSlidePages([]);
    setCursor(getInitialPaginationCursor(chapters, startChapterId));
  }, [chapters, fontSize, pageHeight, startChapterId]);

  const measuredPage = useMemo(() => {
    const currentChapter = cursor
      ? chapters[cursor.chapterIndex]
      : null;

    if (!cursor || !currentChapter) {
      return null;
    }

    return createReaderPage(
      currentChapter,
      cursor.start,
      cursor.end,
    );
  }, [chapters, cursor]);

  function resolveMeasuredPage(pageId: string, measuredHeight: number) {
    if (!cursor || !measuredPage || measuredPage.id !== pageId) {
      return;
    }

    const candidateLength = cursor.end - cursor.start;

    if (measuredHeight > pageHeight && candidateLength > 1) {
      const fittedLength = Math.max(
        1,
        Math.floor((candidateLength * pageHeight) / measuredHeight),
      );

      if (fittedLength < candidateLength) {
        setCursor({
          ...cursor,
          end: cursor.start + fittedLength,
        });

        return;
      }
    }

    setSlidePages((currentPages) => [...currentPages, measuredPage]);
    setCursor(getNextPaginationCursor(chapters, cursor));
  }

  return { measuredPage, resolveMeasuredPage, slidePages };
}

export function useSlideReader({
  chapter,
  chapters,
  currentChapterId,
  followChapter,
  fontSize,
  initialOffset,
  initialProgressUnit,
  onProgress,
  replaceChapter,
  windowWidth,
}: SlideReaderOptions) {
  const [slideViewportHeight, setSlideViewportHeight] = useState(0);
  const readingProgressRef = useRef(
    initialProgressUnit === 'ratio'
      ? Math.min(1, Math.max(0, Number(initialOffset) || 0))
      : 0,
  );
  const previousChapter = useMemo(
    () =>
      chapters.find((item) => item.chapter_id === currentChapterId - 1) ??
      null,
    [chapters, currentChapterId],
  );
  const nextChapter = useMemo(
    () =>
      chapters.find((item) => item.chapter_id === currentChapterId + 1) ??
      null,
    [chapters, currentChapterId],
  );
  const previousPages = useMeasuredSlidePages(
    previousChapter,
    previousChapter?.chapter_id ?? 0,
    fontSize,
    slideViewportHeight,
  );
  const currentPages = useMeasuredSlidePages(
    chapter,
    currentChapterId,
    fontSize,
    slideViewportHeight,
  );
  const nextPages = useMeasuredSlidePages(
    nextChapter,
    nextChapter?.chapter_id ?? 0,
    fontSize,
    slideViewportHeight,
  );
  const slidePages = useMemo(
    () => [
      ...previousPages.slidePages,
      ...currentPages.slidePages,
      ...nextPages.slidePages,
    ],
    [
      currentPages.slidePages,
      nextPages.slidePages,
      previousPages.slidePages,
    ],
  );
  const measurements = useMemo<SlideMeasurement[]>(
    () =>
      [previousPages, currentPages, nextPages].flatMap((pagination) =>
        pagination.measuredPage
          ? [
              {
                page: pagination.measuredPage,
                resolve: pagination.resolveMeasuredPage,
              },
            ]
          : [],
      ),
    [currentPages, nextPages, previousPages],
  );

  const initialSlidePageIndex = useMemo(() => {
    if (!chapter) {
      return 0;
    }

    return slidePages.findIndex(
      (page) =>
        page.chapter.chapter_id === chapter.chapter_id &&
        page.isFirstPage,
    );
  }, [chapter, slidePages]);

  function handleSlidePageChange(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    if (!chapter || !slidePages.length || windowWidth <= 0) {
      return;
    }

    const pageIndex = Math.max(
      0,
      Math.min(
        slidePages.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / windowWidth),
      ),
    );
    const page = slidePages[pageIndex];

    readingProgressRef.current = page.startOffset;
    onProgress(page.chapter.chapter_id, page.startOffset);

    if (
      pageIndex === slidePages.length - 1 &&
      page.endOffset === 1 &&
      page.chapter.chapter_id < page.chapter.total_chapters
    ) {
      readingProgressRef.current = 0;
      followChapter(page.chapter.chapter_id + 1);
    }
  }

  function jumpToChapter(nextChapterId: number) {
    readingProgressRef.current = 0;
    replaceChapter(nextChapterId);
  }

  return {
    handleSlidePageChange,
    hasInitialSlidePage: initialSlidePageIndex >= 0,
    initialSlidePageIndex,
    jumpToChapter,
    measurements,
    onViewportLayout: setSlideViewportHeight,
    slidePages,
  };
}
