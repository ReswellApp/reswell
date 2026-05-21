import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"

/**
 * After server-side OAuth (`/auth/callback`), session cookies can land on the document
 * request before the browser Supabase client reads them. Poll briefly instead of
 * treating a single `getUser()` miss as signed-out.
 */
export async function waitForClientSession(options?: {
  supabase?: SupabaseClient
  msBetween?: number
  maxAttempts?: number
}): Promise<Session | null> {
  const supabase = options?.supabase ?? createClient()
  const msBetween = options?.msBetween ?? 75
  const maxAttempts = options?.maxAttempts ?? 40

  for (let i = 0; i < maxAttempts; i += 1) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) return data.session
    await new Promise((r) => setTimeout(r, msBetween))
  }

  const userResult = await getAuthUserWithRetry(supabase, { attempts: 2 })
  if (userResult.ok && userResult.user) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) return data.session
  }

  return null
}
