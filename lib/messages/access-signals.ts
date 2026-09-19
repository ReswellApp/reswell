import type { NextRequest, NextResponse } from "next/server"

export const DEVICE_COOKIE_NAME = "rw_did"

export const DEVICE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400

/** IP bans expire so a cafe / CGNAT is not locked forever. */
export const BANNED_IP_TTL_MS = 14 * 24 * 60 * 60 * 1000

/** Device cookie bans last a year — clearing cookies is the usual scammer reset. */
export const BANNED_DEVICE_TTL_MS = 365 * 24 * 60 * 60 * 1000

const DEVICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidDeviceId(value: string | null | undefined): value is string {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value.trim())
}

export function firstForwardedIp(forwardedFor: string | null | undefined): string | null {
  if (!forwardedFor) return null
  const first = forwardedFor.split(",")[0]?.trim()
  return first || null
}

export function normalizeClientIp(raw: string | null | undefined): string | null {
  if (!raw) return null
  let ip = raw.trim()
  if (!ip) return null
  if (ip.startsWith("::ffff:")) ip = ip.slice(7)
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"))
  } else {
    const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(ip)
    if (ipv4WithPort?.[1]) ip = ipv4WithPort[1]
  }
  return ip || null
}

/** Skip loopback / private / link-local so local dev and home LAN are never IP-banned. */
export function isBannablePublicIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return false
  if (ip.startsWith("10.")) return false
  if (ip.startsWith("192.168.")) return false
  if (ip.startsWith("169.254.")) return false
  const rfc1918_172 = /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  if (rfc1918_172) return false
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return false
  if (ip.toLowerCase().startsWith("fe80:")) return false
  return true
}

export async function hashAccessSignal(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value.trim().toLowerCase())
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function resolveAccessSignalHashes(input: {
  forwardedFor: string | null
  realIp: string | null
  deviceId: string | null
}): Promise<{
  ip: string | null
  ipHash: string | null
  deviceId: string | null
  deviceHash: string | null
}> {
  const ip = normalizeClientIp(firstForwardedIp(input.forwardedFor) ?? input.realIp)
  const deviceId = isValidDeviceId(input.deviceId) ? input.deviceId.trim() : null
  const [ipHash, deviceHash] = await Promise.all([
    ip ? hashAccessSignal(ip) : Promise.resolve(null),
    deviceId ? hashAccessSignal(deviceId) : Promise.resolve(null),
  ])
  return { ip, ipHash, deviceId, deviceHash }
}

export function attachDeviceCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(DEVICE_COOKIE_NAME)?.value
  if (isValidDeviceId(existing)) return response

  response.cookies.set(DEVICE_COOKIE_NAME, crypto.randomUUID(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SEC,
  })
  return response
}

export function isSignupPath(pathname: string): boolean {
  return pathname === "/auth/sign-up" || pathname.startsWith("/auth/sign-up/")
}
