import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Appbar } from 'react-native-paper';

export default function BookstoreScreen() {
  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="书城" />
        <Appbar.Action
          icon="magnify"
          onPress={() => router.push('/search')}
        />
      </Appbar.Header>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
