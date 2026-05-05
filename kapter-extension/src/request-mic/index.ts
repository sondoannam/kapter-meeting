import { sendMessage } from "@/shared/lib/messaging";

type StatusTone = "pending" | "success" | "error";

function setStatus(message: string, tone: StatusTone): void {
  const status = document.getElementById("status");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.setAttribute("data-tone", tone);
}

function describeError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Microphone access was denied.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No microphone device is available.";
      case "NotReadableError":
      case "TrackStartError":
        return "The microphone is busy or unavailable.";
      default:
        return `${error.name}: ${error.message}`.trim();
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function reportAndClose(granted: boolean, error?: string): Promise<void> {
  await sendMessage({
    type: "MIC_PERMISSION_RESULT",
    payload: {
      granted,
      error,
    },
  });

  window.close();
}

async function requestMicrophonePermission(): Promise<void> {
  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    setStatus("Microphone access granted. Closing this tab...", "success");
    stream.getTracks().forEach((track) => track.stop());
    await reportAndClose(true);
  } catch (error) {
    const message = describeError(error);

    setStatus(
      `${message} Return to Kapter to continue with shared tab audio only.`,
      "error",
    );

    await reportAndClose(false, message);
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

void requestMicrophonePermission();
