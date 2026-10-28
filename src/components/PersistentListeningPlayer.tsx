import { router, usePathname } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IconButton, Portal, Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircularListeningProgress } from './CircularListeningProgress';
import { useListeningPlayer } from '../contexts/listening';

const FLOATING_PLAYER_MARGIN = 16;
const FLOATING_PLAYER_BOTTOM_OFFSET = 80;

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}

export function PersistentListeningPlayer() {
  const pathname = usePathname();
  const { bottom, top } = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [playerSize, setPlayerSize] = useState({
    height: 64,
    width: 160,
  });
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const floatingOpacity = useSharedValue(1);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const coverRotation = useSharedValue(0);
  const {
    book,
    isFloatingPlayerVisible,
    isPlaying,
    listenTarget,
    pause,
    play,
    progress,
    selectListeningChapter,
  } = useListeningPlayer();
  const floatingVisibilityRef = useRef(isFloatingPlayerVisible);

  const dragBounds = useMemo(() => {
    const initialTop =
      windowHeight -
      (bottom + FLOATING_PLAYER_BOTTOM_OFFSET) -
      playerSize.height;

    return {
      maxX: Math.max(
        0,
        windowWidth - playerSize.width - FLOATING_PLAYER_MARGIN * 2,
      ),
      maxY: Math.max(
        0,
        windowHeight - bottom - FLOATING_PLAYER_MARGIN - playerSize.height -
          initialTop,
      ),
      minY: Math.min(0, top + FLOATING_PLAYER_MARGIN - initialTop),
    };
  }, [bottom, playerSize.height, playerSize.width, top, windowHeight, windowWidth]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(3)
        .onBegin(() => {
          dragStartX.value = translationX.value;
          dragStartY.value = translationY.value;
        })
        .onUpdate((event) => {
          translationX.value = clamp(
            dragStartX.value + event.translationX,
            0,
            dragBounds.maxX,
          );
          translationY.value = clamp(
            dragStartY.value + event.translationY,
            dragBounds.minY,
            dragBounds.maxY,
          );
        })
        .onFinalize(() => {
          translationX.value = withSpring(
            translationX.value > dragBounds.maxX / 2 ? dragBounds.maxX : 0,
          );
        }),
    [dragBounds, dragStartX, dragStartY, translationX, translationY],
  );

  const animatedFloatingStyle = useAnimatedStyle(() => ({
    opacity: floatingOpacity.value,
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
    ],
  }));

  const animatedCoverStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${coverRotation.value}deg` }],
  }));

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimation(coverRotation);
      return;
    }

    coverRotation.value = 0;
    coverRotation.value = withRepeat(
      withTiming(360, {
        duration: 12000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => cancelAnimation(coverRotation);
  }, [coverRotation, isPlaying]);

  useLayoutEffect(() => {
    const wasVisible = floatingVisibilityRef.current;
    floatingVisibilityRef.current = isFloatingPlayerVisible;

    if (!isFloatingPlayerVisible) {
      floatingOpacity.value = 0;
      return;
    }

    if (wasVisible) {
      floatingOpacity.value = 1;
      return;
    }

    const settledX =
      translationX.value > dragBounds.maxX / 2 ? dragBounds.maxX : 0;
    const enteringX =
      settledX === 0
        ? -playerSize.width - FLOATING_PLAYER_MARGIN
        : dragBounds.maxX + playerSize.width + FLOATING_PLAYER_MARGIN;

    translationX.value = enteringX;
    floatingOpacity.value = 1;
    translationX.value = withTiming(settledX);
  }, [
    dragBounds.maxX,
    floatingOpacity,
    isFloatingPlayerVisible,
    playerSize.width,
    translationX,
  ]);

  if (
    pathname === '/listen' ||
    !book ||
    !listenTarget ||
    !isFloatingPlayerVisible
  ) {
    return null;
  }

  return (
    <Portal>
      <GestureDetector gesture={panGesture}>
        <Animated.View
        style={[
          styles.floating,
          {
            bottom: bottom + FLOATING_PLAYER_BOTTOM_OFFSET,
          },
          animatedFloatingStyle,
        ]}>
        <Surface
          elevation={2}
          mode="flat"
          onLayout={({ nativeEvent }) => setPlayerSize(nativeEvent.layout)}
          style={styles.player}>
          <View style={styles.coverProgress}>
            <Pressable
              accessibilityLabel="打开听书页"
              onPress={() => router.push('/listen')}
              style={styles.coverButton}>
              {book.cover ? (
                <Animated.Image
                  source={{ uri: book.cover }}
                  style={[styles.cover, animatedCoverStyle]}
                />
              ) : (
                <IconButton icon="book-open-variant" />
              )}
            </Pressable>
            <CircularListeningProgress
              color="#F59E0B"
              size={64}
              value={progress.value}
            />
          </View>
          <IconButton
            accessibilityLabel={isPlaying ? '暂停播放' : '开始播放'}
            icon={isPlaying ? 'pause' : 'play'}
            onPress={isPlaying ? pause : play}
          />
          <IconButton
            accessibilityLabel="下一章"
            icon="skip-next"
            onPress={() =>
              selectListeningChapter(Number(listenTarget.chapterId) + 1)
            }
          />
        </Surface>
        </Animated.View>
      </GestureDetector>
    </Portal>
  );
}

const styles = StyleSheet.create({
  floating: {
    left: FLOATING_PLAYER_MARGIN,
    position: 'absolute',
  },
  player: {
    alignItems: 'center',
    borderRadius: 32,
    flexDirection: 'row',
    padding: 4,
  },
  coverProgress: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    position: 'relative',
    width: 64,
  },
  coverButton: {
    borderRadius: 28,
    height: 56,
    overflow: 'hidden',
    width: 56,
  },
  cover: {
    height: '100%',
    width: '100%',
  },
});
