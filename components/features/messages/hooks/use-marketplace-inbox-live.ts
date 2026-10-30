"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { getActiveMarketplaceThread } from "@/lib/messages/active-thread"
import {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  MARKETPLACE_THREAD_REFRESH_EVENT,
  marketplaceInboxChannel,
  marketplaceThreadBroadcastMessageSchema,
  marketplaceThreadRefreshSchema,
} from "@/lib/messages/thread-broadcast"
import { authorizeRealtime } from "@/lib/supabase/realtime-auth"
import { inboxActivityFromMessageRow } from "@/lib/utils/messages-inbox-grouping"
import {
  dispatchConversationInboxActivity,
  dispatchMarketplaceLiveMessage,
  dispatchMessagesInboxRefresh,
  dispatchUnreadCountRefresh,
} from "@/lib/utils/unread-message-count-events"

/**
 * One private channel per signed-in person. A new message moves the inbox row
 * immediately and reconciles the header ticker, including while another page is open.
 */
export function useMarketplaceInboxLive(userId: string | null): void {
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    let active = true
    let unreadTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleUnreadRefresh = (conversationId: string) => {
      if (getActiveMarketplaceThread() === conversationId) return
      if (unreadTimer) clearTimeout(unreadTimer)
      unreadTimer = setTimeout(() => {
        unreadTimer = null
        if (!active) return
        dispatchUnreadCountRefresh()
      }, 60)
    }

    const channel = supabase.channel(marketplaceInboxChannel(userId), {
      config: { private: true },
    })

    channel.on("broadcast", { event: MARKETPLACE_THREAD_MESSAGE_EVENT }, ({ payload }) => {
      const parsed = marketplaceThreadBroadcastMessageSchema.safeParse(payload)
      if (!parsed.success) return
      dispatchMarketplaceLiveMessage(parsed.data)
      const activity = inboxActivityFromMessageRow(parsed.data)
      if (activity) dispatchConversationInboxActivity(activity)
      dispatchMessagesInboxRefresh()
      scheduleUnreadRefresh(parsed.data.conversation_id)
    })

    channel.on("broadcast", { event: MARKETPLACE_THREAD_REFRESH_EVENT }, ({ payload }) => {
      const parsed = marketplaceThreadRefreshSchema.safeParse(payload)
      if (!parsed.success) return
      dispatchMessagesInboxRefresh()
      scheduleUnreadRefresh(parsed.data.conversation_id)
    })

    let subscribed = false
    let starting = false
    let retry = false
    const subscribe = () => {
      if (!active || subscribed) return
      if (starting) {
        retry = true
        return
      }
      starting = true
      void authorizeRealtime(supabase).then((ok) => {
        starting = false
        if (!active || subscribed) return
        if (!ok) {
          if (retry) {
            retry = false
            subscribe()
          }
          return
        }
        retry = false
        subscribed = true
        channel.subscribe()
      })
    }
    subscribe()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token
      if (!token) return
      void supabase.realtime.setAuth(token).then(() => {
        if (!active) return
        subscribe()
      })
    })

    return () => {
      active = false
      if (unreadTimer) clearTimeout(unreadTimer)
      subscription.unsubscribe()
      void supabase.removeChannel(channel)
    }
  }, [supabase, userId])
}
