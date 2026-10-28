import { useEffect, useMemo, useRef, useState } from 'react';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import {
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  List,
  Surface,
  Text,
} from 'react-native-paper';

import {
  PlaybackSpeedSheet,
} from '../src/components/PlaybackSpeedSheet';
import {
  getVoiceDisplayName,
  VoicePickerSheet,
  type VoiceRole,
} from '../src/components/VoicePickerSheet';
import { ChapterDirectorySheet } from '../src/components/ChapterDirectorySheet';
import {
  useListeningPlayer,
} from '../src/contexts/listening';
import {
  getBookChapters,
} from '../src/services/books';
import type { BookChapter } from '../src/types/book';
import type { TtsVoice } from '../src/types/tts';

function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function ListenScreen() {
  const [isVoiceSheetVisible, setIsVoiceSheetVisible] = useState(false);
  const [isVoicesLoading, setIsVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [isChapterSheetVisible, setIsChapterSheetVisible] = useState(false);
  const [isChapterListLoading, setIsChapterListLoading] = useState(false);
  const [chapterListError, setChapterListError] = useState<string | null>(null);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const [isPlaybackSpeedSheetVisible, setIsPlaybackSpeedSheetVisible] =
    useState(false);
  const transcriptRef = useRef<ScrollView>(null);
  const paragraphOffsetsRef = useRef<number[]>([]);
  const chapterDirectoryKeyRef = useRef<string | null>(null);
  const [transcriptHeight, setTranscriptHeight] = useState(0);
  const {
    book,
    chapter,
    listenTarget,
    narrationMode,
    playbackRate,
    playingChapter,
    roleVoices,
    singleVoice,
    voices,
    loadVoices,
    selectListeningChapter,
    updateNarrationMode,
    updatePlaybackRate,
    updateRoleVoice,
    updateSingleVoice,
    currentIndex,
    hasCurrentAudio,
    isPlaying,
    isRoleAnalysisLoading,
    pause,
    play,
    progress,
    roleSegments,
    seekToProgress,
  } = useListeningPlayer();
  const selectedChapterId = Number(listenTarget?.chapterId);
  const isSelectedChapterLoaded =
    chapter?.chapter_id === selectedChapterId;
  const isSelectedChapterQueued =
    playingChapter?.chapter_id === selectedChapterId;
  const displayedChapter = isSelectedChapterLoaded ? chapter : null;
  const displayedProgress = dragProgress ?? progress.value;
  const displayedTime = displayedProgress * progress.duration;
  const voiceActionLabel =
    narrationMode === 'single'
      ? getVoiceDisplayName(singleVoice, voices)
      : '多音色';

  function changePlaybackRate(rate: number) {
    updatePlaybackRate(rate);
  }

  useEffect(() => {
    const paragraphOffset = paragraphOffsetsRef.current[currentIndex];

    if (paragraphOffset === undefined || transcriptHeight === 0) {
      return;
    }

    transcriptRef.current?.scrollTo({
      animated: true,
      y: Math.max(0, paragraphOffset - transcriptHeight / 2),
    });
  }, [currentIndex, transcriptHeight]);

  const roles = useMemo<VoiceRole[]>(
    () =>
      Array.from(
        new Map(
          roleSegments.map((segment) => [
            segment.speaker,
            { speaker: segment.speaker, gender: segment.gender },
          ]),
        ).values(),
      ),
    [roleSegments],
  );
  async function openVoiceSheet() {
    setIsVoiceSheetVisible(true);

    if (voices.length > 0) {
      return;
    }

    setIsVoicesLoading(true);
    setVoicesError(null);

    try {
      await loadVoices();
    } catch (requestError) {
      setVoicesError(
        requestError instanceof Error
          ? requestError.message
          : '音色列表获取失败。',
      );
    } finally {
      setIsVoicesLoading(false);
    }
  }

  function selectRoleVoice(speaker: string, voice: TtsVoice) {
    updateRoleVoice(speaker, voice.name);
  }

  const selectNarrationMode = updateNarrationMode;

  function selectSingleVoice(voice: TtsVoice) {
    updateSingleVoice(voice.name);
  }

  function switchChapter(offset: number) {
    const totalChapters =
      displayedChapter?.total_chapters ??
      playingChapter?.total_chapters ??
      chapter?.total_chapters;
    if (!Number.isInteger(selectedChapterId) || !totalChapters) {
      return;
    }

    const nextChapterId = selectedChapterId + offset;
    if (
      nextChapterId < 1 ||
      nextChapterId > totalChapters
    ) {
      return;
    }

    selectChapter(nextChapterId);
  }

  function seekBy(seconds: number) {
    if (progress.duration <= 0) {
      return;
    }

    const nextProgress = Math.min(
      1,
      Math.max(0, (progress.currentTime + seconds) / progress.duration),
    );
    void seekToProgress(nextProgress);
  }

  function selectChapter(chapterId: number) {
    setIsChapterSheetVisible(false);
    if (chapterId === selectedChapterId) {
      return;
    }

    selectListeningChapter(chapterId);
  }

  async function openChapterSheet() {
    if (!listenTarget) {
      return;
    }

    setIsChapterSheetVisible(true);
    const directoryKey = `${listenTarget.source}:${listenTarget.bookId}`;
    if (chapterDirectoryKeyRef.current === directoryKey) {
      return;
    }

    setIsChapterListLoading(true);
    setChapterListError(null);

    try {
      const directory = await getBookChapters(
        listenTarget.source,
        listenTarget.bookId,
      );
      setChapters(directory.items);
      chapterDirectoryKeyRef.current = directoryKey;
    } catch (requestError) {
      setChapterListError(
        requestError instanceof Error ? requestError.message : '目录获取失败。',
      );
    } finally {
      setIsChapterListLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      {book?.cover ? (
        <Image
          blurRadius={32}
          source={{ uri: book.cover }}
          style={styles.backgroundCover}
        />
      ) : null}
      <View style={styles.backgroundTint} />
      <View style={styles.contentLayer}>
        <View style={styles.header}>
          <IconButton
            icon="chevron-down"
            iconColor="#ffffff"
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>听书</Text>
          <IconButton
            disabled
            icon="chevron-down"
            iconColor="transparent"
            style={styles.headerSpacer}
          />
        </View>

        <List.Item
              description={book?.author ?? book?.title ?? '未知作者'}
              descriptionNumberOfLines={1}
              left={() =>
                book?.cover ? (
                  <Avatar.Image source={{ uri: book.cover }} />
                ) : (
                  <Avatar.Icon icon="book-open-variant" />
                )
              }
              theme={{
                colors: {
                  onSurface: '#ffffff',
                  onSurfaceVariant: 'rgba(255, 255, 255, 0.68)',
                },
              }}
              style={styles.bookInfo}
              title={displayedChapter?.title ?? ''}
              titleNumberOfLines={1}
        />

        <ScrollView
              contentContainerStyle={styles.content}
              onLayout={(event) =>
                setTranscriptHeight(event.nativeEvent.layout.height)
              }
              ref={transcriptRef}
              style={styles.transcript}>
              {!listenTarget ? (
                <Text style={styles.paragraph} variant="bodyLarge">
                  暂无听书记录，请从阅读页打开听书。
                </Text>
              ) : !isSelectedChapterLoaded || !isSelectedChapterQueued ? (
                <ActivityIndicator color="#ffffff" style={styles.feedback} />
              ) : roleSegments.length > 0 ? (
                roleSegments.map((segment, index) => (
                  <Text
                    key={`${displayedChapter?.chapter_id ?? 'loading'}-${index}`}
                    onLayout={(event) => {
                      paragraphOffsetsRef.current[index] =
                        event.nativeEvent.layout.y;
                    }}
                    style={[
                      styles.paragraph,
                      index === currentIndex && styles.activeParagraph,
                    ]}
                    variant="bodyLarge">
                    {narrationMode === 'multi' ? `${segment.speaker}：` : ''}
                    {segment.text}
                  </Text>
                ))
              ) : isRoleAnalysisLoading ? (
                <ActivityIndicator color="#ffffff" style={styles.feedback} />
              ) : (
                <Text style={styles.paragraph} variant="bodyLarge">
                  角色分析失败，请稍后重试。
                </Text>
              )}
        </ScrollView>

        <Surface elevation={0} style={styles.playerPanel}>
              <View style={styles.actionRow}>
                <Surface elevation={0} style={styles.actionItem}>
                  <IconButton
                    icon="account-voice"
                    iconColor="#ffffff"
                    onPress={openVoiceSheet}
                  />
                  <Text style={styles.actionLabel}>{voiceActionLabel}</Text>
                </Surface>
                <Surface elevation={0} style={styles.actionItem}>
                  <IconButton
                    icon="speedometer"
                    iconColor="#ffffff"
                    onPress={() => setIsPlaybackSpeedSheetVisible(true)}
                  />
                  <Text style={styles.actionLabel}>语速</Text>
                </Surface>
                <Surface elevation={0} style={styles.actionItem}>
                  <IconButton
                    icon="format-list-bulleted"
                    iconColor="#ffffff"
                    onPress={openChapterSheet}
                  />
                  <Text style={styles.actionLabel}>目录</Text>
                </Surface>
                <Surface elevation={0} style={styles.actionItem}>
                  <IconButton
                    icon="dots-horizontal"
                    iconColor="#ffffff"
                  />
                  <Text style={styles.actionLabel}>更多</Text>
                </Surface>
              </View>

              <View style={styles.seekRow}>
                <View style={styles.timeline}>
                  <Slider
                    maximumTrackTintColor="rgba(255, 255, 255, 0.28)"
                    maximumValue={1}
                    minimumTrackTintColor="#ffffff"
                    minimumValue={0}
                    onSlidingComplete={async (value) => {
                      await seekToProgress(value);
                      setDragProgress(null);
                    }}
                    onSlidingStart={setDragProgress}
                    onValueChange={setDragProgress}
                    style={styles.progressSlider}
                    thumbTintColor="#ffffff"
                    value={displayedProgress}
                  />
                  <View style={styles.timelineTimes}>
                    <Text style={styles.timeText}>
                      {formatTime(displayedTime)}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatTime(progress.duration)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.controlRow}>
                <IconButton
                  icon="rewind-15"
                  iconColor="#ffffff"
                  onPress={() => seekBy(-15)}
                />
                <IconButton
                  icon="skip-previous"
                  iconColor="#ffffff"
                  onPress={() => switchChapter(-1)}
                />
                <IconButton
                  icon={isPlaying ? 'pause' : 'play'}
                  iconColor="#68413f"
                  loading={isPlaying && !hasCurrentAudio}
                  mode="contained"
                  onPress={isPlaying ? pause : play}
                />
                <IconButton
                  icon="skip-next"
                  iconColor="#ffffff"
                  onPress={() => switchChapter(1)}
                />
                <IconButton
                  icon="fast-forward-15"
                  iconColor="#ffffff"
                  onPress={() => seekBy(15)}
                />
              </View>

              <List.Item
                left={(props) => (
                  <List.Icon
                    {...props}
                    color="#ffffff"
                    icon="book-open-variant"
                  />
                )}
                onPress={() => {
                  if (!listenTarget) {
                    return;
                  }

                  router.push({
                    pathname: '/book/[source]/[bookId]/reader',
                    params: {
                      source: listenTarget.source,
                      bookId: listenTarget.bookId,
                      chapterId: String(displayedChapter?.chapter_id ?? listenTarget.chapterId),
                    },
                  });
                }}
                right={(props) => (
                  <List.Icon {...props} color="#ffffff" icon="chevron-right" />
                )}
                style={styles.readerLink}
                title="阅读电子书"
                titleStyle={styles.readerLinkTitle}
              />
        </Surface>
      </View>

      <VoicePickerSheet
        error={voicesError}
        loading={isVoicesLoading}
        onDismiss={() => setIsVoiceSheetVisible(false)}
        onModeChange={selectNarrationMode}
        onSelect={selectRoleVoice}
        onSelectSingleVoice={selectSingleVoice}
        narrationMode={narrationMode}
        roles={roles}
        roleVoices={roleVoices}
        singleVoice={singleVoice}
        visible={isVoiceSheetVisible}
        voices={voices}
      />
      <PlaybackSpeedSheet
        onDismiss={() => setIsPlaybackSpeedSheetVisible(false)}
        onRateChange={changePlaybackRate}
        rate={playbackRate}
        visible={isPlaybackSpeedSheetVisible}
      />
      <ChapterDirectorySheet
        chapters={chapters}
        error={chapterListError}
        loading={isChapterListLoading}
        onDismiss={() => setIsChapterSheetVisible(false)}
        onSelect={selectChapter}
        visible={isChapterSheetVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#613b39',
    flex: 1,
  },
  backgroundCover: {
    ...StyleSheet.absoluteFill,
    opacity: 0.65,
  },
  backgroundTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(78, 42, 40, 0.72)',
  },
  contentLayer: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: '#ffffff',
  },
  headerSpacer: {
    opacity: 0,
  },
  bookInfo: {
    marginHorizontal: 24,
  },
  content: {
    paddingBottom: 20,
    paddingHorizontal: 24,
    paddingTop: 54,
  },
  transcript: {
    flex: 1,
  },
  paragraph: {
    color: 'rgba(255, 255, 255, 0.72)',
    marginBottom: 18,
  },
  activeParagraph: {
    color: '#ffffff',
    fontWeight: '700',
  },
  playerPanel: {
    backgroundColor: 'transparent',
    gap: 16,
    paddingBottom: 18,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  actionLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  seekRow: {
    paddingHorizontal: 2,
  },
  timeline: {
    gap: 4,
  },
  progressSlider: {
    width: '100%',
  },
  timelineTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.68)',
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  readerLink: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    flexDirection: 'row',
    marginTop: 4,
    paddingVertical: 4,
  },
  readerLinkTitle: {
    color: '#ffffff',
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  feedback: {
    alignSelf: 'center',
    color: '#ffffff',
    marginTop: 24,
  },
});
