export const CAPTURE_CONTEXTS = {
  GOOGLE_MEET_ROOM: "google_meet_room",
  GENERIC_TAB: "generic_tab",
} as const;

export type CaptureContext =
  (typeof CAPTURE_CONTEXTS)[keyof typeof CAPTURE_CONTEXTS];

export const AUDIO_SOURCE_TYPES = {
  TAB_MIX: "tab_mix",
  SELF_MIC: "self_mic",
} as const;

export type AudioSourceType =
  (typeof AUDIO_SOURCE_TYPES)[keyof typeof AUDIO_SOURCE_TYPES];
