import { useEffect, useState } from 'react';

import { getBookChapter } from '../services/books';
import type { BookChapterContent } from '../types/book';

type ReaderChaptersOptions = {
  bookId: string;
  initialChapterId?: string;
  source: string;
};

export function useReaderChapters({
  bookId,
  initialChapterId,
  source,
}: ReaderChaptersOptions) {
  const [currentChapterId, setCurrentChapterId] = useState(() =>
    Math.max(1, Number(initialChapterId) || 1),
  );
  const [chapter, setChapter] = useState<BookChapterContent | null>(null);
  const [chapters, setChapters] = useState<BookChapterContent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadChapters() {
      setError(null);

      try {
        const currentChapter = await getBookChapter(
          source,
          bookId,
          String(currentChapterId),
        );
        if (!isCurrentRequest) {
          return;
        }

        setChapter(currentChapter);
        setChapters([currentChapter]);

        const adjacentIds = [
          currentChapter.chapter_id - 1,
          currentChapter.chapter_id + 1,
        ].filter(
          (chapterId) =>
            chapterId >= 1 &&
            chapterId <= currentChapter.total_chapters,
        );
        void Promise.all(
          adjacentIds.map((chapterId) =>
            getBookChapter(source, bookId, String(chapterId)),
          ),
        )
          .then((adjacentChapters) => {
            if (!isCurrentRequest) {
              return;
            }

            setChapters(
              [...adjacentChapters, currentChapter].sort(
                (left, right) => left.chapter_id - right.chapter_id,
              ),
            );
          })
          .catch(() => {
            // 相邻章节失败不影响当前章阅读。
          });
      } catch (requestError) {
        if (isCurrentRequest) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : '正文获取失败。',
          );
        }
      }
    }

    void loadChapters();

    return () => {
      isCurrentRequest = false;
    };
  }, [bookId, currentChapterId, source]);

  function followChapter(nextChapterId: number) {
    setCurrentChapterId(nextChapterId);
  }

  function replaceChapter(nextChapterId: number) {
    const targetChapter = chapters.find(
      (item) => item.chapter_id === nextChapterId,
    );

    if (targetChapter) {
      setChapter(targetChapter);
      setChapters([targetChapter]);
    }
    setCurrentChapterId(nextChapterId);
  }

  return {
    chapter,
    chapters,
    currentChapterId,
    error,
    followChapter,
    replaceChapter,
  };
}
