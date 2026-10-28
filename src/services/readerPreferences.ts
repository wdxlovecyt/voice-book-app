import { File, Paths } from 'expo-file-system';

const DEFAULT_BRIGHTNESS = 1;
const DEFAULT_EYE_CARE = false;
const DEFAULT_FONT_SIZE = 16;
const MAX_FONT_SIZE = 24;
const MIN_BRIGHTNESS = 0.2;
const MIN_FONT_SIZE = 14;
const DEFAULT_TURN_MODE: ReaderTurnMode = 'scroll';
const PREFERENCES_FILE = new File(Paths.document, 'reader-preferences.json');

export type ReaderTurnMode = 'scroll' | 'slide';

type ReaderPreferences = {
  brightness?: unknown;
  eyeCare?: unknown;
  fontSize?: unknown;
  turnMode?: unknown;
};

function normalizeBrightness(value: unknown) {
  if (typeof value !== 'number') {
    return DEFAULT_BRIGHTNESS;
  }

  return Math.min(1, Math.max(MIN_BRIGHTNESS, value));
}

function normalizeFontSize(value: unknown) {
  if (typeof value !== 'number') {
    return DEFAULT_FONT_SIZE;
  }

  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(value)));
}

function normalizeTurnMode(value: unknown): ReaderTurnMode {
  return value === 'slide' || value === 'scroll'
    ? value
    : DEFAULT_TURN_MODE;
}

async function readPreferences(): Promise<ReaderPreferences> {
  try {
    if (!PREFERENCES_FILE.exists) {
      return {};
    }

    return JSON.parse(await PREFERENCES_FILE.text()) as ReaderPreferences;
  } catch {
    return {};
  }
}

function writePreferences(preferences: ReaderPreferences) {
  PREFERENCES_FILE.create({ intermediates: true, overwrite: true });
  PREFERENCES_FILE.write(JSON.stringify(preferences));
}

export async function getReaderFontSize() {
  const preferences = await readPreferences();

  return normalizeFontSize(preferences.fontSize);
}

export async function saveReaderFontSize(fontSize: number) {
  const value = normalizeFontSize(fontSize);
  const preferences = await readPreferences();

  writePreferences({ ...preferences, fontSize: value });

  return value;
}

export async function getReaderBrightness() {
  const preferences = await readPreferences();

  return normalizeBrightness(preferences.brightness);
}

export async function saveReaderBrightness(brightness: number) {
  const value = normalizeBrightness(brightness);
  const preferences = await readPreferences();

  writePreferences({ ...preferences, brightness: value });

  return value;
}

export async function getReaderEyeCare() {
  const preferences = await readPreferences();

  return preferences.eyeCare === true ? true : DEFAULT_EYE_CARE;
}

export async function saveReaderEyeCare(eyeCare: boolean) {
  const preferences = await readPreferences();

  writePreferences({ ...preferences, eyeCare });

  return eyeCare;
}

export async function getReaderTurnMode() {
  const preferences = await readPreferences();

  return normalizeTurnMode(preferences.turnMode);
}

export async function saveReaderTurnMode(mode: ReaderTurnMode) {
  const preferences = await readPreferences();

  writePreferences({ ...preferences, turnMode: normalizeTurnMode(mode) });
}
