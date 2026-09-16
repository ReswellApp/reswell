import { cookies } from "next/headers"
import { LiveChatWidgetLoader } from "@/components/features/live-chat/live-chat-widget-loader"
import { getSiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"
import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"

/**
 * Public live chat launcher. Staff-only while the channel is in testing —
 * only `profiles.is_admin` sees the widget. Employees and members do not.
 */
export async function LiveChatWidgetGate() {
  const cookieStore = await cookies()
  if (!hasSupabaseAuthCookies(cookieStore.getAll())) return null

  const { bootstrap } = await getSiteChromeAuthPayload()
  if (bootstrap?.profile?.is_admin !== true) return null

  return <LiveChatWidgetLoader />
}
