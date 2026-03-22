import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/** One Supabase client + auth lookup per request (layout + page share this). */
export const getCachedDashboardSession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
})
