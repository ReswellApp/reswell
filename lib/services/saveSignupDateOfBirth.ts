import type { User } from "@supabase/supabase-js"
import { signupDateOfBirthSchema } from "@reswell/api-contract"

import { insertSignupDateOfBirthIfEmpty } from "@/lib/db/signupDateOfBirth"
import { createServiceRoleClient } from "@/lib/supabase/server"

function parsedSignupDateOfBirth(value: unknown): string | null {
  if (typeof value !== "string") return null
  const parsed = signupDateOfBirthSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function dateOfBirthFromUserMetadata(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  return parsedSignupDateOfBirth(meta?.date_of_birth)
}

/**
 * Persist an 18+ birthday on first write only. Failures stay off the signup result.
 */
export async function saveSignupDateOfBirth(
  userId: string,
  dateOfBirth: string | null | undefined,
): Promise<void> {
  const iso = parsedSignupDateOfBirth(dateOfBirth)
  if (!iso) return
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn("[signup] date of birth skipped: no service role key")
    return
  }

  try {
    await insertSignupDateOfBirthIfEmpty(createServiceRoleClient(), userId, iso)
  } catch (error) {
    console.error("[signup] date of birth save failed:", error)
  }
}

export async function saveSignupDateOfBirthFromUser(user: User): Promise<void> {
  await saveSignupDateOfBirth(user.id, dateOfBirthFromUserMetadata(user))
}
