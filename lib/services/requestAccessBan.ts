import type { NextRequest } from "next/server"
import { findActiveBannedAccessSignal } from "@/lib/db/bannedAccessSignals"
import {
  DEVICE_COOKIE_NAME,
  isBannablePublicIp,
  resolveAccessSignalHashes,
} from "@/lib/messages/access-signals"
import { createServiceRoleClient } from "@/lib/supabase/server"

/** Used by middleware on /auth/sign-up so a banned IP/device cannot make a new account. */
export async function isNextRequestAccessBanned(request: NextRequest): Promise<boolean> {
  try {
    const service = createServiceRoleClient()
    const signals = await resolveAccessSignalHashes({
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
      deviceId: request.cookies.get(DEVICE_COOKIE_NAME)?.value ?? null,
    })

    const checks: Array<Promise<boolean | null>> = []
    if (signals.ipHash && signals.ip && isBannablePublicIp(signals.ip)) {
      checks.push(findActiveBannedAccessSignal(service, "ip", signals.ipHash))
    }
    if (signals.deviceHash) {
      checks.push(findActiveBannedAccessSignal(service, "device", signals.deviceHash))
    }
    if (checks.length === 0) return false

    const results = await Promise.all(checks)
    return results.some((hit) => hit === true)
  } catch {
    return false
  }
}
