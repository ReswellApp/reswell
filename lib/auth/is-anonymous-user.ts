import type { User } from "@supabase/supabase-js"

/** True for Supabase anonymous sessions (JWT `is_anonymous`, guest checkout). */
export function isAnonymousSupabaseUser(user: User | null | undefined): boolean {
  if (!user) return false
  return user.is_anonymous === true
}
