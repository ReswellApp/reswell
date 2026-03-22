import { safeRedirectPath } from '@/lib/auth/safe-redirect'

/**
 * URL Supabase redirects to after Google (or other OAuth). Must be listed in
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * for each origin you use (e.g. http://localhost:3000 and production).
 *
 * Always uses the browser origin where the user started OAuth so PKCE cookies
 * match. Do not substitute NEXT_PUBLIC_APP_URL — if that points at another
 * host (e.g. prod while testing on localhost), code exchange fails.
 */
export function buildOAuthCallbackUrl(nextPath: string, windowOrigin: string): string {
  const safeNext = safeRedirectPath(nextPath)
  const base = windowOrigin.replace(/\/$/, '')
  const next = encodeURIComponent(safeNext)
  return `${base}/auth/callback?next=${next}`
}
