import { safeRedirectPath } from "@/lib/auth/safe-redirect"

export type AuthLandingPath = "/auth/login" | "/auth/sign-up"

/** Build a login or sign-up landing URL, preserving an optional post-auth redirect. */
export function authLandingHref(path: AuthLandingPath, redirect?: string | null): string {
  const dest = safeRedirectPath(redirect ?? null)
  if (dest === "/") return path
  return `${path}?redirect=${encodeURIComponent(dest)}`
}
