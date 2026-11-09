import type { SupabaseClient } from "@supabase/supabase-js"
import {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  MARKETPLACE_THREAD_REFRESH_EVENT,
  marketplaceInboxChannel,
  marketplaceThreadBroadcastMessageSchema,
  marketplaceThreadChannel,
  marketplaceThreadRefreshSchema,
} from "@reswell/api-contract"
import { getSupabase } from "@/lib/supabase"

const LIVE_DEBOUNCE_MS = 80

let activeConversationId: string | null = null

/** Thread screen the viewer is looking at. Ticker refresh waits so mark-read can land first. */
export function setActiveMarketplaceConversation(conversationId: string | null): void {
  activeConversationId = conversationId
}

export function getActiveMarketplaceConversation(): string | null {
  return activeConversationId
}

async function authorize(supabase: SupabaseClient, accessToken: string): Promise<boolean> {
  try {
    await supabase.realtime.setAuth(accessToken)
    return true
  } catch {
    return false
  }
}

/**
 * Inbox badge and list. Profile updates cover support replies. The private
 * inbox channel covers a new marketplace message even when postgres replication lags.
 */
export function startMarketplaceInboxLive(
  userId: string,
  accessToken: string,
  onActivity: (conversationId: string | null) => void,
): () => void {
  const supabase = getSupabase()
  if (!supabase) return () => undefined
  let active = true

  const notify = (conversationId: string | null) => {
    if (!active) return
    onActivity(conversationId)
  }

  const inbox = supabase.channel(marketplaceInboxChannel(userId), { config: { private: true } })
  inbox.on("broadcast", { event: MARKETPLACE_THREAD_MESSAGE_EVENT }, ({ payload }) => {
    const parsed = marketplaceThreadBroadcastMessageSchema.safeParse(payload)
    if (!parsed.success) return
    notify(parsed.data.conversation_id)
  })
  inbox.on("broadcast", { event: MARKETPLACE_THREAD_REFRESH_EVENT }, ({ payload }) => {
    const parsed = marketplaceThreadRefreshSchema.safeParse(payload)
    if (!parsed.success) return
    notify(parsed.data.conversation_id)
  })

  const profile = supabase
    .channel(`inbox-ticker:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      },
      () => notify(null),
    )

  void authorize(supabase, accessToken).then((ok) => {
    if (!active || !ok) return
    inbox.subscribe()
    profile.subscribe()
  })

  return () => {
    active = false
    void supabase.removeChannel(inbox)
    void supabase.removeChannel(profile)
  }
}

/** Open thread. Fires once per burst so a broadcast and a database insert share one fetch. */
export function subscribeMarketplaceThread(
  conversationId: string,
  accessToken: string,
  onChange: () => void,
): () => void {
  const supabase = getSupabase()
  if (!supabase) return () => undefined
  let active = true
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (!active) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (!active) return
      onChange()
    }, LIVE_DEBOUNCE_MS)
  }

  const channel = supabase.channel(marketplaceThreadChannel(conversationId), {
    config: { private: true },
  })
  channel.on("broadcast", { event: MARKETPLACE_THREAD_MESSAGE_EVENT }, ({ payload }) => {
    const parsed = marketplaceThreadBroadcastMessageSchema.safeParse(payload)
    if (!parsed.success || parsed.data.conversation_id !== conversationId) return
    schedule()
  })
  channel.on("broadcast", { event: MARKETPLACE_THREAD_REFRESH_EVENT }, ({ payload }) => {
    const parsed = marketplaceThreadRefreshSchema.safeParse(payload)
    if (!parsed.success || parsed.data.conversation_id !== conversationId) return
    schedule()
  })

  const fallback = supabase
    .channel(`thread-live:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      schedule,
    )

  void authorize(supabase, accessToken).then((ok) => {
    if (!active || !ok) return
    channel.subscribe()
    fallback.subscribe()
  })

  return () => {
    active = false
    if (timer) clearTimeout(timer)
    void supabase.removeChannel(channel)
    void supabase.removeChannel(fallback)
  }
}
