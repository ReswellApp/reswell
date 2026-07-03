import { buildAuthCompletingUrl } from "@/lib/auth/build-auth-completing-url"
import { passwordResetLandingPath } from "@/lib/auth/password-reset-landing-flag"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { buildEmailSignUpSuccessPath } from "@/lib/google-ads/sign-up-success-path"
import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created"
import { applyMarketingEmailConsent } from "@/lib/services/marketingEmailConsent"
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse, after } from "next/server"

// Handles email confirmation links from Supabase.
// Supabase's {{ .ConfirmationURL }} uses type=email (not signup) for confirm-signup emails.
// See https://supabase.com/docs/guides/auth/auth-email-templates
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as
    | "email"
    | "signup"
    | "recovery"
    | "invite"
    | null
  if (token_hash && type) {
    const isSignupConfirmation = type === "signup" || type === "email"
    let redirectPath =
      type === "recovery" ? passwordResetLandingPath() : safeRedirectPath(searchParams.get("next"))
    if (isSignupConfirmation) {
      redirectPath = buildEmailSignUpSuccessPath(redirectPath)
    }
    const redirectResponse = NextResponse.redirect(`${origin}${redirectPath}`)
    const supabase = createRouteHandlerSupabaseClient(
      request,
      redirectResponse,
    )
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      const u = data.user ?? data.session?.user
      if (isSignupConfirmation && u) {
        after(async () => {
          try {
            const hasServiceRole = Boolean(
              process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
            )
            if (hasServiceRole) {
              const serviceRole = createServiceRoleClient()
              const meta = u.user_metadata as Record<string, unknown> | undefined
              if (typeof meta?.marketing_opt_in === "boolean") {
                await applyMarketingEmailConsent({
                  userId: u.id,
                  email: u.email ?? null,
                  optIn: meta.marketing_opt_in,
                  supabase: serviceRole,
                })
              }
              await trackKlaviyoNewAccountCreated(u, {
                supabaseForProfile: serviceRole,
              })
            } else {
              await trackKlaviyoNewAccountCreated(u, {
                supabaseForProfile: supabase,
              })
            }
          } catch (e) {
            console.error("[auth/confirm] Klaviyo new-account failed:", e)
          }
        })
      }
      redirectResponse.headers.set("Cache-Control", "private, no-store")
      return redirectResponse
    }
  }

  const next = safeRedirectPath(searchParams.get("next"))
  return NextResponse.redirect(buildAuthCompletingUrl(origin, next))
}
