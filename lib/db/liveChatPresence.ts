import type { SupabaseClient } from "@supabase/supabase-js"

export const LIVE_CHAT_AGENT_ONLINE_WINDOW_MS = 45_000

export type LiveChatAgentPresenceRow = {
  user_id: string
  display_name: string
  last_seen_at: string
}

export async function upsertLiveChatAgentPresence(
  supabase: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<boolean> {
  const { error } = await supabase.from("live_chat_agent_presence").upsert(
    {
      user_id: userId,
      display_name: displayName,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (error) {
    console.error("upsertLiveChatAgentPresence", error)
    return false
  }
  return true
}

export async function listFreshLiveChatAgentPresence(
  supabase: SupabaseClient,
): Promise<LiveChatAgentPresenceRow[]> {
  const cutoff = new Date(Date.now() - LIVE_CHAT_AGENT_ONLINE_WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from("live_chat_agent_presence")
    .select("user_id, display_name, last_seen_at")
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false })

  if (error || !data) {
    if (error) console.error("listFreshLiveChatAgentPresence", error)
    return []
  }
  return data.map((row) => ({
    user_id: String(row.user_id),
    display_name: String(row.display_name ?? "Support"),
    last_seen_at: String(row.last_seen_at),
  }))
}

export async function countFreshLiveChatAgents(supabase: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - LIVE_CHAT_AGENT_ONLINE_WINDOW_MS).toISOString()
  const { count, error } = await supabase
    .from("live_chat_agent_presence")
    .select("*", { count: "exact", head: true })
    .gte("last_seen_at", cutoff)
  if (error) {
    console.error("countFreshLiveChatAgents", error)
    return 0
  }
  return count ?? 0
}
