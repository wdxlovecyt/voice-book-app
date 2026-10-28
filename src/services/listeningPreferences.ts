import { File, Paths } from 'expo-file-system';

import type { NarrationMode } from './listeningProgress';

const DEFAULT_PLAYBACK_RATE = 1;
const DEFAULT_SINGLE_VOICE = 'zh-CN-XiaoxiaoNeural';
const MAX_PLAYBACK_RATE = 3;
const MIN_PLAYBACK_RATE = 0.5;
const preferencesFile = new File(Paths.document, 'listening-preferences.json');

type ListeningPreferences = {
  narrationMode?: unknown;
  playbackRate?: unknown;
  singleVoice?: unknown;
};

function normalizePlaybackRate(value: unknown) {
  if (typeof value !== 'number') {
    return DEFAULT_PLAYBACK_RATE;
  }

  return Math.min(
    MAX_PLAYBACK_RATE,
    Math.max(MIN_PLAYBACK_RATE, Math.round(value * 10) / 10),
  );
}

function normalizeNarrationMode(value: unknown): NarrationMode {
  return value === 'single' ? 'single' : 'multi';
}

function normalizeSingleVoice(value: unknown) {
  return typeof value === 'string' ? value : DEFAULT_SINGLE_VOICE;
}

async function readPreferences(): Promise<ListeningPreferences> {
  try {
    if (!preferencesFile.exists) {
      return {};
    }

    return JSON.parse(await preferencesFile.text()) as ListeningPreferences;
  } catch {
    return {};
  }
}

function writePreferences(preferences: ListeningPreferences) {
  preferencesFile.create({ intermediates: true, overwrite: true });
  preferencesFile.write(JSON.stringify(preferences));
}

export async function getListeningPlaybackRate() {
  const preferences = await readPreferences();

  return normalizePlaybackRate(preferences.playbackRate);
}

export async function saveListeningPlaybackRate(rate: number) {
  const playbackRate = normalizePlaybackRate(rate);
  const preferences = await readPreferences();

  writePreferences({ ...preferences, playbackRate });

  return playbackRate;
}

export async function getListeningNarrationSettings() {
  const preferences = await readPreferences();

  return {
    narrationMode: normalizeNarrationMode(preferences.narrationMode),
    singleVoice: normalizeSingleVoice(preferences.singleVoice),
  };
}

export async function saveListeningNarrationSettings(
  settings: {
    narrationMode: NarrationMode;
    singleVoice: string;
  },
) {
  const preferences = await readPreferences();

  writePreferences({
    ...preferences,
    narrationMode: normalizeNarrationMode(settings.narrationMode),
    singleVoice: normalizeSingleVoice(settings.singleVoice),
  });
}
