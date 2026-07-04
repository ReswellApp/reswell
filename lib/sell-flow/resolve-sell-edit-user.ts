import type { SupabaseClient, User } from "@supabase/supabase-js"

import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"

/** Session-safe user lookup for /sell edit hydration (avoids getUser() race after auth gate). */
export async function resolveSellEditUser(supabase: SupabaseClient): Promise<User | null> {
  const session = await resolveClientSessionForMutation(supabase)
  return session?.user ?? null
}
