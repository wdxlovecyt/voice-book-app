import type {
  ApibiIndexData,
  ApibiSortBook,
  ApibiSortData,
  BookChapterContent,
  BookChapterListResponse,
  BookDetail,
  BookSearchData,
  BookstoreSection,
} from '../types/book';
import { getCachedApiChildNames, getApiData } from './http';
import {
  getLocalBookChapter,
  getLocalBookChapterIds,
  getLocalBookDetail,
  getLocalBookChapters,
  isLocalBook,
} from './localBooks';

const API_BASE_URL = 'https://huangwu.xin';
const APIBI_INDEX_URL = `${API_BASE_URL}/api/v1/books/apibi/index`;

export const APIBI_CATEGORIES = [
  { id: 'sort1', sortId: 'xuanhuan', title: '玄幻' },
  { id: 'sort2', sortId: 'wuxia', title: '武侠' },
  { id: 'sort3', sortId: 'dushi', title: '都市' },
  { id: 'sort4', sortId: 'lishi', title: '历史' },
  { id: 'sort5', sortId: 'wangyou', title: '网游' },
  { id: 'sort6', sortId: 'kehuan', title: '科幻' },
] as const;

function getBookChaptersUrl(source: string, bookId: string) {
  return `${API_BASE_URL}/api/v1/books/${encodeURIComponent(source)}/${encodeURIComponent(bookId)}/chapters`;
}

export async function searchBooks(keyword: string): Promise<BookSearchData> {
  const params = new URLSearchParams({
    keyword,
    page: '1',
    page_size: '20',
  });
  return getApiData<BookSearchData>(
    `${API_BASE_URL}/api/v1/books/search?${params.toString()}`,
    '书籍搜索失败',
  );
}

export async function getApibiBookstoreIndex(): Promise<BookstoreSection[]> {
  const response = await fetch(APIBI_INDEX_URL);

  if (!response.ok) {
    throw new Error(`书城内容获取失败：${response.status}`);
  }

  const data = (await response.json()) as ApibiIndexData;
  const categoryLists = [
    data.sort1,
    data.sort2,
    data.sort3,
    data.sort4,
    data.sort5,
    data.sort6,
  ];

  return [
    { id: 'hotlist', title: '热门推荐', books: data.hotlist },
    { id: 'toplist', title: '总榜', books: data.toplist },
    ...categoryLists.map((books, index) => ({
      id: APIBI_CATEGORIES[index]?.id ?? `sort${index + 1}`,
      title:
        APIBI_CATEGORIES[index]?.title ??
        books.find((book) => book.sortname)?.sortname ??
        `分类 ${index + 1}`,
      books,
    })),
    { id: 'uplist', title: '最近更新', books: data.uplist },
    { id: 'addlist', title: '新书上架', books: data.addlist },
  ].filter((section) => section.books.length);
}

export async function getApibiBookSort(
  sortId: string,
): Promise<ApibiSortBook[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/books/apibi/sort?sort=${encodeURIComponent(sortId)}`,
  );

  if (!response.ok) {
    throw new Error(`分类书籍获取失败：${response.status}`);
  }

  const data = (await response.json()) as ApibiSortData;
  return data.data;
}

export async function getBookDetail(
  source: string,
  bookId: string,
): Promise<BookDetail> {
  if (isLocalBook(source)) return getLocalBookDetail(bookId);

  return getApiData<BookDetail>(
    `${API_BASE_URL}/api/v1/books/${encodeURIComponent(source)}/${encodeURIComponent(bookId)}`,
    '书籍详情获取失败',
  );
}

export async function getBookChapters(source: string, bookId: string) {
  if (isLocalBook(source)) {
    return getLocalBookChapters(bookId);
  }

  return getApiData<BookChapterListResponse['data']>(
    getBookChaptersUrl(source, bookId),
    '目录获取失败',
    { cache: true },
  );
}

export function getCachedBookChapterIds(source: string, bookId: string) {
  if (isLocalBook(source)) {
    return getLocalBookChapterIds(bookId);
  }

  return new Set(
    getCachedApiChildNames(getBookChaptersUrl(source, bookId))
      .map(Number)
      .filter(Number.isInteger),
  );
}

export async function getBookChapter(
  source: string,
  bookId: string,
  chapterId: string,
): Promise<BookChapterContent> {
  if (isLocalBook(source)) {
    return getLocalBookChapter(bookId, Number(chapterId));
  }

  return getApiData<BookChapterContent>(
    `${getBookChaptersUrl(source, bookId)}/${encodeURIComponent(chapterId)}`,
    '正文获取失败',
    { cache: true },
  );
}
