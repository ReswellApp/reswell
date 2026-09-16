import { createClient } from "@/lib/supabase/server"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { LIVE_CHAT_WIDGET_ADMIN_ONLY } from "@/lib/live-chat/widget-config"
import {
  liveChatVisitorAccessDecision,
  type LiveChatVisitorAccess,
} from "@/lib/live-chat/visitor-access"

export type { LiveChatVisitorAccess }

/** Visitor widget + public live-chat APIs. Staff inbox routes stay on their own gates. */
export async function assertLiveChatVisitorAccess(): Promise<LiveChatVisitorAccess> {
  if (!LIVE_CHAT_WIDGET_ADMIN_ONLY) return { ok: true }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return liveChatVisitorAccessDecision({ adminOnly: true, signedIn: false, isAdmin: false })

  const isAdmin = await fetchProfileIsAdmin(supabase, user.id)
  return liveChatVisitorAccessDecision({ adminOnly: true, signedIn: true, isAdmin })
}
