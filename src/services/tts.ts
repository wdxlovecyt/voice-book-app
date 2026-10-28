import { File, Paths } from 'expo-file-system';

import type { TtsRequest, TtsVoice } from '../types/tts';

const API_BASE_URL = 'https://huangwu.xin';

export type TtsAudio = {
  duration: number;
  size: number;
  uri: string;
};

export function deleteTtsAudio(audio: Pick<TtsAudio, 'uri'>) {
  try {
    const file = new File(audio.uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // 缓存文件已经不存在时无需影响播放。
  }
}

const MPEG1_LAYER3_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MPEG2_LAYER3_BITRATES = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
];
const MPEG_SAMPLE_RATES = [
  [11025, 12000, 8000],
  [0, 0, 0],
  [22050, 24000, 16000],
  [44100, 48000, 32000],
];

function getMp3Duration(bytes: Uint8Array) {
  let offset = 0;
  let duration = 0;

  if (
    bytes.length >= 10 &&
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33
  ) {
    offset =
      10 +
      ((bytes[6] & 0x7f) << 21) +
      ((bytes[7] & 0x7f) << 14) +
      ((bytes[8] & 0x7f) << 7) +
      (bytes[9] & 0x7f);
  }

  while (offset + 4 <= bytes.length) {
    const first = bytes[offset];
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];

    if (first !== 0xff || (second & 0xe0) !== 0xe0) {
      offset += 1;
      continue;
    }

    const version = (second >> 3) & 0x03;
    const layer = (second >> 1) & 0x03;
    const bitrateIndex = (third >> 4) & 0x0f;
    const sampleRateIndex = (third >> 2) & 0x03;
    const hasPadding = ((third >> 1) & 0x01) === 1;

    if (
      version === 1 ||
      layer !== 1 ||
      bitrateIndex === 0 ||
      bitrateIndex === 15 ||
      sampleRateIndex === 3
    ) {
      offset += 1;
      continue;
    }

    const sampleRate = MPEG_SAMPLE_RATES[version][sampleRateIndex];
    const bitrate =
      (version === 3 ? MPEG1_LAYER3_BITRATES : MPEG2_LAYER3_BITRATES)[
        bitrateIndex
      ];
    const samplesPerFrame = version === 3 ? 1152 : 576;
    const frameLength =
      Math.floor(
        (version === 3 ? 144 : 72) * ((bitrate * 1000) / sampleRate),
      ) + (hasPadding ? 1 : 0);

    if (frameLength <= 4 || offset + frameLength > bytes.length) {
      offset += 1;
      continue;
    }

    duration += samplesPerFrame / sampleRate;
    offset += frameLength;
  }

  return duration;
}

type VoiceListResponse = {
  items: Array<{
    name: string;
    friendly_name: string;
    gender: string;
    locale: string;
    locale_name: string;
  }>;
};

export async function listTtsVoices(): Promise<TtsVoice[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tts/voices`);

  if (!response.ok) {
    throw new Error(`音色列表获取失败：${response.status}`);
  }

  const result = (await response.json()) as VoiceListResponse;

  return result.items.map((voice) => ({
    name: voice.name,
    friendlyName: voice.friendly_name,
    gender: voice.gender,
    locale: voice.locale,
    localeName: voice.locale_name,
  }));
}

export async function synthesizeSpeech(
  request: TtsRequest,
): Promise<TtsAudio> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed with status ${response.status}.`);
  }

  if (!response.headers.get('content-type')?.includes('audio/mpeg')) {
    throw new Error('TTS service did not return MP3 audio.');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File(
    Paths.cache,
    `speech-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
  );

  file.create();
  file.write(bytes);

  return {
    duration: getMp3Duration(bytes),
    size: bytes.byteLength,
    uri: file.uri,
  };
}
