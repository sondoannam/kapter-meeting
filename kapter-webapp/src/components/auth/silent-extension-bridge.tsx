import { useAuth } from "@clerk/react-router";
import { useEffect } from "react";

const BRIDGE_SILENT_TOKEN_REQUEST = "KAPTER_EXTENSION_SILENT_TOKEN_REQUEST";
const BRIDGE_RESULT_MESSAGE_TYPE = "KAPTER_EXTENSION_TOKEN_BRIDGE_RESULT";

const BRIDGE_TOKEN_TEMPLATE =
  import.meta.env.VITE_CLERK_EXTENSION_TOKEN_TEMPLATE?.trim() || null;

export function SilentExtensionBridge() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      // Security check: only listen to messages from the same origin (the content script)
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as {
        source?: string;
        type?: string;
        payload?: { requestId: string };
      };

      if (
        data.source === "kapter-extension" &&
        data.type === BRIDGE_SILENT_TOKEN_REQUEST &&
        data.payload?.requestId
      ) {
        console.log("[bridge] Received silent token request from extension.");

        try {
          const sessionToken = await getToken(
            BRIDGE_TOKEN_TEMPLATE
              ? {
                  template: BRIDGE_TOKEN_TEMPLATE,
                }
              : undefined
          );

          if (!sessionToken) {
            return;
          }

          window.postMessage(
            {
              source: "kapter-webapp",
              type: BRIDGE_RESULT_MESSAGE_TYPE,
              payload: {
                requestId: data.payload.requestId,
                sessionToken,
                userId,
              },
            },
            window.location.origin
          );
        } catch (error) {
          console.error("[bridge] Failed to handle silent token request:", error);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [getToken, isLoaded, isSignedIn, userId]);

  return null;
}
