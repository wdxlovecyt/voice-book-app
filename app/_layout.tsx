import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';

import { BookshelfProvider } from '../src/contexts/bookshelf';
import { AppUpdateProvider } from '../src/contexts/appUpdate';
import { PersistentListeningPlayer } from '../src/components/PersistentListeningPlayer';
import { ListeningProvider } from '../src/contexts/listening';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <BookshelfProvider>
          <ListeningProvider>
            <AppUpdateProvider>
              <Stack screenOptions={{ headerShown: false }} />
              <PersistentListeningPlayer />
            </AppUpdateProvider>
          </ListeningProvider>
        </BookshelfProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
