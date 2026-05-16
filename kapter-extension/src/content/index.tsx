import React from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  BRIDGE_ACK_MESSAGE_TYPE,
  BRIDGE_PRESENCE_REQUEST_MESSAGE_TYPE,
  BRIDGE_PRESENCE_RESPONSE_MESSAGE_TYPE,
  BRIDGE_SILENT_TOKEN_REQUEST,
  BRIDGE_TOKEN_MESSAGE_TYPE,
  isBridgePageLocation,
} from "@/shared/lib/auth-bridge";
import { readMeetLocalMicSnapshot } from "@/shared/lib/google-meet-local-mic";
import { isGoogleMeetUrl } from "@/shared/lib/google-meet";
import { sendMessage } from "@/shared/lib/messaging";
import { getStorage } from "@/shared/lib/storage";

import App from "./App";

const HOST_ID = "my-extension-root";
let root: Root | null = null;

interface BridgeWindowMessage {
  source: "kapter-webapp";
  type: typeof BRIDGE_TOKEN_MESSAGE_TYPE;
  payload: {
    requestId: string;
    sessionToken: string;
    userId: string | null;
  };
}

interface PresenceRequestWindowMessage {
  source: "kapter-webapp";
  type: typeof BRIDGE_PRESENCE_REQUEST_MESSAGE_TYPE;
  payload: {
    requestId: string;
  };
}

function isBridgeWindowMessage(value: unknown): value is BridgeWindowMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BridgeWindowMessage>;

  return (
    candidate.source === "kapter-webapp" &&
    candidate.type === BRIDGE_TOKEN_MESSAGE_TYPE &&
    !!candidate.payload &&
    typeof candidate.payload.requestId === "string" &&
    typeof candidate.payload.sessionToken === "string"
  );
}

function isPresenceRequestWindowMessage(
  value: unknown,
): value is PresenceRequestWindowMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PresenceRequestWindowMessage>;

  return (
    candidate.source === "kapter-webapp" &&
    candidate.type === BRIDGE_PRESENCE_REQUEST_MESSAGE_TYPE &&
    !!candidate.payload &&
    typeof candidate.payload.requestId === "string"
  );
}

function registerBridgeRelay() {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (!isBridgeWindowMessage(event.data)) {
      return;
    }

    void sendMessage({
      type: "AUTH_BRIDGE_TOKEN_RECEIVED",
      payload: event.data.payload,
    }).then((response) => {
      if (!response.success) {
        console.error(
          "[content] Failed to persist bridged auth token",
          response.error,
        );
        return;
      }

      window.postMessage(
        {
          source: "kapter-extension",
          type: BRIDGE_ACK_MESSAGE_TYPE,
          payload: {
            requestId: event.data.payload.requestId,
          },
        },
        window.location.origin,
      );
    });
  });
}

function registerWebappPresenceListener() {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (!isPresenceRequestWindowMessage(event.data)) {
      return;
    }

    window.postMessage(
      {
        source: "kapter-extension",
        type: BRIDGE_PRESENCE_RESPONSE_MESSAGE_TYPE,
        payload: {
          requestId: event.data.payload.requestId,
        },
      },
      window.location.origin,
    );
  });
}

async function mount() {
  // ✅ Check storage BEFORE touching the DOM
  const settings = await getStorage("settings");
  if (!settings?.enabled) return; // Don't mount at all if disabled

  if (document.getElementById(HOST_ID)) return;

  // Shadow DOM host element
  const host = document.createElement("div");
  host.id = HOST_ID;

  // Prevent host page styles from targeting our host element
  host.style.cssText = [
    "all: initial",
    "position: fixed",
    "inset: 0", // covers full viewport for z-index stacking context
    "width: 0",
    "height: 0",
    "overflow: visible",
    `z-index: 2147483647`,
    "pointer-events: none",
  ].join("; ");
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Scoped reset inside shadow DOM so inner elements render predictably
  const resetStyle = document.createElement("style");
  resetStyle.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    :host { all: initial; }
  `;
  shadow.appendChild(resetStyle);

  const mountPoint = document.createElement("div");
  mountPoint.style.cssText = "pointer-events: auto;";
  shadow.appendChild(mountPoint);

  root = createRoot(mountPoint);
  root.render(
    <React.StrictMode>
      <App onClose={unmount} />
    </React.StrictMode>,
  );
}

function unmount() {
  root?.unmount();
  root = null;
  document.getElementById(HOST_ID)?.remove();
}

function registerSilentRefreshListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === BRIDGE_SILENT_TOKEN_REQUEST) {
      window.postMessage(
        {
          source: "kapter-extension",
          type: BRIDGE_SILENT_TOKEN_REQUEST,
          payload: { requestId: message.payload?.requestId },
        },
        window.location.origin,
      );
    }
  });
}

function registerMeetLocalMicStateListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "GET_MEET_LOCAL_MIC_STATE") {
      return undefined;
    }

    sendResponse({
      success: true,
      data: readMeetLocalMicSnapshot(),
    });
    return true;
  });
}

const currentLocation = window.location.href;
const isWebappOrigin = (() => {
  try {
    return (
      new URL(currentLocation).origin ===
      new URL(import.meta.env.VITE_WEBAPP_URL).origin
    );
  } catch {
    return false;
  }
})();

if (isBridgePageLocation(currentLocation)) {
  registerBridgeRelay();
}

if (isWebappOrigin) {
  registerSilentRefreshListener();
  registerWebappPresenceListener();
}

if (
  isGoogleMeetUrl(currentLocation) &&
  document.readyState === "loading"
) {
  registerMeetLocalMicStateListener();
  document.addEventListener("DOMContentLoaded", mount);
} else if (isGoogleMeetUrl(currentLocation)) {
  registerMeetLocalMicStateListener();
  mount();
}
