import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/** Neutral post-OAuth sync route — no React shell; works in private / incognito browsers. */
export const AUTH_COMPLETING_PATH = "/auth/completing"

export function buildAuthCompletingPath(redirectTo: string): string {
  const redirect = encodeURIComponent(safeRedirectPath(redirectTo))
  return `${AUTH_COMPLETING_PATH}?redirect=${redirect}`
}

export function buildAuthCompletingUrl(origin: string, redirectTo: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}${buildAuthCompletingPath(redirectTo)}`
}
