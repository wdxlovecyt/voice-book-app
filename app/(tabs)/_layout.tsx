import { useEffect, useRef } from 'react';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { router, Tabs } from 'expo-router';
import {
  Animated,
  type ColorValue,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import { useListeningPlayer } from '../../src/contexts/listening';
import { CircularListeningProgress } from '../../src/components/CircularListeningProgress';

function ListeningTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const { book, isPlaying, progress } = useListeningPlayer();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isPlaying || !book?.cover) {
      rotation.stopAnimation();
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => animation.stop();
  }, [book?.cover, isPlaying, rotation]);

  if (!book?.cover) {
    return <MaterialDesignIcons color={color} name="headphones" size={size} />;
  }

  const coverSize = 44;
  const progressSize = 48;
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      style={[
        styles.tabCover,
        { height: progressSize, width: progressSize },
      ]}>
      <Animated.Image
        source={{ uri: book.cover }}
        style={[
          styles.playingCover,
          {
            height: coverSize,
            transform: [{ rotate: spin }],
            width: coverSize,
          },
        ]}
      />
      <CircularListeningProgress
        color="#F59E0B"
        size={progressSize}
        value={progress.value}
      />
    </View>
  );
}

export default function TabLayout() {
  const { book, isPlaying, resumeListening } = useListeningPlayer();
  const hasListeningCover = Boolean(book?.cover);

  return (
    <Tabs initialRouteName="bookshelf" screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="bookshelf"
        options={{
          title: '书架',
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons
              color={color}
              name="bookshelf"
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            void resumeListening();
            router.push('/listen');
          },
        }}
        name="listen-entry"
        options={{
          title: '听书',
          tabBarLabel: hasListeningCover ? () => null : undefined,
          tabBarIcon: ({ color, size }) => (
            <ListeningTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '书城',
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons
              color={color}
              name="storefront-outline"
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabCover: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  playingCover: {
    borderRadius: 999,
  },
});
