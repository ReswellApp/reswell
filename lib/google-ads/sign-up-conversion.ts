/** Query param appended to post-auth redirects so the client can fire a one-time conversion. */
export const GOOGLE_ADS_SIGNUP_QUERY_PARAM = "gads_signup"

const SIGNUP_DEDUP_STORAGE_PREFIX = "rw_google_ads_signup_reported"
const GTAG_WAIT_MS = 8_000
const GTAG_POLL_MS = 50
const CONVERSION_CALLBACK_TIMEOUT_MS = 2_000

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function getSignUpConversionSendTo(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION?.trim()
  if (!raw) return null
  if (!/^AW-\d+\/[A-Za-z0-9_-]+$/.test(raw)) return null
  return raw
}

function signUpDedupKey(userId?: string): string {
  return userId?.trim()
    ? `${SIGNUP_DEDUP_STORAGE_PREFIX}_${userId.trim()}`
    : SIGNUP_DEDUP_STORAGE_PREFIX
}

export function hasReportedSignUpConversion(userId?: string): boolean {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForGtag(maxMs = GTAG_WAIT_MS): Promise<NonNullable<Window["gtag"]> | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (typeof window.gtag === "function") return window.gtag
    await sleep(GTAG_POLL_MS)
  }
  return null
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

function fireSignUpConversionEvent(
  gtag: NonNullable<Window["gtag"]>,
  sendTo: string,
  onComplete?: () => void,
): void {
  gtag("event", "conversion", {
    send_to: sendTo,
    value: 1.0,
    currency: "USD",
    event_callback: () => {
      onComplete?.()
    },
  })
}

/**
 * Fires the Google Ads sign-up conversion once per browser session / user id.
 * Waits for gtag.js to load. Resolves when the event is sent (or times out).
 */
export async function reportSignUpConversion(
  options?: ReportSignUpConversionOptions,
): Promise<boolean> {
  if (typeof window === "undefined") return false

  const sendTo = getSignUpConversionSendTo()
  if (!sendTo) return false

  const userId = options?.userId?.trim()
  if (hasReportedSignUpConversion(userId)) return true

  const gtag = await waitForGtag()
  if (!gtag) return false

  if (hasReportedSignUpConversion(userId)) return true
  markSignUpConversionReported(userId)

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    fireSignUpConversionEvent(gtag, sendTo, () => {
      options?.onComplete?.()
      finish()
    })

    window.setTimeout(finish, CONVERSION_CALLBACK_TIMEOUT_MS)
  })

  return true
}

/** True when the current URL includes the post-OAuth signup conversion flag. */
export function urlHasSignUpConversionFlag(): boolean {
  if (typeof window === "undefined") return false
  try {
    return (
      new URLSearchParams(window.location.search).get(
        GOOGLE_ADS_SIGNUP_QUERY_PARAM,
      ) === "1"
    )
  } catch {
    return false
  }
}
