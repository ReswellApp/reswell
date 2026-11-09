import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Realtime authorizes postgres changes and private broadcasts with the access
 * token at subscribe time. Subscribing before the session is on the socket
 * drops every later message until a full reload.
 */
export async function authorizeRealtime(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return false
    await supabase.realtime.setAuth(token)
    return true
  } catch {
    return false
  }
}
