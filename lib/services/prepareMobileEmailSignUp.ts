import type { MobileSignUpBody } from "@reswell/api-contract"

import { resolveSignUpDisplayName } from "@/lib/auth/sign-up-display-name"
import { validateSignUpPassword } from "@/lib/auth/sign-up-password-validation"

export type PreparedEmailSignUp = {
  email: string
  password: string
  metadata: {
    display_name: string
    first_name: string
    last_name: string
    marketing_opt_in: boolean
    username?: string
  }
}

/** Website sign-up rules, before any Auth call. */
export function prepareMobileEmailSignUp(
  input: MobileSignUpBody,
): { ok: true; value: PreparedEmailSignUp } | { ok: false; error: string } {
  const password = validateSignUpPassword(input.password)
  if (!password.valid) return { ok: false, error: password.error }

  const displayName = resolveSignUpDisplayName({
    username: input.username,
    firstName: input.first_name,
    lastName: input.last_name,
    email: input.email,
  })
  if (!displayName.ok) return { ok: false, error: displayName.error }

  const username = input.username.trim()
  return {
    ok: true,
    value: {
      email: input.email.trim(),
      password: input.password,
      metadata: {
        display_name: displayName.displayName,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        marketing_opt_in: input.marketing_opt_in,
        ...(username ? { username } : {}),
      },
    },
  }
}
