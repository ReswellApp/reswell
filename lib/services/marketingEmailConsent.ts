import type { SupabaseClient } from "@supabase/supabase-js"

import { subscribeKlaviyoProfileEmailMarketing } from "@/lib/klaviyo/subscribe-profile-email-marketing"

export type ApplyMarketingEmailConsentResult = {
  ok: boolean
  error?: string
}

/**
 * Persists marketing email consent on the profile and syncs Klaviyo when opted in.
 * Uses service-role client for profile + Auth metadata updates.
 */
export async function applyMarketingEmailConsent(params: {
  userId: string
  email: string | null
  optIn: boolean
  supabase: SupabaseClient
}): Promise<ApplyMarketingEmailConsentResult> {
  const userId = params.userId.trim()
  if (!userId) {
    return { ok: false, error: "Missing user id" }
  }

  const { error: profileError } = await params.supabase
    .from("profiles")
    .update({
      marketing_emails_opt_out: !params.optIn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (profileError) {
    console.error("[marketingEmailConsent] profile update failed:", profileError.message)
    return { ok: false, error: profileError.message }
  }

  const { error: authError } = await params.supabase.auth.admin.updateUserById(
    userId,
    {
      user_metadata: { marketing_opt_in: params.optIn },
    },
  )

  if (authError) {
    console.error("[marketingEmailConsent] auth metadata update failed:", authError.message)
    return { ok: false, error: authError.message }
  }

  const email = params.email?.trim()
  if (params.optIn && email) {
    const subscribed = await subscribeKlaviyoProfileEmailMarketing({
      email,
      externalId: userId,
    })
    if (!subscribed.ok && !subscribed.skipped) {
      console.warn(
        "[marketingEmailConsent] Klaviyo subscribe failed:",
        subscribed.status,
        subscribed.detail.slice(0, 200),
      )
    }
  }

  return { ok: true }
}
