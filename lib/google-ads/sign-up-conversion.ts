/** Query param appended to post-auth redirects so the client can fire a one-time conversion. */
export const GOOGLE_ADS_SIGNUP_QUERY_PARAM = "gads_signup"

const SIGNUP_DEDUP_STORAGE_PREFIX = "rw_google_ads_signup_reported"

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function getSignUpConversionSendTo(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION?.trim()
  if (!raw) return null
  // Google format: AW-XXXXXXXXX/ConversionLabel
  if (!/^AW-\d+\/[A-Za-z0-9_-]+$/.test(raw)) return null
  return raw
}

function signUpDedupKey(userId?: string): string {
  return userId?.trim()
    ? `${SIGNUP_DEDUP_STORAGE_PREFIX}_${userId.trim()}`
    : SIGNUP_DEDUP_STORAGE_PREFIX
}

function hasReportedSignUpConversion(userId?: string): boolean {
  try {
    return sessionStorage.getItem(signUpDedupKey(userId)) === "1"
  } catch {
    return false
  }
}

function markSignUpConversionReported(userId?: string): void {
  try {
    sessionStorage.setItem(signUpDedupKey(userId), "1")
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Appends {@link GOOGLE_ADS_SIGNUP_QUERY_PARAM}=1 to a same-origin redirect path
 * (server-side, e.g. OAuth callback).
 */
export function appendSignUpConversionFlag(path: string): string {
  const trimmed = path.trim() || "/"
  const qIndex = trimmed.indexOf("?")
  const pathname = qIndex === -1 ? trimmed : trimmed.slice(0, qIndex)
  const query = qIndex === -1 ? "" : trimmed.slice(qIndex + 1)
  const params = new URLSearchParams(query)
  params.set(GOOGLE_ADS_SIGNUP_QUERY_PARAM, "1")
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export type ReportSignUpConversionOptions = {
  /** When known, dedupe per account (OAuth redirect + in-form signup). */
  userId?: string
  /** Optional callback after gtag acknowledges the event (Google snippet pattern). */
  onComplete?: () => void
}

/**
 * Fires the Google Ads sign-up conversion once per browser session / user id.
 * No-op when conversion env is unset or gtag is not loaded.
 */
export function reportSignUpConversion(
  options?: ReportSignUpConversionOptions,
): boolean {
  if (typeof window === "undefined") return false

  const sendTo = getSignUpConversionSendTo()
  if (!sendTo) return false

  const userId = options?.userId?.trim()
  if (hasReportedSignUpConversion(userId)) return false

  const gtag = window.gtag
  if (typeof gtag !== "function") return false

  markSignUpConversionReported(userId)

  gtag("event", "conversion", {
    send_to: sendTo,
    value: 1.0,
    currency: "USD",
    event_callback: () => {
      options?.onComplete?.()
    },
  })

  return true
}
