export type BookSource = {
  book_id: string;
  source: string;
  source_name: string;
  source_url: string;
};

export type BookSearchResult = {
  title: string;
  author: string | null;
  cover: string | null;
  description: string | null;
  sources: BookSource[];
};

export type BookSearchData = {
  keyword: string;
  page: number;
  page_size: number;
  total: number;
  items: BookSearchResult[];
};

export type BookSearchResponse = {
  code: 0;
  message: 'success';
  data: BookSearchData;
};

export type ApibiIndexBook = {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  intro?: string;
  sortname?: string;
  lastchapterid?: string;
  lastchapter?: string;
  uptime?: string;
};

export type ApibiIndexData = {
  hotlist: ApibiIndexBook[];
  toplist: ApibiIndexBook[];
  sort1: ApibiIndexBook[];
  sort2: ApibiIndexBook[];
  sort3: ApibiIndexBook[];
  sort4: ApibiIndexBook[];
  sort5: ApibiIndexBook[];
  sort6: ApibiIndexBook[];
  uplist: ApibiIndexBook[];
  addlist: ApibiIndexBook[];
};

export type BookstoreSection = {
  id: string;
  title: string;
  books: ApibiIndexBook[];
};

export type ApibiSortBook = ApibiIndexBook & {
  cover: string;
};

export type ApibiSortData = {
  data: ApibiSortBook[];
};

export type BookDetail = {
  source: BookSource;
  title: string;
  author: string | null;
  cover: string | null;
  description: string | null;
  category: string | null;
  status: string | null;
  last_chapter: string | null;
  last_updated: string | null;
};

export type BookChapter = {
  chapter_id: number;
  title: string;
};

export type BookDetailResponse = {
  code: 0;
  message: 'success';
  data: BookDetail;
};

export type BookChapterListResponse = {
  code: 0;
  message: 'success';
  data: {
    source: BookSource;
    total: number;
    items: BookChapter[];
  };
};

export type BookChapterContent = {
  source: BookSource;
  chapter_id: number;
  title: string;
  content: string;
  total_chapters: number;
};

export type BookChapterResponse = {
  code: 0;
  message: 'success';
  data: BookChapterContent;
};
