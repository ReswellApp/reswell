/**
 * Server-only: Klaviyo Events API — fires when a user requests a password reset.
 *
 * **Metric name in Klaviyo:** `Password Reset Requested` — create a flow:
 * Flows → Create flow → Metric → **Password Reset Requested** → Email.
 *
 * **Template variables (event properties):**
 * - `{{ event.reset_url }}` — primary CTA (`/auth/recovery?token_hash=…&type=recovery`)
 * - `{{ event.email }}` — account email the reset was requested for
 * - `{{ event.site_url }}` — canonical Reswell origin (footer / secondary links)
 * - `{{ event.logo_url }}` — hosted wordmark for email header
 *
 * **Recommended flow settings (required for instant delivery):**
 * - Flow trigger: Metric → **Password Reset Requested** (no time delay before the email step)
 * - Email step → Settings → **uncheck** “Skip recently emailed profiles” (Smart Sending off)
 * - Email step → mark as **Transactional** and request Klaviyo approval (subject “Transactional Email Request”)
 * - Account → Settings → Email → Smart Sending → check **Ignore transactional messages**
 * - Flow status: **Live**; allow re-entry (users may request multiple resets)
 *
 * **If emails are slow or never arrive:** open the flow → Analytics → find the profile. Common blocks:
 * skipped by Smart Sending, waiting on a time-delay step, profile suppressed (non-transactional flow),
 * or flow still in draft. The app posts the event synchronously on submit — Klaviyo queue is usually under 1 min.
 *
 * The app generates the recovery link with `auth.admin.generateLink` (no Supabase auth email when Klaviyo is configured).
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
