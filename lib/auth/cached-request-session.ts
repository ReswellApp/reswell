import { cache } from "react"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export type RequestSession = {
  supabase: SupabaseClient
  user: User | null
}

/**
 * **Single SS R auth + Supabase server client per HTTP request** (React `cache` dedupes
 * across layouts, pages, and `SiteChrome` in the same RSC tree).
 *
 * Always pair with `getUser()`, not `getSession()`, on the server — validated JWT.
 */
export const getCachedRequestSession = cache(async (): Promise<RequestSession> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user: user ?? null }
})
