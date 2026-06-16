import { safeRedirectPath } from '@/lib/auth/safe-redirect'

/** Query param: full-page auth auto-starts Google OAuth (after escaping an in-app browser). */
export const GOOGLE_OAUTH_AUTO_START_PARAM = 'google'

/**
 * Full-page auth URL opened in Safari/Chrome so PKCE cookies and `/auth/callback`
 * stay in the same browser context.
 */
export function buildGoogleOAuthHandoffUrl(
  origin: string,
  nextPath: string,
  mode: 'login' | 'sign-up' = 'login',
): string {
  const base = origin.replace(/\/$/, '')
  const redirect = encodeURIComponent(safeRedirectPath(nextPath))
  return `${base}/auth/${mode}?redirect=${redirect}&${GOOGLE_OAUTH_AUTO_START_PARAM}=1`
}
