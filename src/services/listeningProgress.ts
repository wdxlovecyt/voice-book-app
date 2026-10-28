import { File, Paths } from 'expo-file-system';

export type NarrationMode = 'single' | 'multi';

export type ListeningProgress = {
  source: string;
  bookId: string;
  chapterId: string;
  segmentIndex: number;
  segmentTime: number;
  roleVoices: Record<string, string>;
  narrationMode: NarrationMode;
  singleVoice: string;
  updatedAt: number;
};

type ListeningProgressStore = {
  books: Record<string, ListeningProgress>;
};

const progressFile = new File(Paths.document, 'listening-progress.json');

function getBookKey(source: string, bookId: string) {
  return `${source}:${bookId}`;
}

function normalizeRoleVoices(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([speaker, voice]) =>
        typeof speaker === 'string' && typeof voice === 'string',
    ),
  );
}

function normalizeNarrationMode(value: unknown): NarrationMode {
  return value === 'single' ? 'single' : 'multi';
}

function normalizeSingleVoice(value: unknown) {
  return typeof value === 'string' ? value : 'zh-CN-XiaoxiaoNeural';
}

function normalizeListeningProgress(value: unknown): ListeningProgress | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const progress = value as Record<string, unknown>;

  if (
    typeof progress.source !== 'string' ||
    typeof progress.bookId !== 'string' ||
    typeof progress.chapterId !== 'string' ||
    typeof progress.segmentIndex !== 'number' ||
    typeof progress.segmentTime !== 'number' ||
    typeof progress.updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    source: progress.source,
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    segmentIndex: progress.segmentIndex,
    segmentTime: progress.segmentTime,
    roleVoices: normalizeRoleVoices(progress.roleVoices),
    narrationMode: normalizeNarrationMode(progress.narrationMode),
    singleVoice: normalizeSingleVoice(progress.singleVoice),
    updatedAt: progress.updatedAt,
  };
}

async function readStore(): Promise<ListeningProgressStore> {
  if (!progressFile.exists) {
    return { books: {} };
  }

  try {
    const value = JSON.parse(await progressFile.text()) as {
      books?: Record<string, unknown>;
    };
    const books = Object.fromEntries(
      Object.entries(value.books ?? {}).flatMap(([key, value]) => {
        const progress = normalizeListeningProgress(value);

        return progress ? [[key, progress]] : [];
      }),
    ) as Record<string, ListeningProgress>;

    return { books };
  } catch {
    return { books: {} };
  }
}

export async function loadBookListeningProgress(
  source: string,
  bookId: string,
) {
  const store = await readStore();

  return store.books[getBookKey(source, bookId)] ?? null;
}

export async function loadLatestListeningProgress() {
  const store = await readStore();

  return (
    Object.values(store.books).sort(
      (first, second) => second.updatedAt - first.updatedAt,
    )[0] ?? null
  );
}

export async function saveBookListeningProgress(
  progress: ListeningProgress,
) {
  const store = await readStore();

  store.books[getBookKey(progress.source, progress.bookId)] = progress;

  if (!progressFile.exists) {
    progressFile.create();
  }

  progressFile.write(JSON.stringify(store));
}

export async function saveBookRoleVoices(
  target: Pick<ListeningProgress, 'source' | 'bookId' | 'chapterId'>,
  roleVoices: Record<string, string>,
) {
  const store = await readStore();
  const key = getBookKey(target.source, target.bookId);
  const current = store.books[key];

  store.books[key] = {
    source: target.source,
    bookId: target.bookId,
    chapterId: current?.chapterId ?? target.chapterId,
    segmentIndex: current?.segmentIndex ?? 0,
    segmentTime: current?.segmentTime ?? 0,
    roleVoices,
    narrationMode: current?.narrationMode ?? 'multi',
    singleVoice: current?.singleVoice ?? 'zh-CN-XiaoxiaoNeural',
    updatedAt: Date.now(),
  };

  if (!progressFile.exists) {
    progressFile.create();
  }

  progressFile.write(JSON.stringify(store));
}

export async function saveBookNarrationSettings(
  target: Pick<ListeningProgress, 'source' | 'bookId' | 'chapterId'>,
  settings: Pick<
    ListeningProgress,
    'narrationMode' | 'singleVoice' | 'roleVoices'
  >,
) {
  const store = await readStore();
  const key = getBookKey(target.source, target.bookId);
  const current = store.books[key];

  store.books[key] = {
    source: target.source,
    bookId: target.bookId,
    chapterId: current?.chapterId ?? target.chapterId,
    segmentIndex: current?.segmentIndex ?? 0,
    segmentTime: current?.segmentTime ?? 0,
    roleVoices: settings.roleVoices,
    narrationMode: settings.narrationMode,
    singleVoice: settings.singleVoice,
    updatedAt: Date.now(),
  };

  if (!progressFile.exists) {
    progressFile.create();
  }

  progressFile.write(JSON.stringify(store));
}
