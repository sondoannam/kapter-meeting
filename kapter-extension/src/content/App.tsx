import { useEffect, useState } from "react";
import { readMeetLocalMicSnapshot } from "@/shared/lib/google-meet-local-mic";
import { sendMessage } from "@/shared/lib/messaging";
import { getStorage } from "@/shared/lib/storage";
import type { MeetLocalMicState } from "@/shared/types/messages";

const MEET_MIC_OBSERVER_DEBOUNCE_MS = 75;
const MEET_MIC_POLL_INTERVAL_MS = 2_000;

function formatMeetLocalMicState(state: MeetLocalMicState): string {
  if (state === "muted") {
    return "Mic tren Meet dang tat";
  }

  if (state === "unmuted") {
    return "Mic tren Meet dang bat";
  }

  return "Chua xac dinh mic tren Meet";
}

interface ContentAppProps {
  onClose: () => void;
}

export default function App({ onClose }: ContentAppProps) {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [meetLocalMicState, setMeetLocalMicState] =
    useState<MeetLocalMicState>("unknown");

  useEffect(() => {
    // Check storage to see if extension is enabled for this page
    getStorage("settings").then((settings) => {
      if (settings?.enabled) {
        setEnabled(true);
        // Slight delay so the mount doesn't cause layout flash
        setTimeout(() => setVisible(true), 100);
      }
    });

    // Listen for keyboard shortcut to toggle panel (Alt+Shift+E)
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === "E") {
        setVisible((v) => !v);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (!enabled || !document.body) {
      return;
    }

    let debounceTimer: number | null = null;
    let lastPublishedState = "";

    const publishMeetLocalMicState = () => {
      const snapshot = readMeetLocalMicSnapshot();
      const nextPublishedState = JSON.stringify(snapshot);

      setMeetLocalMicState(snapshot.state);

      if (nextPublishedState === lastPublishedState) {
        return;
      }

      lastPublishedState = nextPublishedState;

      void sendMessage({
        type: "MEET_LOCAL_MIC_STATE_CHANGED",
        payload: {
          state: snapshot.state,
          controlLabel: snapshot.controlLabel,
          detectedAt: Date.now(),
        },
      });
    };

    const schedulePublish = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }

      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        publishMeetLocalMicState();
      }, MEET_MIC_OBSERVER_DEBOUNCE_MS);
    };

    publishMeetLocalMicState();

    const observer = new MutationObserver(() => {
      schedulePublish();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-label", "data-tooltip", "title", "class"],
    });

    const intervalId = window.setInterval(() => {
      publishMeetLocalMicState();
    }, MEET_MIC_POLL_INTERVAL_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);

      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
    };
  }, [enabled]);

  // Don't render anything if extension is disabled
  if (!enabled) return null;

  return (
    <div
      style={{
        // Inline styles preferred in content scripts to avoid Tailwind
        // class collisions with the host page's stylesheet (if not using shadow DOM)
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 2147483647, // Max z-index
        transition: "opacity 0.2s ease, transform 0.2s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        style={{
          background: "rgba(26, 29, 39, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "14px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
          padding: "16px",
          width: "280px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#f8fafc",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
            Kapter Assistant
          </span>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 200); // Wait for fade-out before unmounting
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9ca3af",
              fontSize: "16px",
              lineHeight: 1,
              padding: "2px",
            }}
            aria-label="Đóng bảng điều khiển"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
          Đang chạy trên:{" "}
          <strong style={{ color: "#e2e8f0" }}>{location.hostname}</strong>
        </p>

        <p
          style={{
            fontSize: "12px",
            color: meetLocalMicState === "muted" ? "#fbbf24" : "#94a3b8",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          {formatMeetLocalMicState(meetLocalMicState)}
        </p>

        <p
          style={{
            fontSize: "12px",
            color: "#64748b",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          Nhấn{" "}
          <kbd
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              padding: "1px 5px",
              fontSize: "11px",
              color: "#e2e8f0",
            }}
          >
            Alt+Shift+E
          </kbd>{" "}
          để ẩn/hiện
        </p>
      </div>
    </div>
  );
}
