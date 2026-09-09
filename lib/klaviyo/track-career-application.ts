/**
 * Server-only: Klaviyo Events API — fires when someone submits a careers application.
 *
 * **Metric name in Klaviyo:** `Career Application Submitted`
 *
 * Create a flow: Flows → Create flow → Metric → **Career Application Submitted**.
 * Filter `reswell_metric_seed` is not true if you use bootstrap events.
 *
 * Applicant confirmation HTML: `lib/klaviyo/career-application-submitted-email.html`
 * Template properties:
 * - `{{ event.first_name }}`
 * - `{{ event.role_title }}`
 * - `{{ event.careers_url }}`
 *
 * Internal notify-the-team flow can also use:
 * - `{{ event.name }}` `{{ event.email }}` `{{ event.phone }}`
 * - `{{ event.surfing_note }}` `{{ event.favorite_board }}`
 * - `{{ event.admin_url }}`
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

export const CAREER_APPLICATION_SUBMITTED_METRIC = "Career Application Submitted"

const NOTE_PROP_MAX = 800

function firstNameFrom(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
}

function trimNote(text: string): string {
  const t = text.trim()
  if (t.length <= NOTE_PROP_MAX) return t
  return `${t.slice(0, NOTE_PROP_MAX)}…`
}

export type KlaviyoCareerApplicationPayload = {
  applicationId: string
  email: string
  name: string
  phone?: string | null
  roleSlug: string | null
  roleTitle: string
  surfingNote: string
  favoriteBoard: string
  hasResume: boolean
}

export async function trackKlaviyoCareerApplicationSubmitted(
  payload: KlaviyoCareerApplicationPayload,
): Promise<void> {
  const email = payload.email.trim()
  const applicationId = payload.applicationId.trim()
  if (!email || !applicationId || applicationId === "ok") return

  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const slug = payload.roleSlug?.trim() || ""
  const name = payload.name.trim()

  const result = await sendKlaviyoServerEvent({
    metricName: CAREER_APPLICATION_SUBMITTED_METRIC,
    profile: { email },
    properties: {
      time: new Date().toISOString(),
      application_id: applicationId,
      name,
      first_name: firstNameFrom(name),
      email,
      phone: payload.phone?.trim() ?? "",
      role_slug: slug,
      role_title: payload.roleTitle.trim(),
      surfing_note: trimNote(payload.surfingNote),
      favorite_board: trimNote(payload.favoriteBoard),
      has_resume: payload.hasResume,
      careers_url: `${origin}/careers`,
      apply_url: slug ? `${origin}/careers/${slug}/apply` : `${origin}/careers/apply`,
      admin_url: `${origin}/admin/careers/${applicationId}`,
    },
    uniqueId: `career-application-${applicationId}`,
  })

  if (result.skipped && result.skipReason) {
    console.warn("[klaviyo] Career Application Submitted skipped:", result.skipReason)
  } else if (!result.ok) {
    console.error(
      "[klaviyo] Career Application Submitted failed:",
      result.status,
      result.detail,
    )
  }
}
