"use client"

import { useEffect, useRef } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  MARKETPLACE_THREAD_REFRESH_EVENT,
  marketplaceThreadBroadcastMessageSchema,
  marketplaceThreadChannel,
  marketplaceThreadRefreshSchema,
} from "@/lib/messages/thread-broadcast"

const RELOAD_DEBOUNCE_MS = 200

export interface RealtimeThreadMessage {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_read?: boolean
  offer_id?: string | null
  metadata?: unknown
}

interface UseConversationThreadLiveOptions {
  conversationId: string
  currentUserId: string | null
  onMessageInsert: (message: RealtimeThreadMessage) => void
  /** Conversation, unread badge, focus, or a missed insert — reload the thread. */
  onThreadChanged: () => void
}

/**
 * The saved message is broadcast by the server onto this conversation's private
 * channel, and the open thread appends that one bubble. A full reload runs when
 * the thread opens, when the tab regains focus, and while the broadcast channel
 * is down (then the profile counter and conversation row are the backup).
 */
export function useConversationThreadLive({
  conversationId,
  currentUserId,
  onMessageInsert,
  onThreadChanged,
}: UseConversationThreadLiveOptions): void {
  const supabase = createClient()
  const onMessageInsertRef = useRef(onMessageInsert)
  const onThreadChangedRef = useRef(onThreadChanged)
  onMessageInsertRef.current = onMessageInsert
  onThreadChangedRef.current = onThreadChanged

  useEffect(() => {
    let active = true
    let reloadTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleReload = () => {
      if (!active) return
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        if (!active) return
        onThreadChangedRef.current()
      }, RELOAD_DEBOUNCE_MS)
    }

    let broadcastReady = false
    const reloadIfBroadcastDown = () => {
      if (broadcastReady) return
      scheduleReload()
    }

    const channel = supabase.channel(marketplaceThreadChannel(conversationId), {
      config: { private: true },
    })

    channel.on("broadcast", { event: MARKETPLACE_THREAD_MESSAGE_EVENT }, ({ payload }) => {
      const parsed = marketplaceThreadBroadcastMessageSchema.safeParse(payload)
      if (!parsed.success || parsed.data.conversation_id !== conversationId) {
        // A private payload we cannot append is still a signal that the thread moved.
        scheduleReload()
        return
      }
      onMessageInsertRef.current({
        id: parsed.data.id,
        content: parsed.data.content,
        sender_id: parsed.data.sender_id,
        created_at: parsed.data.created_at,
        is_read: parsed.data.is_read ?? false,
        offer_id: parsed.data.offer_id ?? null,
        metadata: parsed.data.metadata,
      })
    })

    channel.on("broadcast", { event: MARKETPLACE_THREAD_REFRESH_EVENT }, ({ payload }) => {
      const parsed = marketplaceThreadRefreshSchema.safeParse(payload)
      if (!parsed.success || parsed.data.conversation_id !== conversationId) return
      scheduleReload()
    })

    // Separate from the private broadcast so a failed authorization does not
    // also drop the profile/conversation backup.
    const fallback = supabase.channel(`thread-live:${conversationId}`)
    fallback.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        // The private broadcast is the steady path. The WAL event is only used
        // while that channel is down, so one message cannot move the badge twice.
        if (broadcastReady) return
        const message = realtimeThreadMessage(payload.new)
        if (!message) {
          scheduleReload()
          return
        }
        onMessageInsertRef.current(message)
      },
    )
    fallback.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `id=eq.${conversationId}`,
      },
      reloadIfBroadcastDown,
    )
    if (currentUserId) {
      fallback.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${currentUserId}`,
        },
        (payload) => {
          if (!unreadCountChanged(payload.old, payload.new)) return
          reloadIfBroadcastDown()
        },
      )
    }
    fallback.subscribe()

    void attachRealtimeAuth(supabase).finally(() => {
      if (!active) return
      channel.subscribe((status) => {
        if (!active) return
        if (status === "SUBSCRIBED") {
          broadcastReady = true
          // Catch messages published while auth and subscribe were still in flight.
          scheduleReload()
          return
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          broadcastReady = false
          scheduleReload()
        }
      })
    })

    // The client router keeps this page for several minutes. Pull a fresh
    // thread on open so a cached snapshot cannot sit behind the live ticker.
    scheduleReload()

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleReload()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token
      if (!token) return
      void supabase.realtime.setAuth(token)
    })

    return () => {
      active = false
      if (reloadTimer) clearTimeout(reloadTimer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      subscription.unsubscribe()
      void supabase.removeChannel(channel)
      void supabase.removeChannel(fallback)
    }
  }, [conversationId, currentUserId, supabase])
}

async function attachRealtimeAuth(supabase: SupabaseClient): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await supabase.realtime.setAuth(token)
  } catch {
    // Public profile updates still arrive. The thread reloads from those.
  }
}

function unreadCountChanged(previous: unknown, next: unknown): boolean {
  if (!next || typeof next !== "object") return false
  const nextCount = (next as { unread_message_count?: unknown }).unread_message_count
  if (typeof nextCount !== "number") return false
  const previousCount =
    previous && typeof previous === "object"
      ? (previous as { unread_message_count?: unknown }).unread_message_count
      : undefined
  return previousCount !== nextCount
}

export function realtimeThreadMessage(value: unknown): RealtimeThreadMessage | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== "string" || row.id.length === 0) return null
  if (typeof row.content !== "string") return null
  if (typeof row.sender_id !== "string" || row.sender_id.length === 0) return null
  if (typeof row.created_at !== "string" || row.created_at.length === 0) return null
  return {
    id: row.id,
    content: row.content,
    sender_id: row.sender_id,
    created_at: row.created_at,
    is_read: typeof row.is_read === "boolean" ? row.is_read : undefined,
    offer_id: typeof row.offer_id === "string" ? row.offer_id : null,
    metadata: row.metadata,
  }
}
