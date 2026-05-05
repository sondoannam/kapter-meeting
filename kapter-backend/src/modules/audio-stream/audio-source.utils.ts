import type { AudioSourceType } from "@kapter/contracts";

export const DEFAULT_AUDIO_SOURCE_TYPE: AudioSourceType = "tab_mix";

export const resolveAudioSourceType = (
  sourceType?: AudioSourceType | null,
): AudioSourceType => sourceType ?? DEFAULT_AUDIO_SOURCE_TYPE;

export const toPrismaAudioSourceType = (
  sourceType?: AudioSourceType | null,
): "TAB_MIX" | "SELF_MIC" | undefined => {
  if (sourceType === "tab_mix") {
    return "TAB_MIX";
  }

  if (sourceType === "self_mic") {
    return "SELF_MIC";
  }

  return undefined;
};
