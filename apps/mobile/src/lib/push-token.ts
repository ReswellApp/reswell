import * as Crypto from "expo-crypto"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import { deletePushToken, registerPushToken } from "@/lib/api"
import type { MobilePushTokenBody } from "@reswell/api-contract"

const DEVICE_ID_KEY = "reswell.device_id"
const PUSH_TOKEN_KEY = "reswell.push_token"

export type PushPermissionResult =
  | { ok: true }
  | { ok: false; error: string }

function projectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null
}

async function deviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  if (existing) return existing
  const created = Crypto.randomUUID()
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created)
  return created
}

async function storedPushBody(): Promise<MobilePushTokenBody | null> {
  const raw = await SecureStore.getItemAsync(PUSH_TOKEN_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const record = parsed as Record<string, unknown>
    if (
      typeof record.token !== "string" ||
      (record.platform !== "ios" && record.platform !== "android") ||
      typeof record.device_id !== "string"
    ) {
      return null
    }
    return { token: record.token, platform: record.platform, device_id: record.device_id }
  } catch {
    return null
  }
}

async function saveStoredPushBody(body: MobilePushTokenBody): Promise<void> {
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, JSON.stringify(body))
}

async function clearStoredPushBody(): Promise<void> {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY)
}

function nativePlatform(): "ios" | "android" | null {
  if (Platform.OS === "ios") return "ios"
  if (Platform.OS === "android") return "android"
  return null
}

async function currentExpoPushToken(): Promise<string | null> {
  const id = projectId()
  if (!id) return null
  const token = await Notifications.getExpoPushTokenAsync({ projectId: id })
  return token.data?.trim() || null
}

/**
 * Refresh the stored Expo token when iOS already granted permission.
 * Does not show the system prompt.
 */
export async function registerPushTokenIfPermitted(accessToken: string): Promise<void> {
  if (Platform.OS === "web") return
  const platform = nativePlatform()
  if (!platform) return
  const current = await Notifications.getPermissionsAsync()
  if (current.status !== "granted") return
  await registerCurrentToken(accessToken, platform)
}

/**
 * Ask for permission if iOS has not decided yet, then register.
 * Denied stays denied — we do not prompt again from here.
 */
export async function requestPushPermissionAndRegister(accessToken: string): Promise<PushPermissionResult> {
  if (Platform.OS === "web") {
    return { ok: false, error: "Push alerts are only available on iPhone." }
  }
  const platform = nativePlatform()
  if (!platform) {
    return { ok: false, error: "Push alerts are only available on iPhone." }
  }

  let permission = await Notifications.getPermissionsAsync()
  if (permission.status !== "granted") {
    permission = await Notifications.requestPermissionsAsync()
  }
  if (permission.status !== "granted") {
    return {
      ok: false,
      error: "Turn on notifications for Reswell in iPhone Settings to get alerts.",
    }
  }

  try {
    await registerCurrentToken(accessToken, platform)
    return { ok: true }
  } catch {
    return { ok: false, error: "Unable to enable push alerts right now." }
  }
}

export async function unregisterPushToken(accessToken: string | null | undefined): Promise<void> {
  if (Platform.OS === "web" || !accessToken) {
    await clearStoredPushBody()
    return
  }
  const stored = await storedPushBody()
  if (!stored) return
  try {
    await deletePushToken(accessToken, stored)
  } catch {
    // Sign-out should still finish if the API is unreachable.
  }
  await clearStoredPushBody()
}

async function registerCurrentToken(accessToken: string, platform: "ios" | "android"): Promise<void> {
  if (platform === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    })
  }
  const token = await currentExpoPushToken()
  if (!token) throw new Error("missing expo push token")
  const body: MobilePushTokenBody = {
    token,
    platform,
    device_id: await deviceId(),
  }
  await registerPushToken(accessToken, body)
  await saveStoredPushBody(body)
}
