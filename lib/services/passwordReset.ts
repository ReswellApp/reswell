import { buildPasswordRecoveryCallbackUrl } from "@/lib/auth/password-recovery-callback-url"
import { resolveAuthSiteOrigin } from "@/lib/auth/resolve-auth-site-origin"
import { trackKlaviyoPasswordResetRequested } from "@/lib/klaviyo/track-password-reset-requested"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  requestPasswordResetSchema,
  type RequestPasswordResetInput,
} from "@/lib/validations/passwordReset"

type RequestPasswordResetResult =
  | { success: true }
  | { error: string }

function resolveRedirectOrigin(input: RequestPasswordResetInput): string {
  if (input.siteOrigin?.trim()) {
    return resolveAuthSiteOrigin(input.siteOrigin.trim())
  }
  return resolveAuthSiteOrigin(publicSiteOriginForEmail())
}

/**
 * Password reset via Klaviyo flow (metric **Password Reset Requested**).
 * Generates a Supabase recovery link server-side without sending Supabase's default auth email.
 * Always returns success when the email format is valid — does not reveal account existence.
 */
export async function requestPasswordResetService(
  raw: unknown,
): Promise<RequestPasswordResetResult> {
  const parsed = requestPasswordResetSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Enter a valid email address." }
  }

  let redirectOrigin: string
  try {
    redirectOrigin = resolveRedirectOrigin(parsed.data)
  } catch {
    return { error: "Could not send reset email. Please try again." }
  }

  const redirectTo = buildPasswordRecoveryCallbackUrl(redirectOrigin)
  const email = parsed.data.email

  const klaviyoConfigured = Boolean(process.env.KLAVIYO_API_KEY?.trim())

  if (klaviyoConfigured) {
    try {
      const admin = createServiceRoleClient()
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      })

      if (error || !data?.properties?.action_link) {
        // No account for this email, or link generation failed — do not reveal which.
        return { success: true }
      }

      const klaviyo = await trackKlaviyoPasswordResetRequested({
        email,
        externalId: data.user?.id ?? null,
        resetUrl: data.properties.action_link,
      })

      if (!klaviyo.ok && !klaviyo.skipped) {
        console.error("[auth] Password Reset Requested Klaviyo event failed for", email)
      }

      return { success: true }
    } catch (err) {
      console.error("[auth] password reset via Klaviyo failed:", err)
      return { error: "Could not send reset email. Please try again." }
    }
  }

  // Dev fallback when Klaviyo is not configured — uses Supabase's built-in email.
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) {
    console.error("[auth] resetPasswordForEmail failed:", error.message)
    return { error: "Could not send reset email. Please try again." }
  }

  return { success: true }
}
