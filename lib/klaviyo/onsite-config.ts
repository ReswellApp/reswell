/**
 * Klaviyo onsite.js public company ID. Safe to expose via NEXT_PUBLIC_* — it appears in the
 * script URL Klaviyo provides for onsite forms, SMS widgets, and client-side identify calls.
 */

const KLAVIYO_COMPANY_ID_PATTERN = /^[A-Za-z0-9]{4,16}$/

/** Returns the configured company ID, or null when unset/invalid (snippet should no-op). */
export function getKlaviyoCompanyId(): string | null {
  const raw = process.env.NEXT_PUBLIC_KLAVIYO_COMPANY_ID?.trim()
  if (!raw || !KLAVIYO_COMPANY_ID_PATTERN.test(raw)) return null
  return raw
}
