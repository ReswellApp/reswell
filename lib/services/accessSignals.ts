import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies, headers } from "next/headers"
import {
  fetchUserAccessSignals,
  findActiveBannedAccessSignal,
  upsertBannedAccessSignal,
  upsertUserAccessSignals,
} from "@/lib/db/bannedAccessSignals"
import {
  BANNED_DEVICE_TTL_MS,
  BANNED_IP_TTL_MS,
  DEVICE_COOKIE_NAME,
  isBannablePublicIp,
  resolveAccessSignalHashes,
} from "@/lib/messages/access-signals"

export type RequestAccessSignals = {
  ip: string | null
  ipHash: string | null
  deviceId: string | null
  deviceHash: string | null
}

export async function readRequestAccessSignals(): Promise<RequestAccessSignals> {
  const headerStore = await headers()
  const cookieStore = await cookies()
  return resolveAccessSignalHashes({
    forwardedFor: headerStore.get("x-forwarded-for"),
    realIp: headerStore.get("x-real-ip"),
    deviceId: cookieStore.get(DEVICE_COOKIE_NAME)?.value ?? null,
  })
}

export async function persistUserAccessSignals(
  supabase: SupabaseClient,
  userId: string,
  signals?: RequestAccessSignals,
): Promise<RequestAccessSignals> {
  const resolved = signals ?? (await readRequestAccessSignals())
  const stored = await fetchUserAccessSignals(supabase, userId)
  const ipHash =
    resolved.ip && isBannablePublicIp(resolved.ip)
      ? resolved.ipHash
      : stored?.lastIpHash ?? null
  await upsertUserAccessSignals(supabase, userId, {
    ipHash,
    deviceHash: resolved.deviceHash ?? stored?.lastDeviceHash ?? null,
  })
  return resolved
}

export async function requestAccessSignalsAreBanned(
  supabase: SupabaseClient,
  signals: Pick<RequestAccessSignals, "ip" | "ipHash" | "deviceHash">,
): Promise<boolean> {
  const checks: Array<Promise<boolean | null>> = []
  if (signals.ipHash && signals.ip && isBannablePublicIp(signals.ip)) {
    checks.push(findActiveBannedAccessSignal(supabase, "ip", signals.ipHash))
  }
  if (signals.deviceHash) {
    checks.push(findActiveBannedAccessSignal(supabase, "device", signals.deviceHash))
  }
  if (checks.length === 0) return false

  const results = await Promise.all(checks)
  return results.some((hit) => hit === true)
}

export async function banStoredAccessSignalsForUser(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  signals?: RequestAccessSignals,
): Promise<void> {
  const resolved = signals ?? (await readRequestAccessSignals())
  const stored = await fetchUserAccessSignals(supabase, userId)
  const now = Date.now()

  const ipHash =
    resolved.ip && isBannablePublicIp(resolved.ip) ? resolved.ipHash : stored?.lastIpHash ?? null
  const deviceHash = resolved.deviceHash ?? stored?.lastDeviceHash ?? null

  await Promise.all([
    ipHash
      ? upsertBannedAccessSignal(supabase, {
          kind: "ip",
          signalHash: ipHash,
          sourceUserId: userId,
          reason,
          expiresAt: new Date(now + BANNED_IP_TTL_MS).toISOString(),
        })
      : Promise.resolve(true),
    deviceHash
      ? upsertBannedAccessSignal(supabase, {
          kind: "device",
          signalHash: deviceHash,
          sourceUserId: userId,
          reason,
          expiresAt: new Date(now + BANNED_DEVICE_TTL_MS).toISOString(),
        })
      : Promise.resolve(true),
  ])
}
