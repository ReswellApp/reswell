import {
  MARKETING_OPT_IN_PARAM,
  marketingOptInParamValue,
} from '@/lib/auth/marketing-email-consent'
import { SIGNUP_DATE_OF_BIRTH_PARAM } from '@/lib/auth/signup-date-of-birth'
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
  marketingOptIn?: boolean,
  dateOfBirth?: string,
): string {
  const base = origin.replace(/\/$/, '')
  const redirect = encodeURIComponent(safeRedirectPath(nextPath))
  let url = `${base}/auth/${mode}?redirect=${redirect}&${GOOGLE_OAUTH_AUTO_START_PARAM}=1`
  if (marketingOptIn !== undefined) {
    url += `&${MARKETING_OPT_IN_PARAM}=${marketingOptInParamValue(marketingOptIn)}`
  }
  if (dateOfBirth) {
    url += `&${SIGNUP_DATE_OF_BIRTH_PARAM}=${encodeURIComponent(dateOfBirth)}`
  }
  return url
}
