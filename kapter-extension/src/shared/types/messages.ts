import type { ExtensionAuthState } from "@/shared/lib/auth-bridge";
import type {
  AudioSourceType,
  CaptureContext,
  QuotaSnapshot,
} from "@kapter/contracts";
import type {
  StreamAckPayload,
  StreamChunkPayload,
  StreamReadyPayload,
  StreamStartPayload,
  StreamStopPayload,
} from "@kapter/contracts/audio-stream";

export interface BridgeTokenPayload {
  requestId: string;
  sessionToken: string;
  userId: string | null;
}

export interface ExtensionProjectSummary {
  id: string;
  title: string;
  description: string | null;
  isDraft: boolean;
  meetingCount: number;
  updatedAt: string;
}

export interface ProjectSelectionState {
  projects: ExtensionProjectSummary[];
  selectedProjectId: string | null;
}

export type {
  StreamAckPayload,
  StreamChunkPayload,
  StreamReadyPayload,
  StreamStartPayload,
  StreamStopPayload,
};

export interface OffscreenStartPayload {
  sessionId: string;
  streamId: string;
  meetingId: string;
  projectId?: string | null;
  sessionToken: string;
  tabStreamId: string;
  captureContext?: CaptureContext;
  meetLocalMicState?: MeetLocalMicState;
}

export type MeetLocalMicState = "muted" | "unmuted" | "unknown";

export interface MeetLocalMicSnapshot {
  state: MeetLocalMicState;
  controlLabel?: string;
}

// Single source of truth for popup, background, content, and offscreen messages.

export type ExtensionMessage =
  | { type: "GET_PAGE_DATA"; payload: { url: string } }
  | { type: "OPEN_OPTIONS" }
  | {
      type: "LOG_EVENT";
      payload: { event: string; meta?: Record<string, unknown> };
    }
  | { type: "AUTH_START_TOKEN_BRIDGE" }
  | { type: "AUTH_BRIDGE_TOKEN_RECEIVED"; payload: BridgeTokenPayload }
  | { type: "AUTH_GET_STATE" }
  | { type: "AUTH_CLEAR_STATE" }
  | { type: "AUTH_REFRESH_TOKEN" }
  | {
      type: "BRIDGE_SILENT_TOKEN_REQUEST";
      payload: { requestId: string };
    }
  | { type: "GET_PROJECT_SELECTION" }
  | { type: "GET_BILLING_STATUS" }
  | {
      type: "SET_PROJECT_SELECTION";
      payload: { projectId: string | null };
    }
  | {
      type: "START_CAPTURE";
      payload: {
        meetingId?: string;
        projectId?: string | null;
        captureContext?: CaptureContext;
      };
    }
  | { type: "GET_MEET_LOCAL_MIC_STATE" }
  | { type: "STOP_CAPTURE" }
  | { type: "GET_CAPTURE_STATUS" }
  | {
      type: "MIC_PERMISSION_RESULT";
      payload: {
        granted: boolean;
        error?: string;
      };
    }
  | {
      type: "MEET_LOCAL_MIC_STATE_CHANGED";
      payload: {
        state: MeetLocalMicState;
        controlLabel?: string;
        detectedAt: number;
      };
    }
  | { type: "RESET_CAPTURE" }
  | { type: "OFFSCREEN_START"; payload: OffscreenStartPayload }
  | { type: "OFFSCREEN_STOP"; payload?: StreamStopPayload }
  | {
      type: "OFFSCREEN_RECORDING_STARTED";
      payload: {
        sessionId: string;
        streamId: string;
        meetingId: string;
        projectId?: string | null;
        captureContext?: CaptureContext;
        activeSourceTypes?: AudioSourceType[];
        degradedWithoutSelfMic?: boolean;
        degradedReason?: string;
      };
    }
  | {
      type: "OFFSCREEN_STOPPED";
      payload: StreamStopPayload;
    }
  | {
      type: "OFFSCREEN_ERROR";
      payload: { streamId?: string; error: string };
    }
  | {
      type: "OFFSCREEN_MEET_LOCAL_MIC_STATE_CHANGED";
      payload: {
        state: MeetLocalMicState;
        detectedAt: number;
      };
    }
  | {
      type: "CHUNK_SENT";
      payload: { sequence: number; byteLength: number };
    };

interface MessageResponseMap {
  GET_PAGE_DATA: { title: string; content: string };
  OPEN_OPTIONS: void;
  LOG_EVENT: void;
  AUTH_START_TOKEN_BRIDGE: { bridgeUrl: string; requestId: string };
  AUTH_BRIDGE_TOKEN_RECEIVED: {
    expiresAt: number | null;
    userId: string | null;
  };
  AUTH_GET_STATE: ExtensionAuthState;
  AUTH_CLEAR_STATE: void;
  AUTH_REFRESH_TOKEN: { success: boolean };
  BRIDGE_SILENT_TOKEN_REQUEST: void;
  GET_PROJECT_SELECTION: ProjectSelectionState;
  GET_BILLING_STATUS: QuotaSnapshot | null;
  SET_PROJECT_SELECTION: void;
  START_CAPTURE: { sessionId: string; streamId: string };
  GET_MEET_LOCAL_MIC_STATE: MeetLocalMicSnapshot;
  STOP_CAPTURE: void;
  GET_CAPTURE_STATUS: CaptureStatus;
  MIC_PERMISSION_RESULT: void;
  MEET_LOCAL_MIC_STATE_CHANGED: void;
  RESET_CAPTURE: void;
  OFFSCREEN_START: void;
  OFFSCREEN_STOP: void;
  OFFSCREEN_RECORDING_STARTED: void;
  OFFSCREEN_STOPPED: void;
  OFFSCREEN_ERROR: void;
  OFFSCREEN_MEET_LOCAL_MIC_STATE_CHANGED: void;
  CHUNK_SENT: void;
}

export type MessageResponse<T extends keyof MessageResponseMap> =
  MessageResponseMap[T] extends void
    ? { success: true } | { success: false; error: string }
    :
        | { success: true; data: MessageResponseMap[T] }
        | { success: false; error: string };

// ── Shared State Types ─────────────────────────────────────────────────────
export type CaptureState =
  | "idle"
  | "recording"
  | "finishing"
  | "stopped"
  | "error";

export interface CaptureStatus {
  state: CaptureState;
  sessionId?: string;
  streamId?: string;
  meetingId?: string;
  projectId?: string | null;
  captureContext?: CaptureContext;
  meetLocalMicState?: MeetLocalMicState;
  meetLocalMicControlLabel?: string;
  meetLocalMicUpdatedAt?: number;
  activeSourceTypes?: AudioSourceType[];
  degradedWithoutSelfMic?: boolean;
  degradedReason?: string;
  startedAt?: number; // epoch ms
  chunkCount?: number;
  lastChunkSequence?: number;
  error?: string;
}
