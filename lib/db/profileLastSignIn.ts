import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Inactivity anchor for Klaviyo winback: last auth sign-in, or account creation if never signed in.
 * Requires service role (auth.admin).
 */
export async function fetchProfileLastSignInAnchor(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ iso: string | null; error: string | null }> {
  const id = userId.trim()
  if (!id) return { iso: null, error: "missing_user_id" }

  const { data, error } = await supabase.auth.admin.getUserById(id)
  if (error) return { iso: null, error: error.message }
  if (!data.user) return { iso: null, error: "user_not_found" }

  const iso =
    data.user.last_sign_in_at?.trim() || data.user.created_at?.trim() || null
  return { iso, error: null }
}
