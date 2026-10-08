"use client"

import { useEffect, useRef } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

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
 * The nav ticker follows `profiles.unread_message_count`, which is publicly
 * readable, so that badge moves as soon as a message is stored. `messages`
 * inserts are authorized with a join through `conversations`, and Realtime
 * often drops those events. Reload from the signals that already arrive
 * (profile unread count and the conversation row) so the open thread updates
 * with the ticker.
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

    void attachRealtimeAuth(supabase)

    const channel = supabase.channel(`thread-live:${conversationId}`)

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const message = realtimeThreadMessage(payload.new)
        if (!message) {
          scheduleReload()
          return
        }
        onMessageInsertRef.current(message)
      },
    )

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `id=eq.${conversationId}`,
      },
      () => {
        scheduleReload()
      },
    )

    if (currentUserId) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${currentUserId}`,
        },
        (payload) => {
          if (!unreadCountChanged(payload.old, payload.new)) return
          scheduleReload()
        },
      )
    }

    channel.subscribe((status) => {
      if (!active) return
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") scheduleReload()
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
