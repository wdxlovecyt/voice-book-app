import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import {
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutUp,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Appbar,
  Button,
  IconButton,
  MD3DarkTheme,
  MD3LightTheme,
  Menu,
  PaperProvider,
  ProgressBar,
  SegmentedButtons,
  Switch,
  Text,
} from 'react-native-paper';

import { useBookshelf } from '../../../../src/contexts/bookshelf';
import { useListeningPlayer } from '../../../../src/contexts/listening';
import { useReaderChapters } from '../../../../src/hooks/useReaderChapters';
import {
  type ReaderPage,
  useSlideReader,
} from '../../../../src/hooks/useSlideReader';
import { useScrollReader } from '../../../../src/hooks/useScrollReader';
import {
  getReaderBrightness,
  getReaderEyeCare,
  getReaderFontSize,
  getReaderTurnMode,
  saveReaderBrightness,
  saveReaderEyeCare,
  saveReaderFontSize,
  saveReaderTurnMode,
  type ReaderTurnMode,
} from '../../../../src/services/readerPreferences';

const READER_BACKGROUND_COLOR = '#ffffff';
const NIGHT_READER_BACKGROUND_COLOR = '#1c1b1f';

function SlidePageContent({
  fontSize,
  page,
}: {
  fontSize: number;
  page: ReaderPage;
}) {
  return (
    <>
      {page.isFirstPage ? (
        <Text variant="headlineSmall">{page.chapter.title}</Text>
      ) : null}
      <View>
        {page.content
          .split(/\n+/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <Text
              key={`${page.id}-${index}`}
              style={[
                styles.paragraph,
                {
                  fontSize,
                  lineHeight: fontSize + 14,
                },
              ]}
              variant="bodyLarge">
              {`　　${paragraph}`}
            </Text>
          ))}
      </View>
    </>
  );
}

export default function ReaderScreen() {
  const {
    source,
    bookId,
    chapterId: initialChapterId,
    initialOffset,
    initialProgressUnit,
    sources,
  } =
    useLocalSearchParams<{
      source: string;
      bookId: string;
      chapterId?: string;
      initialOffset?: string;
      initialProgressUnit?: 'pixel' | 'ratio';
      sources?: string;
    }>();
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [eyeCare, setEyeCare] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [nightMode, setNightMode] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [turnMode, setTurnMode] = useState<ReaderTurnMode>('scroll');
  const [fontSize, setFontSize] = useState(16);
  const [listeningStart, setListeningStart] = useState({
    chapterId: Math.max(1, Number(initialChapterId) || 1),
    offset: 0,
  });
  const { removeBook, updateReadingProgress } = useBookshelf();
  const { setFloatingPlayerVisible, startListening } = useListeningPlayer();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const readerBackgroundColor = nightMode
    ? NIGHT_READER_BACKGROUND_COLOR
    : eyeCare
      ? '#f6f0dc'
      : READER_BACKGROUND_COLOR;

  useEffect(() => {
    setFloatingPlayerVisible(showControls);

    return () => setFloatingPlayerVisible(true);
  }, [setFloatingPlayerVisible, showControls]);

  useEffect(() => {
    void Promise.all([
      getReaderBrightness(),
      getReaderEyeCare(),
      getReaderFontSize(),
      getReaderTurnMode(),
    ]).then(
      ([savedBrightness, savedEyeCare, savedFontSize, savedTurnMode]) => {
        setBrightness(savedBrightness);
        setEyeCare(savedEyeCare);
        setFontSize(savedFontSize);
        setTurnMode(savedTurnMode);
      },
    );
  }, []);

  const readerChapters = useReaderChapters({
    bookId,
    initialChapterId,
    source,
  });
  const { chapter, chapters, currentChapterId, error } = readerChapters;

  useEffect(() => {
    if (chapter) {
      setListeningStart({ chapterId: chapter.chapter_id, offset: 0 });
    }
  }, [chapter]);

  const scrollReader = useScrollReader({
    bookId,
    chapter,
    chapters,
    currentChapterId,
    followChapter: readerChapters.followChapter,
    onProgress: (chapterId, progress) => {
      updateReadingProgress(source, bookId, chapterId, progress);
      setListeningStart({ chapterId, offset: progress });
    },
    replaceChapter: readerChapters.replaceChapter,
    source,
  });
  const slideReader = useSlideReader({
    chapter,
    chapters,
    currentChapterId,
    followChapter: readerChapters.followChapter,
    fontSize,
    initialOffset,
    initialProgressUnit,
    onProgress: (chapterId, progress) => {
      updateReadingProgress(source, bookId, chapterId, progress);
      setListeningStart({ chapterId, offset: progress });
    },
    replaceChapter: readerChapters.replaceChapter,
    windowWidth,
  });
  const jumpToChapter =
    turnMode === 'scroll'
      ? scrollReader.jumpToChapter
      : slideReader.jumpToChapter;
  const displayedChapter =
    turnMode === 'scroll'
      ? scrollReader.visibleChapter ?? chapter
      : chapter;

  function updateFontSize(delta: number) {
    setFontSize((size) => {
      const nextSize = Math.max(14, Math.min(24, size + delta));

      void saveReaderFontSize(nextSize);

      return nextSize;
    });
  }

  function updateTurnMode(nextTurnMode: ReaderTurnMode) {
    setTurnMode(nextTurnMode);
    void saveReaderTurnMode(nextTurnMode);
  }

  function updateEyeCare(enabled: boolean) {
    setEyeCare(enabled);
    void saveReaderEyeCare(enabled);
  }


  return (
    <PaperProvider theme={nightMode ? MD3DarkTheme : MD3LightTheme}>
      <View
        style={[styles.screen, { backgroundColor: readerBackgroundColor }]}>
      <StatusBar
        animated
        backgroundColor={readerBackgroundColor}
        hidden
      />

      <View
        style={[
          styles.readerContent,
          { backgroundColor: readerBackgroundColor },
        ]}>
        {chapter ? (
          <View
            style={[
              styles.chapterStatus,
              { backgroundColor: readerBackgroundColor },
            ]}>
            <Text numberOfLines={1} style={styles.chapterStatusTitle}>
              {displayedChapter?.title}
            </Text>
          </View>
        ) : null}

        {!chapter && !error ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text style={styles.feedback}>{error}</Text>
        ) : chapter ? (
          <>
            {turnMode === 'scroll' ? (
              <ScrollView
                contentContainerStyle={styles.content}
                key={`scroll-${scrollReader.contentKey}`}
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                onLayout={scrollReader.onViewportLayout}
                onMomentumScrollEnd={(event) =>
                  scrollReader.handleScroll(event, true)
                }
                onScroll={scrollReader.handleScroll}
                onScrollEndDrag={(event) =>
                  scrollReader.handleScroll(event, true)
                }
                ref={scrollReader.scrollViewRef}
                scrollEventThrottle={100}>
                {chapters.map((item) => (
                  <Pressable
                    key={item.chapter_id}
                    onLayout={(event) =>
                      scrollReader.onChapterLayout(item.chapter_id, event)
                    }
                    onPress={() => {
                      setShowControls((visible) => !visible);
                      setShowSettings(false);
                    }}
                    style={styles.tapArea}>
                    <Text variant="headlineSmall">{item.title}</Text>
                    <View>
                      {item.content
                        .split(/\n+/)
                        .filter(Boolean)
                        .map((paragraph, index) => (
                          <Text
                            key={`${item.chapter_id}-${index}`}
                            style={[
                              styles.paragraph,
                              {
                                fontSize,
                                lineHeight: fontSize + 14,
                              },
                            ]}
                            variant="bodyLarge">
                            {`　　${paragraph}`}
                          </Text>
                        ))}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View
                onLayout={({ nativeEvent }) =>
                  slideReader.onViewportLayout(nativeEvent.layout.height)
                }
                style={styles.slideViewport}>
                {slideReader.measurements.map(({ page, resolve }) => (
                  <View
                    key={`${page.id}-${page.content.length}`}
                    onLayout={({ nativeEvent }) =>
                      resolve(page.id, nativeEvent.layout.height)
                    }
                    pointerEvents="none"
                    style={[styles.pageMeasurer, { width: windowWidth }]}>
                    <View style={styles.slidePage}>
                      <SlidePageContent fontSize={fontSize} page={page} />
                    </View>
                  </View>
                ))}
                {!slideReader.hasInitialSlidePage ? (
                  <View style={styles.loading}>
                    <ActivityIndicator />
                  </View>
                ) : (
                  <FlatList
                    data={slideReader.slidePages}
                    getItemLayout={(_, index) => ({
                      index,
                      length: windowWidth,
                      offset: windowWidth * index,
                    })}
                    horizontal
                    initialNumToRender={3}
                    initialScrollIndex={slideReader.initialSlidePageIndex}
                    key={`slide-${currentChapterId}-${fontSize}-${windowWidth}-${windowHeight}`}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                    onMomentumScrollEnd={slideReader.handleSlidePageChange}
                    pagingEnabled
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => {
                          setShowControls((visible) => !visible);
                          setShowSettings(false);
                        }}
                        style={[styles.slidePage, { width: windowWidth }]}>
                        <SlidePageContent fontSize={fontSize} page={item} />
                      </Pressable>
                    )}
                    showsHorizontalScrollIndicator={false}
                    windowSize={3}
                  />
                )}
              </View>
            )}

          <View
            pointerEvents="none"
            style={[
              styles.brightnessMask,
              { opacity: 1 - brightness },
            ]}
          />

          {showControls ? (
            <Animated.View
              entering={SlideInDown.springify().damping(22).stiffness(180).mass(0.8)}
              exiting={SlideOutDown.springify().damping(24).stiffness(220).mass(0.7)}
              style={[
                styles.navigation,
                { backgroundColor: readerBackgroundColor },
              ]}>
              {showSettings ? (
                <View style={styles.settingsPanel}>
                  <View style={styles.settingsRow}>
                    <Text style={styles.settingLabel}>亮度</Text>
                    <Slider
                      maximumTrackTintColor="#c7c7c7"
                      minimumTrackTintColor="#6750a4"
                      minimumValue={0.2}
                      onValueChange={setBrightness}
                      onSlidingComplete={(value) =>
                        void saveReaderBrightness(value)
                      }
                      style={styles.brightnessBar}
                      thumbTintColor="#6750a4"
                      value={brightness}
                    />
                    <Text>护眼模式</Text>
                    <Switch
                      value={eyeCare}
                      onValueChange={updateEyeCare}
                    />
                  </View>
                  <View style={styles.settingsRow}>
                    <Text style={styles.settingLabel}>字号</Text>
                    <IconButton
                      icon="format-font-size-decrease"
                      mode="contained-tonal"
                      onPress={() => updateFontSize(-1)}
                    />
                    <Text>{fontSize}</Text>
                    <IconButton
                      icon="format-font-size-increase"
                      mode="contained-tonal"
                      onPress={() => updateFontSize(1)}
                    />
                  </View>
                  <View style={styles.settingsRow}>
                    <Text style={styles.settingLabel}>翻页</Text>
                    <SegmentedButtons<ReaderTurnMode>
                      buttons={[
                        { label: '上下', value: 'scroll' },
                        { label: '平移', value: 'slide' },
                      ]}
                      onValueChange={updateTurnMode}
                      style={styles.turnModeSelector}
                      value={turnMode}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.chapterControls}>
                  <Button
                    compact
                    disabled={chapter.chapter_id <= 1}
                    mode="text"
                    onPress={() => jumpToChapter(chapter.chapter_id - 1)}>
                    上一章
                  </Button>
                  <View style={styles.chapterProgress}>
                    <ProgressBar
                      progress={chapter.chapter_id / chapter.total_chapters}
                    />
                  </View>
                  <Button
                    compact
                    disabled={chapter.chapter_id >= chapter.total_chapters}
                    mode="text"
                    onPress={() => jumpToChapter(chapter.chapter_id + 1)}>
                    下一章
                  </Button>
                </View>
              )}
              <View style={styles.readerActions}>
                <View style={styles.readerAction}>
                  <IconButton
                    icon="format-list-bulleted"
                    onPress={() =>
                      router.push({
                        pathname: '/book/[source]/[bookId]/chapters',
                        params: {
                          source,
                          bookId,
                          sources: sources ?? '[]',
                          currentChapterId: String(chapter.chapter_id),
                        },
                      })
                    }
                  />
                  <Text variant="bodySmall">目录</Text>
                </View>
                <View style={styles.readerAction}>
                  <IconButton
                    icon="headphones"
                    onPress={() => {
                      void startListening({
                        source,
                        bookId,
                        chapterId: listeningStart.chapterId,
                        startOffset: listeningStart.offset,
                      });
                      router.push('/listen');
                    }}
                  />
                  <Text variant="bodySmall">朗读</Text>
                </View>
                <View style={styles.readerAction}>
                  <IconButton
                    icon="swap-horizontal"
                    onPress={() =>
                      router.push({
                        pathname: '/book/[source]/[bookId]/sources',
                        params: { source, bookId, sources: sources ?? '[]' },
                      })
                    }
                  />
                  <Text variant="bodySmall">切换</Text>
                </View>
                <View style={styles.readerAction}>
                  <IconButton
                    icon="cog-outline"
                    onPress={() => setShowSettings((visible) => !visible)}
                  />
                  <Text variant="bodySmall">设置</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}
          </>
        ) : null}
      </View>

      {showControls ? (
        <Animated.View
          entering={SlideInUp.springify().damping(22).stiffness(180).mass(0.8)}
          exiting={SlideOutUp.springify().damping(24).stiffness(220).mass(0.7)}
          style={styles.topPanel}>
          <Appbar.Header>
            <Appbar.Action
              accessibilityLabel="返回"
              icon="chevron-left"
              isLeading
              onPress={() => router.back()}
              size={20}
            />
            <Appbar.Content
              title={displayedChapter?.title ?? '阅读'}
              titleStyle={styles.topPanelTitle}
            />
            <Appbar.Action
              accessibilityLabel={nightMode ? '日间模式' : '夜间模式'}
              icon={nightMode ? 'white-balance-sunny' : 'weather-night'}
              onPress={() => setNightMode((enabled) => !enabled)}
            />
            <Appbar.Action
              accessibilityLabel="移出书架"
              icon="star"
              onPress={() => removeBook(source, bookId)}
            />
            <Menu
              anchor={
                <Appbar.Action
                  accessibilityLabel="更多"
                  icon="dots-horizontal"
                  onPress={() => setMoreVisible(true)}
                />
              }
              onDismiss={() => setMoreVisible(false)}
              visible={moreVisible}>
              <Menu.Item
                leadingIcon="book-open-variant"
                onPress={() => {
                  setMoreVisible(false);
                  router.push({
                    pathname: '/book/[source]/[bookId]',
                    params: { source, bookId, sources: sources ?? '[]' },
                  });
                }}
                title="书本详情"
              />
            </Menu>
          </Appbar.Header>
        </Animated.View>
      ) : null}
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  readerContent: {
    flex: 1,
  },
  brightnessMask: {
    backgroundColor: '#000000',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  chapterStatus: {
    alignItems: 'flex-start',
    backgroundColor: READER_BACKGROUND_COLOR,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chapterStatusTitle: {
    color: '#8a8a8a',
    fontSize: 12,
    lineHeight: 16,
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  tapArea: {
    flexGrow: 1,
    gap: 24,
  },
  slidePage: {
    gap: 24,
    padding: 24,
  },
  slideViewport: {
    flex: 1,
  },
  pageMeasurer: {
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 30,
    marginBottom: 28,
  },
  navigation: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    bottom: 0,
    gap: 8,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 16,
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  chapterControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  chapterProgress: {
    flex: 1,
  },
  readerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  readerAction: {
    alignItems: 'center',
  },
  settingsPanel: {
    gap: 8,
    paddingHorizontal: 12,
    width: '100%',
  },
  settingsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  settingLabel: {
    width: 32,
  },
  turnModeSelector: {
    flex: 1,
  },
  brightnessBar: {
    flex: 1,
  },
  topPanel: {
    elevation: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  topPanelTitle: {
    fontSize: 20,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  feedback: {
    alignSelf: 'center',
    marginTop: 24,
  },
});
