import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/** Login URL after an explicit sign-out — suppresses auto re-login and preserves redirect. */
export function postSignOutLoginHref(redirect?: string | null): string {
  const dest = safeRedirectPath(redirect ?? null)
  const base = authLandingHref("/auth/login", dest === "/" ? null : dest)
  const separator = base.includes("?") ? "&" : "?"
  return `${base}${separator}signed_out=1`
}
