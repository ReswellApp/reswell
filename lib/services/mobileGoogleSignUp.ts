import type { MobileGoogleSignUpBody, MobileSignUpResult } from "@reswell/api-contract"
import type { User } from "@supabase/supabase-js"

import { isNewOAuthAccount } from "@/lib/auth/google-sign-up-welcome"
import { ACCOUNT_BANNED_USER_MESSAGE } from "@/lib/messages/account-ban-errors"
import { shouldRejectBannedAuthUser } from "@/lib/auth/reject-banned-auth-user"
import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created"
import { applyMarketingEmailConsent } from "@/lib/services/marketingEmailConsent"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { createAnonSupabaseClient, createServiceRoleClient, createUserJwtSupabaseClient } from "@/lib/supabase/server"

/**
 * Same post-Google work as `/auth/callback` for a first sign-in:
 * marketing consent from the sign-up checkbox, then the welcome event.
 */
async function recordNewGoogleAccount(user: User, accessToken: string, marketingOptIn: boolean): Promise<void> {
  if (!isNewOAuthAccount(user)) return

  try {
    await applyMarketingEmailConsent({
      userId: user.id,
      email: user.email ?? null,
      optIn: marketingOptIn,
      supabase: createServiceRoleClient(),
    })
  } catch (error) {
    console.error("[mobile-auth] google sign-up marketing consent failed:", error)
  }

  const tracked: User = {
    ...user,
    user_metadata: {
      ...user.user_metadata,
      marketing_opt_in: marketingOptIn,
    },
  }

  try {
    await trackKlaviyoNewAccountCreated(tracked, {
      supabaseForProfile: createUserJwtSupabaseClient(accessToken),
    })
  } catch (error) {
    console.error("[mobile-auth] google sign-up welcome event failed:", error)
  }
}

/** Exchange a Google ID token the way the website callback finishes Google sign-up. */
export async function registerMobileGoogleAccount(
  input: MobileGoogleSignUpBody,
): Promise<MobileApiResult<MobileSignUpResult>> {
  const supabase = createAnonSupabaseClient()
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: input.id_token,
    ...(input.access_token ? { access_token: input.access_token } : {}),
    ...(input.nonce ? { nonce: input.nonce } : {}),
  })

  if (error) return { ok: false, status: 400, error: error.message }

  const session = data.session
  const user = session?.user
  if (!session?.access_token || !session.refresh_token || !user) {
    return { ok: false, status: 400, error: "Google did not return a sign-in token." }
  }

  if (await shouldRejectBannedAuthUser(user)) {
    return { ok: false, status: 403, error: ACCOUNT_BANNED_USER_MESSAGE }
  }

  await recordNewGoogleAccount(user, session.access_token, input.marketing_opt_in)

  return {
    ok: true,
    data: {
      status: "signed_in",
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
  }
}
