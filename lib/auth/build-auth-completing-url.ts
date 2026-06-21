import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/** Neutral post-OAuth sync route — no "error" in the URL while session cookies catch up. */
export const AUTH_COMPLETING_PATH = "/auth/completing"

export function buildAuthCompletingUrl(origin: string, redirectTo: string): string {
  const base = origin.replace(/\/$/, "")
  const redirect = encodeURIComponent(safeRedirectPath(redirectTo))
  return `${base}${AUTH_COMPLETING_PATH}?redirect=${redirect}`
}
