import { supabaseAuthForwardPathname } from "@/lib/auth/supabase-auth-forward-path"

/**
 * Public marketplace is closed. Account, sign-in, admin, and webhooks stay up.
 * The date is the official close announced on the shutdown page.
 */
export const SITE_CLOSED = true

export const SITE_CLOSURE_DATE_LABEL = "November 15, 2026"

export const SITE_CLOSURE_PATH = "/closed"

/** Signed-in home while the marketplace is closed. */
export const SITE_CLOSURE_ACCOUNT_HOME = "/dashboard/sales"

const ACCOUNT_PREFIXES = [
  "/dashboard/earnings",
  "/dashboard/purchases",
  "/dashboard/sales",
  "/dashboard/profile",
  "/dashboard/payouts",
  "/dashboard/wallet",
  "/dashboard/earning",
  "/dashboard/orders",
  "/dashboard/team",
  "/seller/payouts",
] as const

const BLOCKED_AUTH_PATHS = new Set([
  "/auth/sign-up",
  "/auth/sign-up-success",
  "/auth/google-sign-up-success",
])

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isSiteClosureAuthPath(pathname: string): boolean {
  if (pathname !== "/auth" && !pathname.startsWith("/auth/")) return false
  if (BLOCKED_AUTH_PATHS.has(pathname) || pathname.startsWith("/auth/sign-up/")) return false
  return true
}

/** Earnings, purchases, sales, profile, and the redirects those flows still use. */
export function isSiteClosureAccountPath(pathname: string): boolean {
  if (pathname === "/dashboard") return true
  return ACCOUNT_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
}

export function isSiteClosureExemptPath(pathname: string): boolean {
  if (pathname === SITE_CLOSURE_PATH) return true
  if (pathname === "/api" || pathname.startsWith("/api/")) return true
  if (matchesPrefix(pathname, "/admin")) return true
  if (matchesPrefix(pathname, "/media")) return true
  if (pathname === "/ingest" || pathname.startsWith("/ingest/")) return true
  if (pathname.startsWith("/.well-known")) return true
  if (isSiteClosureAuthPath(pathname)) return true
  if (isSiteClosureAccountPath(pathname)) return true
  return false
}

/**
 * Sign-in should land in the account area. Walled destinations (home, sell, search)
 * fall back to sales so login does not bounce straight into the shutdown page.
 */
export function closurePostAuthPath(path: string | null): string {
  if (!SITE_CLOSED) return path?.trim() || "/"
  const next = path?.trim() || ""
  if (!next.startsWith("/") || next.startsWith("//")) return SITE_CLOSURE_ACCOUNT_HOME
  const queryIndex = next.indexOf("?")
  const pathname = queryIndex === -1 ? next : next.slice(0, queryIndex)
  if (isSiteClosureAccountPath(pathname) || matchesPrefix(pathname, "/admin")) return next
  return SITE_CLOSURE_ACCOUNT_HOME
}

export function shouldServeSiteClosurePage(input: {
  method: string
  pathname: string
  searchParams: URLSearchParams
  isServerAction: boolean
}): boolean {
  if (!SITE_CLOSED) return false
  if (input.isServerAction) return false
  if (input.method !== "GET" && input.method !== "HEAD") return false
  if (supabaseAuthForwardPathname(input.pathname, input.searchParams)) return false
  return !isSiteClosureExemptPath(input.pathname)
}
