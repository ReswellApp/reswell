import type { MobileSignUpBody, MobileSignUpResult } from "@reswell/api-contract"

import { recordNewEmailAccountCreated } from "@/lib/services/recordNewEmailAccount"
import { prepareMobileEmailSignUp } from "@/lib/services/prepareMobileEmailSignUp"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createAnonSupabaseClient, createUserJwtSupabaseClient } from "@/lib/supabase/server"

/** Email/password sign-up used by the app. Same Auth metadata as the website form. */
export async function registerMobileEmailAccount(
  input: MobileSignUpBody,
): Promise<MobileApiResult<MobileSignUpResult>> {
  const prepared = prepareMobileEmailSignUp(input)
  if (!prepared.ok) return { ok: false, status: 400, error: prepared.error }

  const supabase = createAnonSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email: prepared.value.email,
    password: prepared.value.password,
    options: {
      emailRedirectTo: `${publicSiteOrigin()}/auth/confirm?next=${encodeURIComponent("/")}`,
      data: prepared.value.metadata,
    },
  })

  if (error) return { ok: false, status: 400, error: error.message }

  const session = data.session
  if (session?.access_token && session.refresh_token && session.user) {
    await recordNewEmailAccountCreated(
      session.user,
      createUserJwtSupabaseClient(session.access_token),
    )
    return {
      ok: true,
      data: {
        status: "signed_in",
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    }
  }

  return {
    ok: true,
    data: {
      status: "confirm_email",
      access_token: null,
      refresh_token: null,
    },
  }
}
