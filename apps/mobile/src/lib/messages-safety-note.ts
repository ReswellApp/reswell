import * as SecureStore from "expo-secure-store"

const KEY = "reswell.messages-safety-note-dismissed"

/** `null` until disk has been read this process. */
let dismissed: boolean | null = null

function isDismissedFlag(raw: string | null): boolean {
  return raw === "1"
}

export function isMessagesSafetyNoteDismissed(): boolean | null {
  return dismissed
}

export async function readMessagesSafetyNoteDismissed(): Promise<boolean> {
  if (dismissed !== null) return dismissed
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    dismissed = isDismissedFlag(raw)
  } catch {
    dismissed = false
  }
  return dismissed
}

export async function dismissMessagesSafetyNote(): Promise<void> {
  dismissed = true
  try {
    await SecureStore.setItemAsync(KEY, "1")
  } catch {
    /* private mode / storage unavailable — in-memory dismiss still holds this session */
  }
}

void readMessagesSafetyNoteDismissed()
