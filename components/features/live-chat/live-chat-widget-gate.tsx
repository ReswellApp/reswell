import { cookies } from "next/headers"
import { LiveChatWidgetLoader } from "@/components/features/live-chat/live-chat-widget-loader"
import { getSiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"
import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"
import { LIVE_CHAT_WIDGET_ADMIN_ONLY } from "@/lib/live-chat/widget-config"

/**
 * Public live chat launcher. While `LIVE_CHAT_WIDGET_ADMIN_ONLY` is on,
 * only `profiles.is_admin` sees the widget. Employees and members do not.
 */
export async function LiveChatWidgetGate() {
  if (LIVE_CHAT_WIDGET_ADMIN_ONLY) {
    const cookieStore = await cookies()
    if (!hasSupabaseAuthCookies(cookieStore.getAll())) return null

    const { bootstrap } = await getSiteChromeAuthPayload()
    if (bootstrap?.profile?.is_admin !== true) return null
  }

  return <LiveChatWidgetLoader />
}
