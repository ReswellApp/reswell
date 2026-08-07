import { createHash, randomBytes } from "crypto"
import type { NextResponse } from "next/server"

/** httpOnly cookie that keys guest `listings` draft rows (hashed in DB). */
export const SELL_GUEST_DRAFT_COOKIE = "reswell_sell_guest_draft"

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90

export function hashGuestDraftToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function createGuestDraftToken(): string {
  return randomBytes(32).toString("base64url")
}

export function guestDraftCookieOptions(maxAge = COOKIE_MAX_AGE_SEC) {
  return {
    path: "/",
    maxAge,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  }
}

/** Attach or refresh the guest draft cookie on a route response. */
export function setGuestDraftTokenCookie(
  res: NextResponse,
  token: string,
): void {
  res.cookies.set(SELL_GUEST_DRAFT_COOKIE, token, guestDraftCookieOptions())
}

export function clearGuestDraftTokenCookie(res: NextResponse): void {
  res.cookies.set(SELL_GUEST_DRAFT_COOKIE, "", guestDraftCookieOptions(0))
}
