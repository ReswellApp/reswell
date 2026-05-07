import { cache } from "react"
import type { User } from "@supabase/supabase-js"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import {
  fetchHeaderSiteBootstrap,
  type HeaderSiteBootstrap,
} from "@/lib/auth/header-site-bootstrap"

export type SiteChromeAuthPayload = {
  user: User | null
  bootstrap: HeaderSiteBootstrap | null
}

export type { HeaderSiteBootstrap }

/**
 * **Server source of truth for site chrome** (header account area): session + parallel nav data.
 * Nested under the same request `cache` as `getCachedRequestSession` so dashboard/pages
 * don’t pay for a second `getUser()` when they import the shared session helper.
 */
export const getSiteChromeAuthPayload = cache(async (): Promise<SiteChromeAuthPayload> => {
  const { supabase, user } = await getCachedRequestSession()
  if (!user) return { user: null, bootstrap: null }
  try {
    const bootstrap = await fetchHeaderSiteBootstrap(supabase, user)
    return { user, bootstrap }
  } catch (e) {
    console.error("[getSiteChromeAuthPayload] header bootstrap failed:", e)
    return { user, bootstrap: null }
  }
})
