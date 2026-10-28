import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  SINGLE_ROLE_SPEAKER,
  useListeningQueue,
} from '../hooks/useListeningQueue';
import {
  getApibiBookstoreIndex,
  getBookChapter,
  getBookDetail,
} from '../services/books';
import {
  loadBookListeningProgress,
  loadLatestListeningProgress,
  saveBookListeningProgress,
  saveBookNarrationSettings,
  saveBookRoleVoices,
  type ListeningProgress,
  type NarrationMode,
} from '../services/listeningProgress';
import {
  getListeningPlaybackRate,
  getListeningNarrationSettings,
  saveListeningNarrationSettings,
  saveListeningPlaybackRate,
} from '../services/listeningPreferences';
import { listTtsVoices } from '../services/tts';
import type { ChapterRoleSegment } from '../services/chapterSpeech';
import type { BookChapterContent, BookDetail } from '../types/book';
import type { TtsVoice } from '../types/tts';

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

export type ListeningTarget = Omit<
  ListeningProgress,
  'updatedAt' | 'roleVoices' | 'narrationMode' | 'singleVoice'
> & {
  startOffset?: number;
};

export type StartListeningOptions = {
  source: string;
  bookId: string;
  chapterId: number;
  startOffset?: number;
};

type ListeningQueue = ReturnType<typeof useListeningQueue>;

type ListeningContextValue = Omit<ListeningQueue, 'chapter'> & {
  book: BookDetail | null;
  chapter: BookChapterContent | null;
  listenTarget: ListeningTarget | null;
  narrationMode: NarrationMode;
  playbackRate: number;
  playingChapter: ListeningQueue['chapter'];
  roleVoices: Record<string, string>;
  singleVoice: string;
  voices: TtsVoice[];
  isFloatingPlayerVisible: boolean;
  startListening: (options: StartListeningOptions) => Promise<void>;
  resumeListening: () => Promise<void>;
  selectListeningChapter: (chapterId: number) => void;
  updatePlaybackRate: (rate: number) => void;
  updateRoleVoice: (speaker: string, voice: string) => void;
  updateNarrationMode: (mode: NarrationMode) => void;
  updateSingleVoice: (voice: string) => void;
  setFloatingPlayerVisible: (visible: boolean) => void;
  loadVoices: () => Promise<TtsVoice[]>;
};

const ListeningContext = createContext<ListeningContextValue | null>(null);

function getChapterKey(target: ListeningTarget) {
  return `${target.source}:${target.bookId}:${target.chapterId}`;
}

function findRoleSegmentAtOffset(
  chapter: BookChapterContent,
  roleSegments: ChapterRoleSegment[],
  offset: number,
) {
  const targetLength =
    chapter.content.replace(/\s/g, '').length * Math.min(1, Math.max(0, offset));
  let contentLength = 0;

  for (const [index, segment] of roleSegments.entries()) {
    contentLength += segment.text.replace(/\s/g, '').length;
    if (contentLength >= targetLength) {
      return index;
    }
  }

  return null;
}

export function ListeningProvider({ children }: PropsWithChildren) {
  const [listenTarget, setListenTarget] = useState<ListeningTarget | null>(null);
  const [book, setBook] = useState<BookDetail | null>(null);
  const [chapter, setChapter] = useState<BookChapterContent | null>(null);
  const [roleVoices, setRoleVoices] = useState<Record<string, string>>({});
  const [narrationMode, setNarrationMode] = useState<NarrationMode>('multi');
  const [singleVoice, setSingleVoice] = useState(DEFAULT_VOICE);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [isFloatingPlayerVisible, setFloatingPlayerVisible] =
    useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    void getListeningPlaybackRate().then(setPlaybackRate);
  }, []);

  const queuedChapterKeyRef = useRef<string | null>(null);
  const prefetchedChapterIdsRef = useRef(new Set<string>());
  const sessionRequestRef = useRef(0);
  const appliedPageStartRef = useRef<string | null>(null);
  const queue = useListeningQueue({ narrationMode, playbackRate, roleVoices });

  const startListening = useCallback(
    async ({
      source,
      bookId,
      chapterId,
      startOffset,
    }: StartListeningOptions) => {
      const requestId = ++sessionRequestRef.current;
      const [savedProgress, globalNarrationSettings] = await Promise.all([
        loadBookListeningProgress(source, bookId),
        getListeningNarrationSettings(),
      ]);

      if (requestId !== sessionRequestRef.current) {
        return;
      }

      const startsFromReader = startOffset !== undefined;

      setBook(null);
      setChapter(null);
      queuedChapterKeyRef.current = null;
      appliedPageStartRef.current = null;
      setRoleVoices(savedProgress?.roleVoices ?? {});
      setNarrationMode(
        savedProgress?.narrationMode ?? globalNarrationSettings.narrationMode,
      );
      setSingleVoice(
        savedProgress?.singleVoice ?? globalNarrationSettings.singleVoice,
      );
      setListenTarget({
        source,
        bookId,
        chapterId: String(chapterId),
        segmentIndex: startsFromReader ? 0 : (savedProgress?.segmentIndex ?? 0),
        segmentTime: startsFromReader ? 0 : (savedProgress?.segmentTime ?? 0),
        startOffset: startsFromReader
          ? Math.min(1, Math.max(0, startOffset))
          : undefined,
      });
    },
    [],
  );

  const resumeListening = useCallback(async () => {
    if (listenTarget) {
      return;
    }

    const progress = await loadLatestListeningProgress();
    if (!progress) {
      return;
    }

    await startListening({
      source: progress.source,
      bookId: progress.bookId,
      chapterId: Number(progress.chapterId),
    });
  }, [listenTarget, startListening]);

  const selectListeningChapter = useCallback(
    (chapterId: number) => {
      if (!listenTarget || chapterId === Number(listenTarget.chapterId)) {
        return;
      }

      appliedPageStartRef.current = null;
      setListenTarget({
        ...listenTarget,
        chapterId: String(chapterId),
        segmentIndex: 0,
        segmentTime: 0,
        startOffset: undefined,
      });
    },
    [listenTarget],
  );

  const updatePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    void saveListeningPlaybackRate(rate);
  }, []);

  const updateRoleVoice = useCallback(
    (speaker: string, voice: string) => {
      const nextRoleVoices = { ...roleVoices, [speaker]: voice };
      setRoleVoices(nextRoleVoices);

      if (listenTarget) {
        void saveBookRoleVoices(listenTarget, nextRoleVoices);
      }
    },
    [listenTarget, roleVoices],
  );

  const updateNarrationMode = useCallback(
    (mode: NarrationMode) => {
      const nextRoleVoices =
        mode === 'single'
          ? { ...roleVoices, [SINGLE_ROLE_SPEAKER]: singleVoice }
          : roleVoices;

      setNarrationMode(mode);
      setRoleVoices(nextRoleVoices);
      void saveListeningNarrationSettings({
        narrationMode: mode,
        singleVoice,
      });
      if (listenTarget) {
        void saveBookNarrationSettings(listenTarget, {
          narrationMode: mode,
          roleVoices: nextRoleVoices,
          singleVoice,
        });
      }
    },
    [listenTarget, roleVoices, singleVoice],
  );

  const updateSingleVoice = useCallback(
    (voice: string) => {
      const nextRoleVoices = {
        ...roleVoices,
        [SINGLE_ROLE_SPEAKER]: voice,
      };

      setSingleVoice(voice);
      setRoleVoices(nextRoleVoices);
      void saveListeningNarrationSettings({
        narrationMode,
        singleVoice: voice,
      });
      if (listenTarget) {
        void saveBookNarrationSettings(listenTarget, {
          narrationMode,
          roleVoices: nextRoleVoices,
          singleVoice: voice,
        });
      }
    },
    [listenTarget, narrationMode, roleVoices],
  );

  const loadVoices = useCallback(async () => {
    const availableVoices =
      voices.length > 0 ? voices : await listTtsVoices();
    setVoices(availableVoices);
    return availableVoices;
  }, [voices]);

  useEffect(() => {
    let isActive = true;

    async function loadTabBook() {
      const progress = await loadLatestListeningProgress();
      const latestBook = progress
        ? await getBookDetail(progress.source, progress.bookId)
        : await (async () => {
            const sections = await getApibiBookstoreIndex();
            const rankedBook = sections.find(
              (section) => section.id === 'toplist',
            )?.books[0];

            return rankedBook
              ? getBookDetail('apibi', rankedBook.id)
              : null;
          })();

      if (isActive && latestBook) {
        setBook((currentBook) => currentBook ?? latestBook);
      }
    }

    void loadTabBook().catch(() => {});

    return () => {
      isActive = false;
    };
  }, []);

  const replaceChapterForSession = useCallback(
    (target: ListeningTarget, nextChapter: BookChapterContent) => {
      const chapterKey = getChapterKey(target);
      if (queuedChapterKeyRef.current === chapterKey) {
        return;
      }

      queuedChapterKeyRef.current = chapterKey;
      queue.replaceChapter(nextChapter, {
        segmentIndex: target.segmentIndex,
        segmentTime: target.segmentTime,
      });
    },
    [queue.replaceChapter],
  );

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadSessionChapter() {
      if (!listenTarget) {
        setChapter(null);
        return;
      }

      if (
        book?.source.source === listenTarget.source &&
        book.source.book_id === listenTarget.bookId &&
        chapter?.chapter_id === Number(listenTarget.chapterId)
      ) {
        return;
      }

      const [bookDetail, chapterContent] = await Promise.all([
        getBookDetail(listenTarget.source, listenTarget.bookId),
        getBookChapter(
          listenTarget.source,
          listenTarget.bookId,
          listenTarget.chapterId,
        ),
      ]);

      if (isCurrentRequest) {
        setBook(bookDetail);
        setChapter(chapterContent);
      }
    }

    void loadSessionChapter().catch(() => {});
    return () => {
      isCurrentRequest = false;
    };
  }, [book, chapter, listenTarget]);

  useEffect(() => {
    if (
      !chapter ||
      !listenTarget ||
      chapter.chapter_id !== Number(listenTarget.chapterId)
    ) {
      return;
    }

    replaceChapterForSession(listenTarget, chapter);
  }, [chapter, listenTarget, replaceChapterForSession]);

  useEffect(() => {
    const playingChapter = queue.chapter;
    if (
      !listenTarget ||
      !chapter ||
      !playingChapter ||
      chapter.chapter_id !== Number(listenTarget.chapterId) ||
      playingChapter.chapter_id === chapter.chapter_id
    ) {
      return;
    }

    const nextTarget = {
      ...listenTarget,
      chapterId: String(playingChapter.chapter_id),
      segmentIndex: queue.currentIndex,
      segmentTime: queue.progress.segmentTime,
      startOffset: undefined,
    };

    queuedChapterKeyRef.current = getChapterKey(nextTarget);
    setListenTarget(nextTarget);
  }, [
    chapter,
    listenTarget,
    queue.chapter,
    queue.currentIndex,
    queue.progress.segmentTime,
  ]);

  useEffect(() => {
    if (!chapter || listenTarget?.startOffset === undefined) {
      return;
    }

    const startKey =
      `${listenTarget.source}:${listenTarget.bookId}:` +
      `${chapter.chapter_id}:${listenTarget.startOffset}`;
    if (appliedPageStartRef.current === startKey) {
      return;
    }

    const segmentIndex = findRoleSegmentAtOffset(
      chapter,
      queue.roleSegments,
      listenTarget.startOffset,
    );
    if (segmentIndex === null) {
      return;
    }

    appliedPageStartRef.current = startKey;
    queue.startFrom(segmentIndex);
  }, [
    chapter,
    listenTarget?.bookId,
    listenTarget?.source,
    listenTarget?.startOffset,
    queue.roleSegments,
    queue.startFrom,
  ]);

  useEffect(() => {
    prefetchedChapterIdsRef.current.clear();
  }, [listenTarget?.bookId, listenTarget?.source]);

  useEffect(() => {
    const playingChapter = queue.chapter;
    if (
      !listenTarget ||
      !playingChapter ||
      playingChapter.chapter_id >= playingChapter.total_chapters ||
      queue.progress.duration - queue.progress.currentTime > 60
    ) {
      return;
    }

    const nextChapterId = playingChapter.chapter_id + 1;
    const prefetchKey = `${listenTarget.source}:${listenTarget.bookId}:${nextChapterId}`;
    if (prefetchedChapterIdsRef.current.has(prefetchKey)) {
      return;
    }

    prefetchedChapterIdsRef.current.add(prefetchKey);
    void getBookChapter(
      listenTarget.source,
      listenTarget.bookId,
      String(nextChapterId),
    )
      .then(queue.prefetchChapter)
      .catch(() => {});
  }, [
    listenTarget,
    queue.chapter,
    queue.prefetchChapter,
    queue.progress.currentTime,
    queue.progress.duration,
  ]);

  useEffect(() => {
    const playingChapter = queue.chapter;
    if (!listenTarget || !playingChapter) {
      return;
    }

    const saveProgress = () =>
      saveBookListeningProgress({
        source: listenTarget.source,
        bookId: listenTarget.bookId,
        chapterId: String(playingChapter.chapter_id),
        segmentIndex: queue.currentIndex,
        segmentTime: queue.progress.segmentTime,
        roleVoices,
        narrationMode,
        singleVoice,
        updatedAt: Date.now(),
      });

    if (!queue.isPlaying) {
      void saveProgress();
      return;
    }

    const timer = setTimeout(() => {
      void saveProgress();
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    listenTarget,
    narrationMode,
    queue.chapter,
    queue.currentIndex,
    queue.isPlaying,
    queue.progress.segmentTime,
    roleVoices,
    singleVoice,
  ]);

  useEffect(() => {
    let isCurrentRequest = true;

    async function ensureRoleVoices() {
      if (!queue.allRoleSegments.length) {
        return;
      }

      try {
        const availableVoices = await loadVoices();
        if (!isCurrentRequest) {
          return;
        }

        setVoices(availableVoices);
        const nextRoleVoices: Record<string, string> = {
          ...roleVoices,
          ...(narrationMode === 'single'
            ? { [SINGLE_ROLE_SPEAKER]: singleVoice }
            : {}),
        };

        for (const segment of queue.allRoleSegments) {
          if (nextRoleVoices[segment.speaker]) {
            continue;
          }

          nextRoleVoices[segment.speaker] =
            availableVoices.find(
              (voice) =>
                voice.gender.toLowerCase() ===
                (segment.gender === 'female' ? 'female' : 'male'),
            )?.name ??
            availableVoices[0]?.name ??
            DEFAULT_VOICE;
        }

        if (
          Object.keys(nextRoleVoices).some(
            (speaker) => nextRoleVoices[speaker] !== roleVoices[speaker],
          )
        ) {
          setRoleVoices(nextRoleVoices);
          if (listenTarget) {
            await saveBookRoleVoices(listenTarget, nextRoleVoices);
          }
        }
      } catch {}
    }

    void ensureRoleVoices();

    return () => {
      isCurrentRequest = false;
    };
  }, [
    listenTarget,
    narrationMode,
    queue.allRoleSegments,
    roleVoices,
    singleVoice,
    loadVoices,
  ]);

  const value = useMemo<ListeningContextValue>(
    () => ({
      ...queue,
      playingChapter: queue.chapter,
      book,
      chapter,
      listenTarget,
      narrationMode,
      playbackRate,
      roleVoices,
      singleVoice,
      voices,
      isFloatingPlayerVisible,
      startListening,
      resumeListening,
      selectListeningChapter,
      updatePlaybackRate,
      updateRoleVoice,
      updateNarrationMode,
      updateSingleVoice,
      setFloatingPlayerVisible,
      loadVoices,
    }),
    [
      book,
      chapter,
      listenTarget,
      narrationMode,
      playbackRate,
      queue,
      isFloatingPlayerVisible,
      loadVoices,
      roleVoices,
      resumeListening,
      selectListeningChapter,
      singleVoice,
      startListening,
      updateNarrationMode,
      updatePlaybackRate,
      updateRoleVoice,
      updateSingleVoice,
      voices,
    ],
  );

  return (
    <ListeningContext.Provider value={value}>
      {children}
    </ListeningContext.Provider>
  );
}

export function useListeningPlayer() {
  const context = useContext(ListeningContext);

  if (!context) {
    throw new Error('useListeningPlayer 必须在 ListeningProvider 内使用。');
  }

  return context;
}
