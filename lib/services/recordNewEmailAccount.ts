import type { SupabaseClient, User } from "@supabase/supabase-js"

import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created"
import { applyMarketingEmailConsent } from "@/lib/services/marketingEmailConsent"
import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Marketing consent and the Klaviyo “New Account Created” event.
 * Shared by the website hook and app sign-up. Failures stay off the signup result.
 */
export async function recordNewEmailAccountCreated(
  user: User,
  supabaseForProfile?: SupabaseClient,
): Promise<void> {
  try {
    const serviceRole = createServiceRoleClient()
    const meta = user.user_metadata as Record<string, unknown> | undefined
    if (typeof meta?.marketing_opt_in === "boolean") {
      await applyMarketingEmailConsent({
        userId: user.id,
        email: user.email ?? null,
        optIn: meta.marketing_opt_in,
        supabase: serviceRole,
      })
    }
  } catch (error) {
    console.error("[klaviyo] new-account-created: marketing consent failed:", error)
  }

  try {
    await trackKlaviyoNewAccountCreated(user, { supabaseForProfile })
  } catch (error) {
    console.error("[klaviyo] new-account-created: event failed:", error)
  }
}
