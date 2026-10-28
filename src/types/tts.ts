export type TtsRequest = {
  text: string;
  voice: string;
  rate?: string;
  pitch?: string;
};

export type TtsVoice = {
  name: string;
  friendlyName: string;
  gender: string;
  locale: string;
  localeName: string;
};
