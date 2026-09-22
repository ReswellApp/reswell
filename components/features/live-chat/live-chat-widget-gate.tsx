"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { LiveChatWidgetLoader } from "@/components/features/live-chat/live-chat-widget-loader"
import { LIVE_CHAT_WIDGET_ADMIN_ONLY } from "@/lib/live-chat/widget-config"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"

/**
 * Admin-only launcher. Resolved in the browser so the root layout does not
 * read cookies during the public HTML render.
 */
export function LiveChatWidgetGate() {
  const [allowed, setAllowed] = useState(!LIVE_CHAT_WIDGET_ADMIN_ONLY)

  useEffect(() => {
    if (!LIVE_CHAT_WIDGET_ADMIN_ONLY) return
    if (!hasSupabaseAuthCookiesClient()) return

    let cancelled = false
    const supabase = createClient()
    void supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled || !data.user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .maybeSingle()
      if (!cancelled && profile?.is_admin === true) setAllowed(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!allowed) return null
  return <LiveChatWidgetLoader />
}
