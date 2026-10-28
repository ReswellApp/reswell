import {
  mobilePushTestResultSchema,
  mobilePushTokenBodySchema,
  mobilePushTokenResultSchema,
  type MobilePushTokenBody,
  type MobilePushTokenResult,
  type MobilePushTestResult,
} from "@reswell/api-contract"
import { deleteDevicePushToken, upsertDevicePushToken } from "@/lib/db/pushTokens"
import { compactPushData, isExpoPushToken } from "@/lib/services/push-payload"
import { sendPushDeliveries } from "@/lib/services/push"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function registerMobilePushTokenService(
  userId: string,
  input: MobilePushTokenBody,
): Promise<MobileApiResult<MobilePushTokenResult>> {
  const parsed = mobilePushTokenBodySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Check the device token." }
  }
  if (!isExpoPushToken(parsed.data.token)) {
    return { ok: false, status: 400, error: "That push token is not valid." }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (cause) {
    console.error("[mobile-api] push register missing service role", {
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 503, error: "Unable to save this device right now" }
  }

  const saved = await upsertDevicePushToken(supabase, {
    userId,
    token: parsed.data.token,
    platform: parsed.data.platform,
    deviceId: parsed.data.device_id,
  })
  if (!saved.ok) return { ok: false, status: 500, error: saved.error }
  const result = mobilePushTokenResultSchema.safeParse({ ok: true })
  if (!result.success) return { ok: false, status: 500, error: "Unable to save this device right now" }
  return { ok: true, data: result.data }
}

export async function deleteMobilePushTokenService(
  userId: string,
  input: MobilePushTokenBody,
): Promise<MobileApiResult<MobilePushTokenResult>> {
  const parsed = mobilePushTokenBodySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Check the device token." }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (cause) {
    console.error("[mobile-api] push delete missing service role", {
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 503, error: "Unable to remove this device right now" }
  }

  const removed = await deleteDevicePushToken(supabase, userId, parsed.data.token)
  if (!removed.ok) return { ok: false, status: 500, error: removed.error }
  const result = mobilePushTokenResultSchema.safeParse({ ok: true })
  if (!result.success) return { ok: false, status: 500, error: "Unable to remove this device right now" }
  return { ok: true, data: result.data }
}

export async function sendMobilePushTestService(
  userId: string,
): Promise<MobileApiResult<MobilePushTestResult>> {
  let sent = 0
  try {
    sent = await sendPushDeliveries([
      {
        userId,
        title: "Reswell",
        body: "Push alerts are working.",
        data: compactPushData({ kind: "notification", href: "/inbox" }),
      },
    ])
  } catch (cause) {
    console.error("[mobile-api] push test failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 500, error: "Unable to send a test alert right now" }
  }
  if (sent === 0) {
    return {
      ok: false,
      status: 400,
      error: "Allow notifications on this iPhone, then try again.",
    }
  }
  const parsed = mobilePushTestResultSchema.safeParse({ sent })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to send a test alert right now" }
  return { ok: true, data: parsed.data }
}
