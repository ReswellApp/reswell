/**
 * Server-only: Klaviyo Events API — fires when a user requests a password reset.
 *
 * **Metric name in Klaviyo:** `Password Reset Requested` — create a flow:
 * Flows → Create flow → Metric → **Password Reset Requested** → Email.
 *
 * **Template variables (event properties):**
 * - `{{ event.reset_url }}` — primary CTA link (Supabase recovery `action_link`)
 * - `{{ event.email }}` — account email the reset was requested for
 * - `{{ event.site_url }}` — canonical Reswell origin (footer / secondary links)
 * - `{{ event.logo_url }}` — hosted wordmark for email header
 *
 * **Recommended flow settings:**
 * - Transactional intent (not promotional)
 * - Filter: none required (event only fires for real accounts)
 * - Re-entry: allow (users may request multiple resets)
 *
 * The app generates the recovery link with `auth.admin.generateLink` (no Supabase auth email).
 */

import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoPasswordResetRequestedPayload = {
  email: string
  /** Supabase user id when the account exists. */
  externalId?: string | null
  /** Full recovery URL from `generateLink` (`properties.action_link`). */
  resetUrl: string
}

export async function trackKlaviyoPasswordResetRequested(
  payload: KlaviyoPasswordResetRequestedPayload,
): Promise<{ ok: boolean; skipped: boolean }> {
  const email = payload.email.trim()
  const resetUrl = payload.resetUrl.trim()
  if (!email || !resetUrl) {
    console.warn("[klaviyo] Password Reset Requested skipped — missing email or reset_url")
    return { ok: false, skipped: true }
  }

  const siteOrigin = publicSiteOriginForEmail().replace(/\/$/, "")
  const time = new Date().toISOString()
  const ext = payload.externalId?.trim() || undefined

  const result = await sendKlaviyoServerEvent({
    metricName: "Password Reset Requested",
    profile: {
      email,
      ...(ext ? { external_id: ext } : {}),
    },
    properties: {
      time,
      email,
      reset_url: resetUrl,
      site_url: siteOrigin,
      logo_url: `${siteOrigin}/images/reswell-logo.png`,
    },
    uniqueId: `password-reset-${ext ?? email}-${time}`,
  })

  return { ok: result.ok, skipped: result.skipped }
}
