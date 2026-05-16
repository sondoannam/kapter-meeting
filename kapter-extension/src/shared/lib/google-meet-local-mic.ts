import type {
  MeetLocalMicSnapshot,
  MeetLocalMicState,
} from "@/shared/types/messages";

const MEET_MIC_CONTROL_SELECTOR = [
  "button[aria-label]",
  "button[data-tooltip]",
  "button[title]",
  'div[role="button"][aria-label]',
  'div[role="button"][data-tooltip]',
  'div[role="button"][title]',
].join(", ");

function normalizeMeetControlLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getMeetControlLabels(element: Element): string[] {
  const labels = [
    element.getAttribute("aria-label"),
    element.getAttribute("data-tooltip"),
    element.getAttribute("title"),
    element.textContent,
  ];

  return Array.from(
    new Set(
      labels
        .map((label) => label?.trim())
        .filter((label): label is string => Boolean(label)),
    ),
  );
}

function isMeetMicControlLabel(label: string): boolean {
  return /\bmicro(phone)?\b|\bmic\b/.test(label);
}

function resolveMeetLocalMicStateFromLabel(label: string): MeetLocalMicState {
  const mutedPatterns = [
    "turn on microphone",
    "turn on mic",
    "unmute",
    "bat mic",
    "bat micro",
    "join with audio",
  ];
  const unmutedPatterns = [
    "turn off microphone",
    "turn off mic",
    "mute",
    "tat mic",
    "tat micro",
  ];

  if (mutedPatterns.some((pattern) => label.includes(pattern))) {
    return "muted";
  }

  if (unmutedPatterns.some((pattern) => label.includes(pattern))) {
    return "unmuted";
  }

  return "unknown";
}

export function isMeetLocalMicExplicitlyUnmuted(
  state?: MeetLocalMicState,
): boolean {
  return state === "unmuted";
}

export function readMeetLocalMicSnapshot(
  doc: Document = document,
): MeetLocalMicSnapshot {
  const micControls = Array.from(doc.querySelectorAll(MEET_MIC_CONTROL_SELECTOR));
  let fallbackSnapshot: MeetLocalMicSnapshot | null = null;

  for (const control of micControls) {
    const labels = getMeetControlLabels(control);

    for (const label of labels) {
      const normalizedLabel = normalizeMeetControlLabel(label);

      if (!isMeetMicControlLabel(normalizedLabel)) {
        continue;
      }

      const state = resolveMeetLocalMicStateFromLabel(normalizedLabel);

      if (state === "unknown") {
        fallbackSnapshot ??= {
          state,
          controlLabel: label,
        };
        continue;
      }

      return {
        state,
        controlLabel: label,
      };
    }
  }

  return fallbackSnapshot ?? { state: "unknown" };
}
