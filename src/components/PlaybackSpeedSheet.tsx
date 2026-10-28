import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  IconButton,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PlaybackSpeedSheetProps = {
  onDismiss: () => void;
  onRateChange: (rate: number) => void;
  rate: number;
  visible: boolean;
};

export function PlaybackSpeedSheet({
  onDismiss,
  onRateChange,
  rate,
  visible,
}: PlaybackSpeedSheetProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <Portal>
      <Modal
        contentContainerStyle={[
          styles.sheet,
          { paddingBottom: 12 + bottom },
        ]}
        onDismiss={onDismiss}
        style={styles.overlay}
        visible={visible}>
        <View style={styles.header}>
          <IconButton icon="chevron-down" onPress={onDismiss} />
          <Text variant="headlineSmall">语速</Text>
          <Button onPress={() => onRateChange(1)}>重置</Button>
        </View>
        <View style={styles.content}>
          <Text variant="titleLarge">语速 · {rate.toFixed(1)}倍</Text>
          <Slider
            maximumTrackTintColor="#eeeeee"
            maximumValue={3}
            minimumTrackTintColor="#757575"
            minimumValue={0.5}
            onValueChange={onRateChange}
            step={0.1}
            thumbTintColor="#ffffff"
            value={rate}
          />
          <View style={styles.scale}>
            {[0.5, 1, 1.5, 2, 2.5, 3].map((value) => (
              <Text key={value}>{value.toFixed(1)}</Text>
            ))}
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'flex-end',
    marginBottom: 0,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: {
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
