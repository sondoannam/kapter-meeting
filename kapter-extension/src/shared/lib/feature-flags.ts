const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSY_ENV_VALUES = new Set(["0", "false", "no", "off"]);

function readBooleanEnvFlag(flagName: string, defaultValue: boolean): boolean {
  const rawValue = (
    import.meta as { env?: Record<string, string | undefined> }
  ).env?.[flagName]
    ?.trim()
    .toLowerCase();

  if (!rawValue) {
    return defaultValue;
  }

  if (TRUTHY_ENV_VALUES.has(rawValue)) {
    return true;
  }

  if (FALSY_ENV_VALUES.has(rawValue)) {
    return false;
  }

  return defaultValue;
}

export function isGoogleMeetDualLaneCaptureEnabled(): boolean {
  return readBooleanEnvFlag("VITE_ENABLE_GOOGLE_MEET_DUAL_LANE_CAPTURE", true);
}
