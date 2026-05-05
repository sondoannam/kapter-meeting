import {
  startTransition,
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";

import type { ExtensionAuthState } from "@/shared/lib/auth-bridge";
import { isGoogleMeetDualLaneCaptureEnabled } from "@/shared/lib/feature-flags";
import type {
  CaptureStatus,
  CaptureState,
  ExtensionProjectSummary,
} from "@/shared/types/messages";
import { sendMessage } from "@/shared/lib/messaging";

import { StatusBar } from "./components/StatusBar";
import { AuthWarningBanner } from "./components/AuthWarningBanner";
import { ProjectSelector } from "./components/ProjectSelector";
import { RecordButton } from "./components/RecordButton";
import { AccountSection } from "./components/AccountSection";

const DEFAULT_CAPTURE_STATUS: CaptureStatus = { state: "idle" };

export default function App() {
  const meetDualLaneCaptureEnabled = isGoogleMeetDualLaneCaptureEnabled();
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>(
    DEFAULT_CAPTURE_STATUS,
  );
  const [authState, setAuthState] = useState<ExtensionAuthState | null>(null);
  const [projects, setProjects] = useState<ExtensionProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [isOnMeetTab, setIsOnMeetTab] = useState(false);

  const captureState: CaptureState = captureStatus.state;
  const isRecording = captureState === "recording";
  const isFinishing = captureState === "finishing";
  const isAuthenticated = authState?.status === "connected";
  const selfMicDegraded = captureStatus.degradedWithoutSelfMic === true;
  const showMeetMicState =
    isOnMeetTab && typeof captureStatus.meetLocalMicState === "string";
  const meetMicStateMessage =
    captureStatus.meetLocalMicState === "muted"
      ? "Mic tren giao dien Google Meet dang tat."
      : captureStatus.meetLocalMicState === "unmuted"
        ? "Mic tren giao dien Google Meet dang bat."
        : "Chua xac dinh duoc trang thai mic tren giao dien Google Meet.";

  const loadPopupState = useCallback(async () => {
    const [captureResponse, authResponse, projectResponse] = await Promise.all([
      sendMessage({ type: "GET_CAPTURE_STATUS" }),
      sendMessage({ type: "AUTH_GET_STATE" }),
      sendMessage({ type: "GET_PROJECT_SELECTION" }),
    ]);

    return { captureResponse, authResponse, projectResponse };
  }, []);

  const syncPopupState = useCallback(async () => {
    const nextState = await loadPopupState();

    startTransition(() => {
      if (nextState.captureResponse.success) {
        setCaptureStatus(nextState.captureResponse.data);
      } else {
        setCaptureStatus({
          state: "error",
          error: nextState.captureResponse.error,
        });
      }

      if (nextState.authResponse.success) {
        setAuthState(nextState.authResponse.data);
      } else {
        setAuthState(null);
      }

      if (nextState.projectResponse.success) {
        setProjects(nextState.projectResponse.data.projects);
        setSelectedProjectId(nextState.projectResponse.data.selectedProjectId);
      } else {
        setProjects([]);
        setSelectedProjectId(null);
      }
      setLoading(false);
    });
  }, [loadPopupState]);

  useEffect(() => {
    void syncPopupState();
  }, [syncPopupState]);

  useEffect(() => {
    if (captureState !== "recording") return;
    const intervalId = window.setInterval(() => {
      void syncPopupState();
    }, 2_000);
    return () => window.clearInterval(intervalId);
  }, [captureState, syncPopupState]);

  useEffect(() => {
    if (chrome?.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || "";
        setIsOnMeetTab(url.startsWith("https://meet.google.com/"));
      });
    }
  }, []);

  const handleStart = async () => {
    setActionBusy(true);

    const response = await sendMessage({
      type: "START_CAPTURE",
      payload: { projectId: selectedProjectId },
    });

    if (!response.success) {
      setCaptureStatus({ state: "error", error: response.error });
      setActionBusy(false);
      return;
    }

    await syncPopupState();
    setActionBusy(false);
  };

  const handleStop = async () => {
    setActionBusy(true);
    await sendMessage({ type: "STOP_CAPTURE" });
    await syncPopupState();
    setActionBusy(false);
  };

  const handleProjectSelectionChange = async (
    e: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextProjectId = e.target.value || null;
    const response = await sendMessage({
      type: "SET_PROJECT_SELECTION",
      payload: { projectId: nextProjectId },
    });
    if (response.success) setSelectedProjectId(nextProjectId);
  };

  const handleStartBridge = async () => {
    setAuthBusy(true);
    const response = await sendMessage({ type: "AUTH_START_TOKEN_BRIDGE" });
    if (response.success) {
      setAuthState((current) =>
        current
          ? { ...current, status: "pending" }
          : {
              status: "pending",
              requestId: response.data.requestId,
              sessionToken: null,
              userId: null,
              expiresAt: null,
              updatedAt: Date.now(),
              lastError: null,
            },
      );
    }
    setAuthBusy(false);
  };

  const handleClearAuth = async () => {
    setAuthBusy(true);
    await sendMessage({ type: "AUTH_CLEAR_STATE" });
    await syncPopupState();
    setAuthBusy(false);
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-kapter-bg">
        <span className="text-sm text-kapter-text-secondary">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3 h-full min-h-[320px] bg-kapter-bg">
      <StatusBar status={captureState} />

      {captureStatus.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          <span className="shrink-0">⚠️</span>
          <p>{captureStatus.error}</p>
        </div>
      )}

      {selfMicDegraded && captureState !== "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <span className="shrink-0">Mic</span>
          <p>
            {captureStatus.degradedReason ??
              "Không thể thu micro của bạn. Phiên này sẽ tiếp tục chỉ với âm thanh tab đã chia sẻ."}
          </p>
        </div>
      )}

      {isOnMeetTab &&
        !meetDualLaneCaptureEnabled &&
        captureState !== "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-zinc-500/30 bg-zinc-500/10 p-3 text-xs text-zinc-200">
            <span className="shrink-0">Mode</span>
            <p>
              Ban build nay dang tat lane self mic cua Google Meet bang feature
              flag. Phien nay se chi ghi am thanh tab de doi chieu voi baseline
              tab-only.
            </p>
          </div>
        )}

      {showMeetMicState && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-100">
          <span className="shrink-0">Meet</span>
          <p>{meetMicStateMessage}</p>
        </div>
      )}

      {authState?.status === "pending" ? (
        <div className="flex items-center gap-2 rounded-lg border border-kapter-border bg-kapter-bg-secondary p-3 text-xs text-kapter-text-secondary italic animate-pulse">
          <span>🔄</span>
          <p>Đang đồng bộ phiên đăng nhập từ Dashboard...</p>
        </div>
      ) : (
        !isAuthenticated && (
          <AuthWarningBanner onConnect={handleStartBridge} isBusy={authBusy} />
        )
      )}

      <ProjectSelector
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelect={handleProjectSelectionChange}
        disabled={actionBusy || isRecording}
        isAuthenticated={isAuthenticated}
      />

      <div className="mt-2">
        <RecordButton
          isRecording={isRecording}
          isFinishing={isFinishing}
          isOnMeetTab={isOnMeetTab}
          isBusy={actionBusy}
          onStart={handleStart}
          onStop={handleStop}
        />
      </div>

      <div className="mt-auto pt-4 border-t border-kapter-border/50">
        <AccountSection
          isAuthenticated={isAuthenticated}
          isBusy={authBusy}
          onConnect={handleStartBridge}
          onDisconnect={handleClearAuth}
        />
      </div>
    </div>
  );
}
