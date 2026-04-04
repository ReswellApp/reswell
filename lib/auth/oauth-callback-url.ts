import { safeRedirectPath } from '@/lib/auth/safe-redirect'

/**
 * URL Supabase redirects to after Google (or other OAuth). Must be listed in
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * for each origin you use (e.g. http://localhost:3000 and production).
 *
 * Always uses the browser origin where the user started OAuth so PKCE cookies
 * match. Do not substitute NEXT_PUBLIC_APP_URL — if that points at another
 * host (e.g. prod while testing on localhost), code exchange fails.
 *
 * **If localhost login sends you to production:** Supabase falls back to the
 * project's **Site URL** when `redirectTo` is not allowlisted. Add **both**:
 * - `http://localhost:3000/auth/callback` (match your dev port)
 * - `http://127.0.0.1:3000/auth/callback` if you use 127.0.0.1
 * Or use a wildcard pattern the dashboard allows, e.g. `http://localhost:3000/**`
 */
export function buildOAuthCallbackUrl(nextPath: string, windowOrigin: string): string {
  const safeNext = safeRedirectPath(nextPath)
  const base = windowOrigin.replace(/\/$/, '')
  const next = encodeURIComponent(safeNext)
  const redirectTo = `${base}/auth/callback?next=${next}`

  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    console.info(
      '[auth] OAuth redirectTo (must be in Supabase → Auth → URL Configuration → Redirect URLs):',
      redirectTo
    )
  }

  return redirectTo
}
