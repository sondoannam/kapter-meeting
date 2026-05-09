import browser from "webextension-polyfill";

import type { ExtensionAuthState } from "@/shared/lib/auth-bridge";

// Define your entire storage schema here — one source of truth
export interface StorageSchema {
  settings: {
    theme: "light" | "dark";
    enabled: boolean;
  };
  auth: ExtensionAuthState;
  cache: Record<string, string>;
  captureStatus: import("@/shared/types/messages").CaptureStatus;
  quotaStatus: import("@kapter/contracts").QuotaSnapshot | null;
  selectedProjectId: string | null;
  recorderMicPermissionGranted: boolean;
}

type StorageKey = keyof StorageSchema;

export async function getStorage<K extends StorageKey>(
  key: K,
): Promise<StorageSchema[K] | undefined> {
  const result = await browser.storage.local.get(key);
  return result[key] as StorageSchema[K] | undefined;
}

export async function setStorage<K extends StorageKey>(
  key: K,
  value: StorageSchema[K],
): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function removeStorage(key: StorageKey): Promise<void> {
  await browser.storage.local.remove(key);
}
