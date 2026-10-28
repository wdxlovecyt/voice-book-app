import { Directory, File, Paths } from 'expo-file-system';

import type {
  BookChapter,
  BookChapterContent,
  BookChapterListResponse,
  BookDetail,
} from '../types/book';
import { splitLocalBook } from './localBookParser';

export const LOCAL_BOOK_SOURCE = 'local';
const LOCAL_BOOKS_DIRECTORY = new Directory(Paths.document, 'local-books');
type LocalBookIndex = { book: BookDetail; items: BookChapter[] };

function getSource(bookId: string) {
  return {
    source: LOCAL_BOOK_SOURCE,
    book_id: bookId,
    source_name: '本地导入',
    source_url: '',
  };
}

function getBookDirectory(bookId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(bookId)) throw new Error('本地书籍 ID 无效。');
  return new Directory(LOCAL_BOOKS_DIRECTORY, bookId);
}

function readIndex(bookId: string): LocalBookIndex {
  const file = new File(getBookDirectory(bookId), 'index.json');
  if (!file.exists) throw new Error('本地书籍索引不存在或已被移除。');
  return JSON.parse(file.textSync()) as LocalBookIndex;
}

export async function importLocalBook(
  fileName: string,
  rawContent: string,
): Promise<BookDetail> {
  const chapters = splitLocalBook(rawContent);
  let bookId: string;
  do {
    bookId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  } while (getBookDirectory(bookId).exists);

  const directory = getBookDirectory(bookId);
  directory.create({ intermediates: true });
  const book: BookDetail = {
    source: getSource(bookId),
    title: fileName.trim().replace(/\.txt$/i, '') || '未命名文本',
    author: null,
    cover: null,
    description: null,
    category: null,
    status: null,
    last_chapter: chapters[chapters.length - 1].title,
    last_updated: null,
  };

  try {
    const items: BookChapter[] = [];
    for (const [index, chapter] of chapters.entries()) {
      if (index % 25 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      const chapterId = index + 1;
      new File(directory, `${chapterId}.txt`).write(chapter.content);
      items.push({ chapter_id: chapterId, title: chapter.title });
    }
    // 全部章节写入成功后才发布目录，调用方随后加入书架。
    new File(directory, 'index.json').write(JSON.stringify({ book, items }));
    return book;
  } catch (error) {
    try { directory.delete(); } catch { /* 仅清理本次未完成的导入。 */ }
    throw error;
  }
}

export function isLocalBook(source: string) {
  return source === LOCAL_BOOK_SOURCE;
}

export async function getLocalBookDetail(bookId: string): Promise<BookDetail> {
  return readIndex(bookId).book;
}

export async function getLocalBookChapters(
  bookId: string,
): Promise<BookChapterListResponse['data']> {
  const { items } = readIndex(bookId);
  return { source: getSource(bookId), total: items.length, items };
}

export function getLocalBookChapterIds(bookId: string): Set<number> {
  try {
    const index = readIndex(bookId);
    const available = new Set(
      getBookDirectory(bookId).list()
        .filter((entry) => entry instanceof File && /^\d+\.txt$/.test(entry.name))
        .map((entry) => Number(entry.name.replace(/\.txt$/, ''))),
    );
    return new Set(index.items.map((item) => item.chapter_id).filter((id) => available.has(id)));
  } catch {
    return new Set();
  }
}

export async function getLocalBookChapter(
  bookId: string,
  chapterId: number,
): Promise<BookChapterContent> {
  if (!Number.isSafeInteger(chapterId) || chapterId < 1) {
    throw new Error('章节 ID 无效。');
  }
  const { items } = readIndex(bookId);
  const chapter = items.find((item) => item.chapter_id === chapterId);
  if (!chapter) throw new Error('该章节不存在。');
  const file = new File(getBookDirectory(bookId), `${chapterId}.txt`);
  if (!file.exists) throw new Error('本地章节文件不存在或已被移除。');
  return {
    source: getSource(bookId),
    ...chapter,
    content: await file.text(),
    total_chapters: items.length,
  };
}
