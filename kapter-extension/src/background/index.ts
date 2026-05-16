import browser from "webextension-polyfill";

import {
  DEFAULT_AUTH_STATE,
  buildDisconnectedAuthState,
  buildExtensionBridgeUrl,
  isAuthStateExpired,
  isAuthStateExpiringSoon,
  isPendingAuthStateStale,
  isBridgePageLocation,
  normalizeAuthState,
  readJwtExpiration,
  BRIDGE_SILENT_TOKEN_REQUEST,
} from "@/shared/lib/auth-bridge";
import { isGoogleMeetDualLaneCaptureEnabled } from "@/shared/lib/feature-flags";
import { isMeetLocalMicExplicitlyUnmuted } from "@/shared/lib/google-meet-local-mic";
import { extractGoogleMeetId, isGoogleMeetUrl } from "@/shared/lib/google-meet";
import { onMessage } from "@/shared/lib/messaging";
import { getStorage, setStorage } from "@/shared/lib/storage";
import type {
  CaptureStatus,
  MeetLocalMicSnapshot,
  MeetLocalMicState,
  MessageResponse,
} from "@/shared/types/messages";
import type { AudioSourceType, CaptureContext } from "@kapter/contracts";

import { syncBackendSession } from "./backend-auth";
import { fetchBillingQuota } from "./backend-billing";
import { fetchProjects } from "./backend-projects";

const DEFAULT_CAPTURE_STATUS: CaptureStatus = { state: "idle" };
const OFFSCREEN_URL = chrome.runtime.getURL("src/offscreen/index.html");
const MIC_PERMISSION_REQUEST_URL = chrome.runtime.getURL(
  "src/request-mic/index.html",
);
const OFFSCREEN_START_TIMEOUT_MS = 15_000;
const OFFSCREEN_STOP_TIMEOUT_MS = 60_000;
const MIC_PERMISSION_REQUEST_TIMEOUT_MS = 60_000;

function isAudioSourceType(value: unknown): value is AudioSourceType {
  return value === "tab_mix" || value === "self_mic";
}

function deriveCaptureContext(url: string): CaptureContext {
  return isGoogleMeetUrl(url) ? "google_meet_room" : "generic_tab";
}

type PendingOffscreenSignalType = "start" | "stop";

interface PendingOffscreenSignal {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface MicPermissionResolution {
  granted: boolean;
  error?: string;
}

interface PendingMicPermissionRequest {
  resolve: (result: MicPermissionResolution) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  onRemoved: (tabId: number) => void;
}

const pendingOffscreenSignals = new Map<string, PendingOffscreenSignal>();
const pendingMicPermissionRequests = new Map<
  number,
  PendingMicPermissionRequest
>();

async function getAuthState() {
  return normalizeAuthState(await getStorage("auth"));
}

async function setAuthState(state: typeof DEFAULT_AUTH_STATE) {
  await setStorage("auth", state);
}

async function getFreshAuthState() {
  const authState = await getAuthState();
  const now = Date.now();

  if (isPendingAuthStateStale(authState, now)) {
    const stalePendingState = buildDisconnectedAuthState({
      updatedAt: now,
      lastError:
        "The secure dashboard handoff expired before it completed. Start it again.",
    });

    await setAuthState(stalePendingState);
    return stalePendingState;
  }

  if (authState.sessionToken && !isAuthStateExpired(authState, now)) {
    // If expiring soon, trigger refresh in background
    if (isAuthStateExpiringSoon(authState, now)) {
      void refreshAuthToken();
    }
    return authState;
  }

  // If we are disconnected but not pending, try one silent refresh
  if (authState.status === "disconnected") {
    void refreshAuthToken();
  }

  const expiredState = buildDisconnectedAuthState({
    updatedAt: now,
    lastError: authState.sessionToken
      ? "Stored extension session expired. Attempting silent reconnect..."
      : null,
  });

  // We don't overwrite the state to "disconnected" if it's already "pending"
  if (authState.status !== "pending") {
    await setAuthState(expiredState);
    return expiredState;
  }

  return authState;
}

let pendingRefreshPromise: Promise<boolean> | null = null;

async function refreshAuthToken(): Promise<boolean> {
  // If a refresh is already in progress, return the existing promise
  if (pendingRefreshPromise) {
    console.log("[bg] Silent refresh already in progress, deduplicating...");
    return pendingRefreshPromise;
  }

  const authState = await getAuthState();
  const webappUrl = new URL(import.meta.env.VITE_WEBAPP_URL);
  const webappOrigin = `${webappUrl.origin}/*`;

  const tabs = await browser.tabs.query({ url: webappOrigin });

  if (tabs.length === 0) {
    console.log("[bg] No Kapter Dashboard tabs found for silent refresh.");
    return false;
  }

  const requestId = crypto.randomUUID();

  pendingRefreshPromise = (async () => {
    try {
      // Update state to pending so we can accept the incoming bridge token
      await setAuthState({
        ...authState,
        status: "pending",
        requestId,
        updatedAt: Date.now(),
      });

      console.log(
        `[bg] Attempting silent refresh via ${tabs.length} tab(s)...`,
      );

      for (const tab of tabs) {
        if (tab.id) {
          await browser.tabs
            .sendMessage(tab.id, {
              type: BRIDGE_SILENT_TOKEN_REQUEST,
              payload: { requestId },
            })
            .catch(() => undefined);
        }
      }

      // We wait for a maximum of 30 seconds for the bridge to respond.
      // The actual resolution happens via the AUTH_BRIDGE_TOKEN_RECEIVED listener.
      return new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          cleanup();
          console.log("[bg] Silent refresh timed out.");
          resolve(false);
        }, 30_000);

        const checkInterval = setInterval(async () => {
          const current = await getAuthState();
          if (current.status === "connected") {
            cleanup();
            resolve(true);
          } else if (current.status === "disconnected") {
            cleanup();
            resolve(false);
          }
        }, 500);

        function cleanup() {
          clearTimeout(timeoutId);
          clearInterval(checkInterval);
          pendingRefreshPromise = null;
        }
      });
    } catch (error) {
      console.error("[bg] Silent refresh failed:", error);
      pendingRefreshPromise = null;
      return false;
    }
  })();

  return pendingRefreshPromise;
}

// Check token health every minute
setInterval(async () => {
  const authState = await getAuthState();
  if (authState.status === "connected" && isAuthStateExpiringSoon(authState)) {
    console.log("[bg] Token expiring soon, triggering silent refresh...");
    await refreshAuthToken();
  }
}, 60_000);

async function getCaptureStatus(): Promise<CaptureStatus> {
  return (await getStorage("captureStatus")) ?? DEFAULT_CAPTURE_STATUS;
}

async function getRecorderMicPermissionGranted(): Promise<boolean> {
  return (await getStorage("recorderMicPermissionGranted")) ?? false;
}

async function setRecorderMicPermissionGranted(value: boolean): Promise<void> {
  await setStorage("recorderMicPermissionGranted", value);
}

async function hasOffscreenDocument(): Promise<boolean> {
  if ("hasDocument" in chrome.offscreen) {
    return chrome.offscreen.hasDocument();
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [OFFSCREEN_URL],
  });

  return contexts.length > 0;
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification:
      "Capture active tab audio and optional recorder microphone for Kapter",
  });
}

async function getTabCaptureStreamId(targetTabId: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, (streamId) => {
      const errorMessage = chrome.runtime.lastError?.message;

      if (errorMessage || !streamId) {
        reject(
          new Error(
            errorMessage ??
              "Could not acquire a tab-capture stream for the active tab.",
          ),
        );
        return;
      }

      resolve(streamId);
    });
  });
}

async function closeOffscreenDocument(): Promise<void> {
  if (!(await hasOffscreenDocument())) {
    return;
  }

  await chrome.offscreen.closeDocument();
}

async function updateStatus(patch: Partial<CaptureStatus>): Promise<void> {
  const current = await getCaptureStatus();
  await setStorage("captureStatus", { ...current, ...patch } as CaptureStatus);
}

function isMeetLocalMicState(value: unknown): value is MeetLocalMicState {
  return value === "muted" || value === "unmuted" || value === "unknown";
}

async function getSelectedProjectId(): Promise<string | null> {
  return (await getStorage("selectedProjectId")) ?? null;
}

async function setSelectedProjectId(projectId: string | null): Promise<void> {
  await setStorage("selectedProjectId", projectId);
}

async function setQuotaStatus(
  quota: Awaited<ReturnType<typeof fetchBillingQuota>> | null,
): Promise<void> {
  await setStorage("quotaStatus", quota);
}

function normalizeProjectId(projectId: unknown): string | null {
  if (typeof projectId !== "string") {
    return null;
  }

  const trimmed = projectId.trim();
  return trimmed ? trimmed : null;
}

function buildOffscreenSignalKey(
  signalType: PendingOffscreenSignalType,
  streamId: string,
): string {
  return `${signalType}:${streamId}`;
}

function waitForOffscreenSignal(
  signalType: PendingOffscreenSignalType,
  streamId: string,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<void> {
  const signalKey = buildOffscreenSignalKey(signalType, streamId);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingOffscreenSignals.delete(signalKey);
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    pendingOffscreenSignals.set(signalKey, {
      resolve: () => {
        clearTimeout(timeoutId);
        pendingOffscreenSignals.delete(signalKey);
        resolve();
      },
      reject: (error: Error) => {
        clearTimeout(timeoutId);
        pendingOffscreenSignals.delete(signalKey);
        reject(error);
      },
      timeoutId,
    });
  });
}

function resolveOffscreenSignal(
  signalType: PendingOffscreenSignalType,
  streamId: string,
): void {
  const signalKey = buildOffscreenSignalKey(signalType, streamId);
  pendingOffscreenSignals.get(signalKey)?.resolve();
}

function rejectOffscreenSignal(
  signalType: PendingOffscreenSignalType,
  streamId: string,
  errorMessage: string,
): void {
  const signalKey = buildOffscreenSignalKey(signalType, streamId);
  pendingOffscreenSignals.get(signalKey)?.reject(new Error(errorMessage));
}

function rejectAllPendingOffscreenSignals(errorMessage: string): void {
  for (const [signalKey, signal] of pendingOffscreenSignals.entries()) {
    clearTimeout(signal.timeoutId);
    pendingOffscreenSignals.delete(signalKey);
    signal.reject(new Error(errorMessage));
  }
}

function shouldRequestRecorderMicPermission(
  captureContext: CaptureContext,
  meetLocalMicState?: MeetLocalMicState,
): boolean {
  return (
    captureContext === "google_meet_room" &&
    isMeetLocalMicExplicitlyUnmuted(meetLocalMicState) &&
    isGoogleMeetDualLaneCaptureEnabled()
  );
}

async function queryCurrentMeetLocalMicSnapshot(
  tabId: number,
  fallbackStatus: CaptureStatus,
): Promise<MeetLocalMicSnapshot> {
  try {
    const response = (await browser.tabs.sendMessage(tabId, {
      type: "GET_MEET_LOCAL_MIC_STATE",
    })) as MessageResponse<"GET_MEET_LOCAL_MIC_STATE">;

    if (response.success && isMeetLocalMicState(response.data.state)) {
      return {
        state: response.data.state,
        controlLabel:
          typeof response.data.controlLabel === "string"
            ? response.data.controlLabel
            : undefined,
      };
    }
  } catch {
    // Fall back to the last known safe state when the content script is unavailable.
  }

  if (fallbackStatus.meetLocalMicState === "muted") {
    return {
      state: "muted",
      controlLabel: fallbackStatus.meetLocalMicControlLabel,
    };
  }

  return { state: "unknown" };
}

async function closeTabIfPresent(tabId: number): Promise<void> {
  try {
    await browser.tabs.remove(tabId);
  } catch {
    // Ignore tabs that were already closed.
  }
}

function resolveMicPermissionRequest(
  tabId: number,
  result: MicPermissionResolution,
): void {
  const pending = pendingMicPermissionRequests.get(tabId);

  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  browser.tabs.onRemoved.removeListener(pending.onRemoved);
  pendingMicPermissionRequests.delete(tabId);
  void setRecorderMicPermissionGranted(result.granted);
  pending.resolve(result);
}

async function ensureRecorderMicrophonePermission(): Promise<MicPermissionResolution> {
  if (await getRecorderMicPermissionGranted()) {
    return { granted: true };
  }

  const tab = await browser.tabs.create({
    url: MIC_PERMISSION_REQUEST_URL,
    active: true,
  });

  if (typeof tab.id !== "number") {
    return {
      granted: false,
      error: "Could not open the microphone permission page.",
    };
  }

  const permissionTabId = tab.id;
  const result = await new Promise<MicPermissionResolution>((resolve) => {
    const onRemoved = (removedTabId: number) => {
      if (removedTabId !== permissionTabId) {
        return;
      }

      resolveMicPermissionRequest(permissionTabId, {
        granted: false,
        error:
          "Microphone permission tab was closed before permission was granted.",
      });
    };

    const timeoutId = setTimeout(() => {
      resolveMicPermissionRequest(permissionTabId, {
        granted: false,
        error: "Timed out while waiting for microphone permission.",
      });
    }, MIC_PERMISSION_REQUEST_TIMEOUT_MS);

    browser.tabs.onRemoved.addListener(onRemoved);
    pendingMicPermissionRequests.set(permissionTabId, {
      resolve,
      timeoutId,
      onRemoved,
    });
  });

  await closeTabIfPresent(permissionTabId);
  return result;
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: Record<string, unknown> },
    _sender,
    sendResponse,
  ) => {
    if (message.type === "CHUNK_SENT") {
      void (async () => {
        const current = await getCaptureStatus();
        await setStorage("captureStatus", {
          ...current,
          chunkCount: (message.payload?.sequence as number) ?? 0,
          lastChunkSequence: (message.payload?.sequence as number) ?? 0,
        } as CaptureStatus);
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.type === "OFFSCREEN_RECORDING_STARTED") {
      if (typeof message.payload?.streamId === "string") {
        resolveOffscreenSignal("start", message.payload.streamId);
      }

      const captureContext =
        message.payload?.captureContext === "google_meet_room" ||
        message.payload?.captureContext === "generic_tab"
          ? message.payload.captureContext
          : undefined;
      const activeSourceTypes = Array.isArray(
        message.payload?.activeSourceTypes,
      )
        ? message.payload.activeSourceTypes.filter(isAudioSourceType)
        : undefined;
      const degradedWithoutSelfMic =
        typeof message.payload?.degradedWithoutSelfMic === "boolean"
          ? message.payload.degradedWithoutSelfMic
          : undefined;
      const degradedReason =
        typeof message.payload?.degradedReason === "string"
          ? message.payload.degradedReason
          : undefined;

      void updateStatus({
        captureContext,
        activeSourceTypes,
        degradedWithoutSelfMic,
        degradedReason,
      });

      if (
        degradedWithoutSelfMic === true &&
        typeof degradedReason === "string" &&
        /permission.*denied|denied/i.test(degradedReason)
      ) {
        void setRecorderMicPermissionGranted(false);
      }

      return false;
    }

    if (message.type === "OFFSCREEN_STOPPED") {
      if (typeof message.payload?.streamId === "string") {
        resolveOffscreenSignal("stop", message.payload.streamId);
      }

      return false;
    }

    if (message.type === "OFFSCREEN_ERROR") {
      const streamId =
        typeof message.payload?.streamId === "string"
          ? message.payload.streamId
          : undefined;
      const errorMessage =
        typeof message.payload?.error === "string"
          ? message.payload.error
          : "The offscreen recorder failed unexpectedly.";

      if (streamId) {
        rejectOffscreenSignal("start", streamId, errorMessage);
        rejectOffscreenSignal("stop", streamId, errorMessage);
      } else {
        rejectAllPendingOffscreenSignals(errorMessage);
      }

      void (async () => {
        if (/unauthorized|token|session/i.test(errorMessage)) {
          await setAuthState(
            buildDisconnectedAuthState({
              lastError:
                "The backend rejected the stored extension session. Run the secure handoff again.",
            }),
          );
        }

        await updateStatus({ state: "error", error: errorMessage });
        await closeOffscreenDocument().catch(() => undefined);
      })();

      return false;
    }

    if (message.type === "LOG_EVENT") {
      console.log("[offscreen→bg]", message.payload);
      return false;
    }

    if (message.type === "DEBUG_LOG") {
      console.log(
        `[offscreen] ${message.payload?.msg ?? JSON.stringify(message.payload)}`,
      );
      return false;
    }
  },
);

onMessage(async (message, sender) => {
  switch (message.type) {
    case "GET_PAGE_DATA": {
      return {
        success: true,
        data: {
          title: "Example",
          content: `Collected from ${message.payload.url}`,
        },
      };
    }

    case "OPEN_OPTIONS": {
      await browser.runtime.openOptionsPage();
      return { success: true };
    }

    case "LOG_EVENT": {
      console.log("[event]", message.payload.event, message.payload.meta ?? {});
      return { success: true };
    }

    case "AUTH_GET_STATE": {
      return {
        success: true,
        data: await getFreshAuthState(),
      };
    }

    case "AUTH_REFRESH_TOKEN": {
      const success = await refreshAuthToken();
      return { success };
    }

    case "AUTH_CLEAR_STATE": {
      await setAuthState(buildDisconnectedAuthState());
      return { success: true };
    }

    case "GET_PROJECT_SELECTION": {
      const authState = await getFreshAuthState();
      const selectedProjectId = await getSelectedProjectId();

      if (authState.status !== "connected" || !authState.sessionToken) {
        return {
          success: true,
          data: {
            projects: [],
            selectedProjectId,
          },
        };
      }

      try {
        const response = await fetchProjects(authState.sessionToken);
        const hasSelectedProject = response.projects.some(
          (project) => project.id === selectedProjectId,
        );
        const nextSelectedProjectId = hasSelectedProject
          ? selectedProjectId
          : null;

        if (nextSelectedProjectId !== selectedProjectId) {
          await setSelectedProjectId(nextSelectedProjectId);
        }

        return {
          success: true,
          data: {
            projects: response.projects,
            selectedProjectId: nextSelectedProjectId,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (/unauthorized|token|session/i.test(errorMessage)) {
          await setAuthState(
            buildDisconnectedAuthState({
              updatedAt: Date.now(),
              lastError: errorMessage,
            }),
          );
        }

        return { success: false, error: errorMessage };
      }
    }

    case "GET_BILLING_STATUS": {
      const authState = await getFreshAuthState();

      if (authState.status !== "connected" || !authState.sessionToken) {
        await setQuotaStatus(null);
        return {
          success: true,
          data: null,
        };
      }

      try {
        const quota = await fetchBillingQuota(authState.sessionToken);
        await setQuotaStatus(quota);

        return {
          success: true,
          data: quota,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (/unauthorized|token|session/i.test(errorMessage)) {
          await setAuthState(
            buildDisconnectedAuthState({
              updatedAt: Date.now(),
              lastError: errorMessage,
            }),
          );
        }

        return { success: false, error: errorMessage };
      }
    }

    case "SET_PROJECT_SELECTION": {
      await setSelectedProjectId(
        normalizeProjectId(message.payload?.projectId),
      );
      return { success: true };
    }

    case "AUTH_START_TOKEN_BRIDGE": {
      const requestId = crypto.randomUUID();

      try {
        const bridgeUrl = buildExtensionBridgeUrl(requestId);

        await setAuthState({
          ...DEFAULT_AUTH_STATE,
          status: "pending",
          requestId,
          updatedAt: Date.now(),
        });

        await browser.tabs.create({
          url: bridgeUrl,
          active: true,
        });

        return {
          success: true,
          data: {
            bridgeUrl,
            requestId,
          },
        };
      } catch (error: unknown) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to open the secure auth bridge.",
        };
      }
    }

    case "AUTH_BRIDGE_TOKEN_RECEIVED": {
      const authState = await getAuthState();
      const now = Date.now();

      if (
        authState.status !== "pending" ||
        authState.requestId !== message.payload.requestId
      ) {
        return {
          success: false,
          error: "Rejected bridge response without a matching pending request.",
        };
      }

      if (!sender.tab?.url || !isBridgePageLocation(sender.tab.url)) {
        return {
          success: false,
          error: "Rejected bridge response from an unexpected tab.",
        };
      }

      const expiresAt = readJwtExpiration(message.payload.sessionToken);

      if (!expiresAt) {
        await setAuthState(
          buildDisconnectedAuthState({
            updatedAt: now,
            lastError:
              "Rejected the bridged Clerk token because it is missing an expiration.",
          }),
        );

        return {
          success: false,
          error:
            "Rejected the bridged Clerk token because it is missing an expiration.",
        };
      }

      if (expiresAt <= now + 15_000) {
        await setAuthState(
          buildDisconnectedAuthState({
            updatedAt: now,
            lastError:
              "Rejected the bridged Clerk token because it is already expired.",
          }),
        );

        return {
          success: false,
          error:
            "Rejected the bridged Clerk token because it is already expired.",
        };
      }

      const nextAuthState = {
        status: "connected" as const,
        requestId: null,
        sessionToken: message.payload.sessionToken,
        userId: message.payload.userId,
        expiresAt,
        updatedAt: now,
        lastError: null,
      };

      await setAuthState(nextAuthState);

      if (typeof sender.tab.id === "number") {
        await browser.tabs.remove(sender.tab.id).catch(() => undefined);
      }

      return {
        success: true,
        data: {
          expiresAt,
          userId: nextAuthState.userId,
        },
      };
    }

    case "GET_CAPTURE_STATUS": {
      return { success: true, data: await getCaptureStatus() };
    }

    case "MIC_PERMISSION_RESULT": {
      const permissionTabId = sender.tab?.id;

      if (typeof permissionTabId !== "number") {
        return {
          success: false,
          error: "Microphone permission result did not come from a tab.",
        };
      }

      resolveMicPermissionRequest(permissionTabId, {
        granted: message.payload.granted === true,
        error:
          typeof message.payload.error === "string"
            ? message.payload.error
            : undefined,
      });

      return { success: true };
    }

    case "MEET_LOCAL_MIC_STATE_CHANGED": {
      if (!isGoogleMeetUrl(sender.tab?.url ?? "")) {
        return { success: true };
      }

      const meetLocalMicState = isMeetLocalMicState(message.payload.state)
        ? message.payload.state
        : "unknown";
      const meetLocalMicControlLabel =
        typeof message.payload.controlLabel === "string"
          ? message.payload.controlLabel
          : undefined;
      const meetLocalMicUpdatedAt =
        typeof message.payload.detectedAt === "number"
          ? message.payload.detectedAt
          : Date.now();

      await updateStatus({
        meetLocalMicState,
        meetLocalMicControlLabel,
        meetLocalMicUpdatedAt,
      });

      const captureStatus = await getCaptureStatus();

      if (
        captureStatus.state === "recording" &&
        captureStatus.captureContext === "google_meet_room"
      ) {
        await chrome.runtime
          .sendMessage({
            type: "OFFSCREEN_MEET_LOCAL_MIC_STATE_CHANGED",
            payload: {
              state: meetLocalMicState,
              detectedAt: meetLocalMicUpdatedAt,
            },
          })
          .catch(() => undefined);
      }

      return { success: true };
    }

    case "START_CAPTURE": {
      let streamId = "";

      try {
        const authState = await getFreshAuthState();

        if (authState.status !== "connected" || !authState.sessionToken) {
          return {
            success: false,
            error:
              authState.lastError ??
              "Connect the extension to the Kapter dashboard before starting capture.",
          };
        }

        try {
          await syncBackendSession(authState.sessionToken);
          const quota = await fetchBillingQuota(authState.sessionToken);
          await setQuotaStatus(quota);

          if (!quota.canRecord) {
            return {
              success: false,
              error:
                quota.reason ??
                "Recording quota is exhausted for the current billing period.",
            };
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          if (/unauthorized|token|session/i.test(errorMessage)) {
            await setAuthState(
              buildDisconnectedAuthState({
                updatedAt: Date.now(),
                lastError: errorMessage,
              }),
            );
          }

          throw error;
        }

        const [activeTab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!activeTab?.id || !activeTab.url) {
          return {
            success: false,
            error: "Could not locate the active browser tab.",
          };
        }

        if (!isGoogleMeetUrl(activeTab.url)) {
          return {
            success: false,
            error: "Open an active Google Meet tab before starting capture.",
          };
        }

        const sessionId = `session_${Date.now()}`;
        const captureContext =
          message.payload?.captureContext ??
          deriveCaptureContext(activeTab.url);
        const currentCaptureStatus = await getCaptureStatus();
        const meetLocalMicSnapshot =
          captureContext === "google_meet_room"
            ? await queryCurrentMeetLocalMicSnapshot(
                activeTab.id,
                currentCaptureStatus,
              )
            : null;
        const meetLocalMicState = meetLocalMicSnapshot?.state;
        const meetingId =
          message.payload?.meetingId ?? extractGoogleMeetId(activeTab.url);
        const projectId =
          normalizeProjectId(message.payload?.projectId) ??
          (await getSelectedProjectId());

        if (!meetingId) {
          return {
            success: false,
            error:
              "Could not determine the current Google Meet id from the active tab.",
          };
        }

        if (meetLocalMicSnapshot) {
          await updateStatus({
            meetLocalMicState: meetLocalMicSnapshot.state,
            meetLocalMicControlLabel: meetLocalMicSnapshot.controlLabel,
            meetLocalMicUpdatedAt: Date.now(),
          });
        }

        if (
          shouldRequestRecorderMicPermission(captureContext, meetLocalMicState)
        ) {
          await ensureRecorderMicrophonePermission();
        }

        streamId = `stream_${crypto.randomUUID()}`;
        const tabStreamId = await getTabCaptureStreamId(activeTab.id);
        const offscreenStartWait = waitForOffscreenSignal(
          "start",
          streamId,
          OFFSCREEN_START_TIMEOUT_MS,
          "Timed out while waiting for the recorder to connect to the audio gateway.",
        );

        await ensureOffscreenDocument();

        await chrome.runtime.sendMessage({
          type: "OFFSCREEN_START",
          payload: {
            sessionToken: authState.sessionToken,
            sessionId,
            streamId,
            meetingId,
            projectId,
            tabStreamId,
            captureContext,
            meetLocalMicState,
          },
        });

        await offscreenStartWait;

        await updateStatus({
          state: "recording",
          sessionId,
          streamId,
          meetingId,
          projectId,
          captureContext,
          startedAt: Date.now(),
          chunkCount: 0,
          lastChunkSequence: 0,
          error: undefined,
        });

        return { success: true, data: { sessionId, streamId } };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (streamId) {
          rejectOffscreenSignal("start", streamId, errorMessage);
        }

        await updateStatus({ state: "error", error: errorMessage });
        await closeOffscreenDocument().catch(() => undefined);

        return { success: false, error: errorMessage };
      }
    }

    case "STOP_CAPTURE": {
      try {
        const currentStatus = await getCaptureStatus();

        if (await hasOffscreenDocument()) {
          const currentStreamId = currentStatus.streamId;

          if (currentStreamId) {
            await updateStatus({ state: "finishing" });

            const offscreenStopWait = waitForOffscreenSignal(
              "stop",
              currentStreamId,
              OFFSCREEN_STOP_TIMEOUT_MS,
              "Timed out while waiting for the recorder to stop.",
            );

            await chrome.runtime.sendMessage({
              type: "OFFSCREEN_STOP",
              payload: { streamId: currentStreamId },
            });
            await offscreenStopWait;
          }

          await closeOffscreenDocument();
        }

        await updateStatus({
          state: "stopped",
          error: undefined,
          activeSourceTypes: undefined,
          degradedWithoutSelfMic: undefined,
          degradedReason: undefined,
        });
        return { success: true };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await updateStatus({ state: "error", error: errorMessage });
        await closeOffscreenDocument().catch(() => undefined);

        return { success: false, error: errorMessage };
      }
    }

    case "RESET_CAPTURE": {
      await updateStatus({
        state: "idle",
        captureContext: undefined,
        activeSourceTypes: undefined,
        degradedWithoutSelfMic: undefined,
        degradedReason: undefined,
        chunkCount: 0,
        lastChunkSequence: undefined,
        sessionId: undefined,
        streamId: undefined,
        meetingId: undefined,
        projectId: undefined,
        startedAt: undefined,
        error: undefined,
      });
      return { success: true };
    }

    default:
      // Không trả error cho message types không xử lý (OFFSCREEN_START, OFFSCREEN_STOP, etc.)
      // vì chúng cần đi đến offscreen document, không nên bị block ở đây.
      return undefined;
  }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== "install") {
    return;
  }

  void (async () => {
    const settings = await getStorage("settings");
    if (!settings) {
      await setStorage("settings", { theme: "light", enabled: true });
    }

    const auth = await getStorage("auth");
    if (!auth) {
      await setAuthState(DEFAULT_AUTH_STATE);
    }

    const captureStatus = await getStorage("captureStatus");
    if (!captureStatus) {
      await setStorage("captureStatus", DEFAULT_CAPTURE_STATUS);
    }

    const selectedProjectId = await getStorage("selectedProjectId");
    if (selectedProjectId === undefined) {
      await setSelectedProjectId(null);
    }

    const quotaStatus = await getStorage("quotaStatus");
    if (quotaStatus === undefined) {
      await setQuotaStatus(null);
    }
  })();
});
