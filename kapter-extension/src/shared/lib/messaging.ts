import browser from "webextension-polyfill";
import type {
  ExtensionMessage,
  MessageResponse,
} from "@/shared/types/messages";

// Send from popup/content → background
export async function sendMessage<T extends ExtensionMessage>(
  message: T,
): Promise<MessageResponse<T["type"]>> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch (err) {
    return { success: false, error: String(err) } as MessageResponse<T["type"]>;
  }
}

// Register handler in background
export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: browser.Runtime.MessageSender,
  ) => Promise<unknown> | unknown,
): void {
  browser.runtime.onMessage.addListener(
    (message: unknown, sender: browser.Runtime.MessageSender) => {
      const result = handler(message as ExtensionMessage, sender);
      // Must return true or a Promise for async responses
      if (result instanceof Promise) return result;
      return Promise.resolve(result);
    },
  );
}
