import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  List,
  Menu,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NarrationMode } from '../services/listeningProgress';
import type { TtsVoice } from '../types/tts';

const VOICE_DISPLAY_NAMES: Record<string, string> = {
  'zh-CN-XiaoxiaoNeural': '晓晓',
  'zh-CN-XiaoyiNeural': '晓伊',
  'zh-CN-YunjianNeural': '云健',
  'zh-CN-YunxiNeural': '云希',
  'zh-CN-YunxiaNeural': '云夏',
  'zh-CN-YunyangNeural': '云扬',
  'zh-CN-liaoning-XiaobeiNeural': '晓北',
  'zh-CN-shaanxi-XiaoniNeural': '晓妮',
  'zh-HK-HiuGaaiNeural': '曉佳',
  'zh-HK-HiuMaanNeural': '曉曼',
  'zh-HK-WanLungNeural': '雲龍',
  'zh-TW-HsiaoChenNeural': '曉臻',
  'zh-TW-HsiaoYuNeural': '曉雨',
  'zh-TW-YunJheNeural': '雲哲',
};

export function getVoiceDisplayName(
  voiceName: string,
  voices: TtsVoice[],
) {
  return (
    VOICE_DISPLAY_NAMES[voiceName] ??
    voices.find((voice) => voice.name === voiceName)?.friendlyName ??
    voiceName
  );
}

export type VoiceRole = {
  speaker: string;
  gender: 'male' | 'female' | 'unknown';
};

type VoicePickerSheetProps = {
  error: string | null;
  loading: boolean;
  onDismiss: () => void;
  onModeChange: (mode: NarrationMode) => void;
  onSelect: (speaker: string, voice: TtsVoice) => void;
  onSelectSingleVoice: (voice: TtsVoice) => void;
  narrationMode: NarrationMode;
  roles: VoiceRole[];
  roleVoices: Record<string, string>;
  singleVoice: string;
  visible: boolean;
  voices: TtsVoice[];
};

export function VoicePickerSheet({
  error,
  loading,
  onDismiss,
  onModeChange,
  onSelect,
  onSelectSingleVoice,
  narrationMode,
  roles,
  roleVoices,
  singleVoice,
  visible,
  voices,
}: VoicePickerSheetProps) {
  const [expandedSpeaker, setExpandedSpeaker] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<
    'all' | 'female' | 'male'
  >('all');
  const { bottom } = useSafeAreaInsets();
  const filteredVoices = voices.filter(
    (voice) =>
      genderFilter === 'all' ||
      voice.gender.toLowerCase() === genderFilter,
  );

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
        <Text style={styles.title} variant="headlineSmall">
          音色设置
        </Text>
        <SegmentedButtons
          buttons={[
            { label: '单角色', value: 'single' },
            { label: '多角色', value: 'multi' },
          ]}
          onValueChange={(value) => onModeChange(value as NarrationMode)}
          style={styles.modeTabs}
          value={narrationMode}
        />
        {loading ? (
          <ActivityIndicator style={styles.feedback} />
        ) : error ? (
          <Text style={styles.feedback}>{error}</Text>
        ) : narrationMode === 'single' ? (
          <ScrollView contentContainerStyle={styles.singleVoiceContent}>
            <View style={styles.genderFilters}>
              {[
                ['all', '全部'],
                ['male', '男声'],
                ['female', '女声'],
              ].map(([value, label]) => (
                <Chip
                  key={value}
                  onPress={() =>
                    setGenderFilter(value as 'all' | 'female' | 'male')
                  }
                  selected={genderFilter === value}>
                  {label}
                </Chip>
              ))}
            </View>
            <View style={styles.voiceGrid}>
              {filteredVoices.map((voice) => (
                <Card
                  key={voice.name}
                  onPress={() => onSelectSingleVoice(voice)}
                  style={[
                    styles.voiceCard,
                    singleVoice === voice.name && styles.selectedVoiceCard,
                  ]}>
                  <Card.Content style={styles.voiceCardContent}>
                    <Text variant="titleMedium">
                      {getVoiceDisplayName(voice.name, voices)}
                    </Text>
                  </Card.Content>
                </Card>
              ))}
            </View>
          </ScrollView>
        ) : (
          <ScrollView>
            {roles.map((role) => {
              const selectedVoice = voices.find(
                (voice) => voice.name === roleVoices[role.speaker],
              );

              return (
                <List.Item
                  key={role.speaker}
                  right={() => (
                    <Menu
                      anchor={
                        <Button
                          compact
                          mode="outlined"
                          onPress={() =>
                            setExpandedSpeaker(
                              expandedSpeaker === role.speaker
                                ? null
                                : role.speaker,
                            )
                          }>
                          {selectedVoice
                            ? getVoiceDisplayName(selectedVoice.name, voices)
                            : '选择音色'}
                        </Button>
                      }
                      onDismiss={() => setExpandedSpeaker(null)}
                      visible={expandedSpeaker === role.speaker}>
                      <ScrollView style={styles.menu}>
                        {voices.map((voice) => (
                          <Menu.Item
                            key={voice.name}
                            onPress={() => {
                              onSelect(role.speaker, voice);
                              setExpandedSpeaker(null);
                            }}
                            title={VOICE_DISPLAY_NAMES[voice.name] ?? voice.name}
                          />
                        ))}
                      </ScrollView>
                    </Menu>
                  )}
                  title={role.speaker}
                />
              );
            })}
          </ScrollView>
        )}
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
    maxHeight: '70%',
    paddingTop: 12,
  },
  title: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modeTabs: {
    marginBottom: 12,
    marginHorizontal: 16,
  },
  feedback: {
    margin: 24,
  },
  menu: {
    maxHeight: 280,
  },
  singleVoiceContent: {
    paddingHorizontal: 16,
  },
  genderFilters: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  voiceCard: {
    marginBottom: 12,
    width: '48%',
  },
  selectedVoiceCard: {
    backgroundColor: '#ffede3',
  },
  voiceCardContent: {
    justifyContent: 'center',
    minHeight: 72,
  },
});
