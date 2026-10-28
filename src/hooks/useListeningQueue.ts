import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';

import {
  analyzeChapterRoles,
  synthesizeChapterSegment,
  type ChapterRoleSegment,
  type ChapterSpeechSegment,
} from '../services/chapterSpeech';
import type { NarrationMode } from '../services/listeningProgress';
import { deleteTtsAudio } from '../services/tts';
import type { BookChapterContent } from '../types/book';

const CHARS_PER_SECOND = 4.5;
const SYNTHESIS_CONCURRENCY = 3;
const MAX_BUFFERED_TRACKS = 5;

export const SINGLE_ROLE_SPEAKER = '旁白';

type QueuedChapter = {
  chapter: BookChapterContent;
  roleSegments: ChapterRoleSegment[];
  speechSegments: Array<ChapterSpeechSegment | undefined>;
  isAnalyzing: boolean;
  isAnalysisComplete: boolean;
  analysisRevision: number;
  speechRevision: number;
};
type PlaylistItem = { chapterId: number; segmentIndex: number };
type ResumePosition = { segmentIndex: number; segmentTime: number };

function createSingleRoleSegments(content: string): ChapterRoleSegment[] {
  return content
    .split(/\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((text) => ({
      type: 0,
      speaker: SINGLE_ROLE_SPEAKER,
      gender: 'unknown' as const,
      text,
    }));
}

function getSegmentDuration(
  segment: ChapterRoleSegment,
  speechSegment?: ChapterSpeechSegment,
) {
  if (speechSegment) return speechSegment.audio.duration;
  const text = segment.text.replace(/\s/g, '');
  const spoken = text.replace(/[，、；：。！？…“”‘’]/g, '').length;
  const clauseCount = (text.match(/[，、；：]/g) ?? []).length;
  const sentenceCount = (text.match(/[。！？]/g) ?? []).length;
  const ellipsisCount = (text.match(/…+/g) ?? []).length;
  return spoken / CHARS_PER_SECOND + clauseCount * 0.15 + sentenceCount * 0.4 + ellipsisCount * 0.2;
}

function getChapterDuration(
  roleSegments: ChapterRoleSegment[],
  speechSegments: Array<ChapterSpeechSegment | undefined>,
) {
  return roleSegments.reduce(
    (total, segment, index) => total + getSegmentDuration(segment, speechSegments[index]),
    0,
  );
}

function findSegmentAtTime(
  roleSegments: ChapterRoleSegment[],
  speechSegments: Array<ChapterSpeechSegment | undefined>,
  targetTime: number,
) {
  let elapsedTime = 0;
  for (const [index, segment] of roleSegments.entries()) {
    const duration = getSegmentDuration(segment, speechSegments[index]);
    if (targetTime <= elapsedTime + duration || index === roleSegments.length - 1) {
      return { index, offset: Math.max(0, targetTime - elapsedTime) };
    }
    elapsedTime += duration;
  }
  return null;
}

function hasChangedVoices(
  previous: Record<string, string>,
  current: Record<string, string>,
) {
  const speakers = new Set([...Object.keys(previous), ...Object.keys(current)]);
  return Array.from(speakers).some((speaker) => previous[speaker] !== current[speaker]);
}

function releaseSpeechSegments(speechSegments: Array<ChapterSpeechSegment | undefined>) {
  for (const speechSegment of speechSegments) {
    if (speechSegment) deleteTtsAudio(speechSegment.audio);
  }
}

export function useListeningQueue({
  narrationMode,
  roleVoices,
  playbackRate,
}: {
  narrationMode: NarrationMode;
  roleVoices: Record<string, string>;
  playbackRate: number;
}) {
  const playlist = useAudioPlaylist({ loop: 'none' });
  const playlistStatus = useAudioPlaylistStatus(playlist);
  const chaptersRef = useRef(new Map<number, QueuedChapter>());
  const chapterOrderRef = useRef<number[]>([]);
  const playlistItemsRef = useRef<PlaylistItem[]>([]);
  const appendCursorRef = useRef<PlaylistItem | null>(null);
  const resumeSegmentTimeRef = useRef<number | null>(null);
  const activeChapterIdRef = useRef<number | null>(null);
  const shouldPlayRef = useRef(false);
  const synthesisCountRef = useRef(0);
  const pendingSynthesisRef = useRef(new Set<string>());
  const queueRevisionRef = useRef(0);
  const narrationModeRef = useRef(narrationMode);
  const roleVoicesRef = useRef(roleVoices);
  const previousRoleVoicesRef = useRef(roleVoices);
  const playbackRateRef = useRef(playbackRate);
  const playlistStatusRef = useRef(playlistStatus);
  const lastTrackIndexRef = useRef(-1);
  const [queueVersion, setQueueVersion] = useState(0);
  const [playbackRequested, setPlaybackRequested] = useState(false);

  playlistStatusRef.current = playlistStatus;

  const publish = useCallback(() => setQueueVersion((version) => version + 1), []);
  const getChapter = useCallback(
    (chapterId: number | null) => chapterId === null ? undefined : chaptersRef.current.get(chapterId),
    [],
  );
  const getCurrentPlaylistItem = useCallback(() => {
    const { currentIndex, trackCount } = playlistStatusRef.current;
    return trackCount > 0 && currentIndex >= 0
      ? playlistItemsRef.current[currentIndex] ?? null
      : null;
  }, []);
  const getFollowingItem = useCallback((item: PlaylistItem): PlaylistItem | null => {
    const chapterIndex = chapterOrderRef.current.indexOf(item.chapterId);
    const chapter = getChapter(item.chapterId);
    if (chapterIndex < 0 || !chapter) return null;
    if (item.segmentIndex + 1 < chapter.roleSegments.length) {
      return { chapterId: item.chapterId, segmentIndex: item.segmentIndex + 1 };
    }
    const nextChapterId = chapterOrderRef.current[chapterIndex + 1];
    return nextChapterId ? { chapterId: nextChapterId, segmentIndex: 0 } : null;
  }, [getChapter]);

  const clearQueuedAudio = useCallback(() => {
    queueRevisionRef.current += 1;
    for (const chapter of chaptersRef.current.values()) {
      chapter.speechRevision += 1;
      releaseSpeechSegments(chapter.speechSegments);
    }
    chaptersRef.current.clear();
    chapterOrderRef.current = [];
    playlistItemsRef.current = [];
    appendCursorRef.current = null;
    pendingSynthesisRef.current.clear();
    playlist.clear();
  }, [playlist]);

  const resetPlaylist = useCallback((start: PlaylistItem | null) => {
    playlist.clear();
    playlistItemsRef.current = [];
    appendCursorRef.current = start;
    resumeSegmentTimeRef.current = null;
    lastTrackIndexRef.current = -1;
  }, [playlist]);

  const getBufferedTrackCount = useCallback(() => {
    const currentIndex = Math.max(0, playlistStatusRef.current.currentIndex);
    return Math.max(0, playlistItemsRef.current.length - currentIndex);
  }, []);

  const discardCompletedChapters = useCallback((item: PlaylistItem) => {
    if (activeChapterIdRef.current === item.chapterId) return;
    activeChapterIdRef.current = item.chapterId;
    const activeIndex = chapterOrderRef.current.indexOf(item.chapterId);
    if (activeIndex <= 0) return;
    for (const chapterId of chapterOrderRef.current.slice(0, activeIndex)) {
      const chapter = chaptersRef.current.get(chapterId);
      if (chapter) {
        chapter.speechRevision += 1;
        chaptersRef.current.delete(chapterId);
      }
    }
    chapterOrderRef.current = chapterOrderRef.current.slice(activeIndex);
  }, []);

  const appendReadyTracks = useCallback(() => {
    let cursor = appendCursorRef.current;
    let didAppend = false;
    while (cursor && getBufferedTrackCount() < MAX_BUFFERED_TRACKS) {
      const chapter = getChapter(cursor.chapterId);
      if (!chapter) break;
      const speechSegment = chapter.speechSegments[cursor.segmentIndex];
      if (!speechSegment) {
        if (chapter.isAnalysisComplete && cursor.segmentIndex >= chapter.roleSegments.length) {
          const chapterIndex = chapterOrderRef.current.indexOf(cursor.chapterId);
          const nextChapterId = chapterOrderRef.current[chapterIndex + 1];
          cursor = nextChapterId ? { chapterId: nextChapterId, segmentIndex: 0 } : null;
          appendCursorRef.current = cursor;
          continue;
        }
        break;
      }
      const isFirstTrack = playlistItemsRef.current.length === 0;
      playlist.add({ uri: speechSegment.audio.uri });
      playlistItemsRef.current.push(cursor);
      appendCursorRef.current = getFollowingItem(cursor);
      cursor = appendCursorRef.current;
      didAppend = true;
      if (isFirstTrack) {
        playlist.playbackRate = playbackRateRef.current;
        const resumeTime = resumeSegmentTimeRef.current;
        resumeSegmentTimeRef.current = null;
        if (resumeTime) void playlist.seekTo(resumeTime);
      }
    }
    if (didAppend && shouldPlayRef.current) playlist.play();
    if (didAppend) publish();
    return didAppend;
  }, [getBufferedTrackCount, getChapter, getFollowingItem, playlist, publish]);

  const scheduleSynthesis = useCallback(() => {
    function findNextSegment() {
      if (getBufferedTrackCount() + pendingSynthesisRef.current.size >= MAX_BUFFERED_TRACKS) {
        return null;
      }
      const cursor = appendCursorRef.current;
      const firstChapterIndex = cursor
        ? chapterOrderRef.current.indexOf(cursor.chapterId)
        : chapterOrderRef.current.length;
      for (let chapterIndex = Math.max(0, firstChapterIndex); chapterIndex < chapterOrderRef.current.length; chapterIndex += 1) {
        const chapterId = chapterOrderRef.current[chapterIndex];
        const chapter = chaptersRef.current.get(chapterId);
        if (!chapter) continue;
        for (const [segmentIndex, segment] of chapter.roleSegments.entries()) {
          if (cursor && chapterIndex === firstChapterIndex && segmentIndex < cursor.segmentIndex) continue;
          const key = `${chapterId}:${segmentIndex}`;
          if (chapter.speechSegments[segmentIndex] || pendingSynthesisRef.current.has(key) || !roleVoicesRef.current[segment.speaker]) continue;
          return { chapterId, segmentIndex, segment, key, revision: chapter.speechRevision };
        }
      }
      return null;
    }

    while (synthesisCountRef.current < SYNTHESIS_CONCURRENCY) {
      const next = findNextSegment();
      if (!next) break;
      synthesisCountRef.current += 1;
      pendingSynthesisRef.current.add(next.key);
      void synthesizeChapterSegment(next.segment, roleVoicesRef.current[next.segment.speaker])
        .then((speechSegment) => {
          const chapter = chaptersRef.current.get(next.chapterId);
          if (!chapter || chapter.speechRevision !== next.revision) {
            deleteTtsAudio(speechSegment.audio);
            return;
          }
          chapter.speechSegments[next.segmentIndex] = speechSegment;
          appendReadyTracks();
          publish();
        })
        .catch(() => {})
        .finally(() => {
          pendingSynthesisRef.current.delete(next.key);
          synthesisCountRef.current -= 1;
          scheduleSynthesis();
        });
    }
  }, [appendReadyTracks, getBufferedTrackCount, publish]);

  const analyzeQueuedChapter = useCallback((chapter: QueuedChapter) => {
    if (narrationModeRef.current === 'single') {
      chapter.roleSegments = createSingleRoleSegments(chapter.chapter.content);
      chapter.isAnalysisComplete = true;
      appendReadyTracks();
      publish();
      scheduleSynthesis();
      return;
    }
    chapter.isAnalyzing = true;
    publish();
    const revision = chapter.analysisRevision;
    void analyzeChapterRoles(chapter.chapter.content, (segments) => {
      if (chaptersRef.current.get(chapter.chapter.chapter_id) !== chapter || chapter.analysisRevision !== revision) return;
      chapter.roleSegments.push(...segments);
      appendReadyTracks();
      publish();
      scheduleSynthesis();
    })
      .catch(() => {
        if (chaptersRef.current.get(chapter.chapter.chapter_id) === chapter && chapter.analysisRevision === revision) {
          chapter.roleSegments = [];
        }
      })
      .finally(() => {
        if (chaptersRef.current.get(chapter.chapter.chapter_id) !== chapter || chapter.analysisRevision !== revision) return;
        chapter.isAnalyzing = false;
        chapter.isAnalysisComplete = true;
        appendReadyTracks();
        publish();
        scheduleSynthesis();
      });
  }, [appendReadyTracks, publish, scheduleSynthesis]);

  const createQueuedChapter = useCallback((bookChapter: BookChapterContent) => {
    const chapter: QueuedChapter = {
      chapter: bookChapter,
      roleSegments: [],
      speechSegments: [],
      isAnalyzing: false,
      isAnalysisComplete: false,
      analysisRevision: queueRevisionRef.current,
      speechRevision: queueRevisionRef.current,
    };
    chaptersRef.current.set(bookChapter.chapter_id, chapter);
    chapterOrderRef.current.push(bookChapter.chapter_id);
    analyzeQueuedChapter(chapter);
    return chapter;
  }, [analyzeQueuedChapter]);

  const replaceChapter = useCallback((bookChapter: BookChapterContent, resumePosition?: ResumePosition) => {
    const shouldResume = shouldPlayRef.current;
    clearQueuedAudio();
    shouldPlayRef.current = shouldResume;
    setPlaybackRequested(shouldResume);
    activeChapterIdRef.current = bookChapter.chapter_id;
    resetPlaylist({
      chapterId: bookChapter.chapter_id,
      segmentIndex: Math.max(0, resumePosition?.segmentIndex ?? 0),
    });
    resumeSegmentTimeRef.current = Math.max(0, resumePosition?.segmentTime ?? 0) || null;
    createQueuedChapter(bookChapter);
    publish();
  }, [clearQueuedAudio, createQueuedChapter, publish, resetPlaylist]);

  const prefetchChapter = useCallback((bookChapter: BookChapterContent) => {
    if (chaptersRef.current.has(bookChapter.chapter_id)) return;
    createQueuedChapter(bookChapter);
    if (!appendCursorRef.current) {
      appendCursorRef.current = { chapterId: bookChapter.chapter_id, segmentIndex: 0 };
    }
    appendReadyTracks();
    scheduleSynthesis();
    publish();
  }, [appendReadyTracks, createQueuedChapter, publish, scheduleSynthesis]);

  const startFrom = useCallback((segmentIndex: number, segmentTime = 0) => {
    const chapterId = activeChapterIdRef.current;
    if (chapterId === null) return;
    resetPlaylist({ chapterId, segmentIndex: Math.max(0, segmentIndex) });
    resumeSegmentTimeRef.current = Math.max(0, segmentTime) || null;
    shouldPlayRef.current = true;
    setPlaybackRequested(true);
    appendReadyTracks();
    scheduleSynthesis();
    publish();
  }, [appendReadyTracks, publish, resetPlaylist, scheduleSynthesis]);

  const play = useCallback(() => {
    shouldPlayRef.current = true;
    setPlaybackRequested(true);
    if (playlistItemsRef.current.length > 0) playlist.play();
    else appendReadyTracks();
    scheduleSynthesis();
  }, [appendReadyTracks, playlist, scheduleSynthesis]);

  const pause = useCallback(() => {
    shouldPlayRef.current = false;
    setPlaybackRequested(false);
    playlist.pause();
  }, [playlist]);

  const seekToProgress = useCallback(async (value: number) => {
    const chapter = getChapter(activeChapterIdRef.current);
    if (!chapter) return;
    const duration = getChapterDuration(chapter.roleSegments, chapter.speechSegments);
    const target = findSegmentAtTime(
      chapter.roleSegments,
      chapter.speechSegments,
      Math.min(1, Math.max(0, value)) * duration,
    );
    if (!target) return;
    const currentItem = getCurrentPlaylistItem();
    if (currentItem?.chapterId === chapter.chapter.chapter_id && currentItem.segmentIndex === target.index) {
      shouldPlayRef.current = true;
      setPlaybackRequested(true);
      await playlist.seekTo(target.offset);
      playlist.play();
      return;
    }
    startFrom(target.index, target.offset);
  }, [getChapter, getCurrentPlaylistItem, playlist, startFrom]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    playlist.playbackRate = playbackRate;
  }, [playbackRate, playlist]);

  useEffect(() => {
    const currentIndex = playlistStatus.currentIndex;
    if (playlistStatus.trackCount === 0 || currentIndex < 0 || currentIndex === lastTrackIndexRef.current) return;
    const previousIndex = lastTrackIndexRef.current;
    lastTrackIndexRef.current = currentIndex;
    if (previousIndex >= 0 && previousIndex < currentIndex) {
      const completedItem = playlistItemsRef.current[previousIndex];
      const chapter = completedItem && chaptersRef.current.get(completedItem.chapterId);
      const speech = completedItem && chapter?.speechSegments[completedItem.segmentIndex];
      if (speech) {
        deleteTtsAudio(speech.audio);
        chapter.speechSegments[completedItem.segmentIndex] = undefined;
      }
    }
    const currentItem = playlistItemsRef.current[currentIndex];
    if (currentItem) discardCompletedChapters(currentItem);
    appendReadyTracks();
    scheduleSynthesis();
    publish();
  }, [appendReadyTracks, discardCompletedChapters, playlistStatus.currentIndex, playlistStatus.trackCount, publish, scheduleSynthesis]);

  useEffect(() => {
    roleVoicesRef.current = roleVoices;
    if (!hasChangedVoices(previousRoleVoicesRef.current, roleVoices)) {
      scheduleSynthesis();
      return;
    }
    previousRoleVoicesRef.current = roleVoices;
    const currentItem = getCurrentPlaylistItem();
    for (const chapterId of chapterOrderRef.current) {
      const chapter = chaptersRef.current.get(chapterId);
      if (!chapter) continue;
      if (currentItem && chapterOrderRef.current.indexOf(chapterId) < chapterOrderRef.current.indexOf(currentItem.chapterId)) continue;
      const firstStaleIndex = currentItem?.chapterId === chapterId ? currentItem.segmentIndex + 1 : 0;
      chapter.speechRevision += 1;
      releaseSpeechSegments(chapter.speechSegments.slice(firstStaleIndex));
      chapter.speechSegments = chapter.speechSegments.slice(0, firstStaleIndex);
    }
    resetPlaylist(currentItem ? getFollowingItem(currentItem) : appendCursorRef.current);
    scheduleSynthesis();
    publish();
  }, [getCurrentPlaylistItem, getFollowingItem, publish, resetPlaylist, roleVoices, scheduleSynthesis]);

  useEffect(() => { narrationModeRef.current = narrationMode; }, [narrationMode]);
  const modeRef = useRef(narrationMode);
  useEffect(() => {
    if (modeRef.current === narrationMode) return;
    modeRef.current = narrationMode;
    const chapter = getChapter(activeChapterIdRef.current)?.chapter;
    if (chapter) replaceChapter(chapter);
  }, [getChapter, narrationMode, replaceChapter]);
  useEffect(() => () => { clearQueuedAudio(); }, [clearQueuedAudio]);

  const activeChapter = getChapter(activeChapterIdRef.current);
  const currentItem = getCurrentPlaylistItem();
  const currentIndex = currentItem?.segmentIndex ?? appendCursorRef.current?.segmentIndex ?? 0;
  const chapterDuration = activeChapter
    ? getChapterDuration(activeChapter.roleSegments, activeChapter.speechSegments)
    : 0;
  const elapsedDuration = activeChapter
    ? Math.min(
      chapterDuration,
      activeChapter.roleSegments.slice(0, currentIndex).reduce(
        (total, segment, index) => total + getSegmentDuration(segment, activeChapter.speechSegments[index]),
        0,
      ) + Math.max(0, currentItem ? playlistStatus.currentTime : 0),
    )
    : 0;
  const allRoleSegments = useMemo(
    () => chapterOrderRef.current.flatMap((chapterId) => chaptersRef.current.get(chapterId)?.roleSegments ?? []),
    [queueVersion],
  );

  return {
    chapter: activeChapter?.chapter ?? null,
    roleSegments: activeChapter?.roleSegments ?? [],
    allRoleSegments,
    currentIndex,
    hasCurrentAudio: Boolean(activeChapter?.speechSegments[currentIndex]),
    isPlaying: playbackRequested,
    isRoleAnalysisLoading: Boolean(activeChapter?.isAnalyzing),
    isAudioLoading: synthesisCountRef.current > 0,
    pause,
    play,
    replaceChapter,
    prefetchChapter,
    startFrom,
    seekToProgress,
    progress: {
      currentTime: elapsedDuration,
      duration: chapterDuration,
      segmentTime: Math.max(0, playlistStatus.currentTime),
      value: chapterDuration > 0 ? Math.min(1, elapsedDuration / chapterDuration) : 0,
    },
  };
}
