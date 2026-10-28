import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { File, Paths } from 'expo-file-system';

import { importLocalBook } from '../services/localBooks';
import type { BookDetail } from '../types/book';

type ReadingProgress = {
  chapterId: number;
  offset: number;
  offsetUnit?: 'ratio';
};

export type BookshelfBook = BookDetail & {
  readingProgress: ReadingProgress;
};

type BookshelfContextValue = {
  books: BookshelfBook[];
  addBook: (book: BookDetail) => void;
  addLocalBook: (fileName: string, content: string) => Promise<void>;
  removeBook: (source: string, bookId: string) => void;
  hasBook: (source: string, bookId: string) => boolean;
  updateReadingProgress: (
    source: string,
    bookId: string,
    chapterId: number,
    offset: number,
  ) => void;
};

const BookshelfContext = createContext<BookshelfContextValue | null>(null);
const STORAGE_FILE_NAME = 'bookshelf.json';

export function BookshelfProvider({ children }: PropsWithChildren) {
  const [books, setBooks] = useState<BookshelfBook[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadBookshelf() {
      try {
        const storageFile = new File(Paths.document, STORAGE_FILE_NAME);

        if (!storageFile.exists) {
          return;
        }

        const savedData = JSON.parse(await storageFile.text()) as {
          books?: BookshelfBook[];
        };

        if (isCurrentRequest && Array.isArray(savedData.books)) {
          setBooks(savedData.books);
        }
      } catch {
        // 书架文件损坏或读取失败时，以空书架继续运行。
      } finally {
        if (isCurrentRequest) {
          setIsStorageLoaded(true);
        }
      }
    }

    void loadBookshelf();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  useEffect(() => {
    if (!isStorageLoaded) {
      return;
    }

    const writeTimer = setTimeout(() => {
      try {
        const storageFile = new File(Paths.document, STORAGE_FILE_NAME);

        if (!storageFile.exists) {
          storageFile.create({ intermediates: true });
        }

        storageFile.write(JSON.stringify({ books }));
      } catch {
        // 写入失败不阻断书架和阅读功能。
      }
    }, 400);

    return () => {
      clearTimeout(writeTimer);
    };
  }, [books, isStorageLoaded]);

  const value = useMemo(
    () => ({
      books,
      addBook: (book: BookDetail) => {
        setBooks((currentBooks) =>
          currentBooks.some(
            (currentBook) =>
              currentBook.source.source === book.source.source &&
              currentBook.source.book_id === book.source.book_id,
          )
            ? currentBooks
            : [
                ...currentBooks,
                {
                  ...book,
                  readingProgress: {
                    chapterId: 1,
                    offset: 0,
                    offsetUnit: 'ratio',
                  },
                },
              ],
        );
      },
      addLocalBook: async (fileName: string, content: string) => {
        const book = await importLocalBook(fileName, content);

        setBooks((currentBooks) => [
          ...currentBooks,
          {
            ...book,
            readingProgress: {
              chapterId: 1,
              offset: 0,
              offsetUnit: 'ratio',
            },
          },
        ]);
      },
      removeBook: (source: string, bookId: string) => {
        setBooks((currentBooks) =>
          currentBooks.filter(
            (book) =>
              book.source.source !== source || book.source.book_id !== bookId,
          ),
        );
      },
      hasBook: (source: string, bookId: string) =>
        books.some(
          (book) =>
            book.source.source === source && book.source.book_id === bookId,
        ),
      updateReadingProgress: (
        source: string,
        bookId: string,
        chapterId: number,
        offset: number,
      ) => {
        setBooks((currentBooks) =>
          currentBooks.map((book) => {
            if (
              book.source.source !== source ||
              book.source.book_id !== bookId
            ) {
              return book;
            }

            const readingProgress = {
              chapterId: Math.max(1, chapterId),
              offset: Math.min(1, Math.max(0, offset)),
              offsetUnit: 'ratio' as const,
            };

            if (
              book.readingProgress.chapterId === readingProgress.chapterId &&
              book.readingProgress.offset === readingProgress.offset &&
              book.readingProgress.offsetUnit === readingProgress.offsetUnit
            ) {
              return book;
            }

            return { ...book, readingProgress };
          }),
        );
      },
    }),
    [books],
  );

  return (
    <BookshelfContext.Provider value={value}>
      {children}
    </BookshelfContext.Provider>
  );
}

export function useBookshelf() {
  const context = useContext(BookshelfContext);

  if (!context) {
    throw new Error('useBookshelf 必须在 BookshelfProvider 内使用。');
  }

  return context;
}
