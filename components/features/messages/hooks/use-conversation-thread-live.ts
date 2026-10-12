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
  onMessageInsert: (message: RealtimeThreadMessage) => void
  /** An existing bubble was rewritten, such as an offer. A new chat message does not use this. */
  onThreadChanged: () => void
}

/**
 * Both people in this thread receive the saved message on a private channel and
 * append that one bubble. A normal send or receive never refetches the thread.
 * A refetch runs once when the thread opens (the router can serve a stale page)
 * and when an existing bubble is rewritten, such as an offer update.
 */
export function useConversationThreadLive({
  conversationId,
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

    const appendMessage = (message: RealtimeThreadMessage) => {
      onMessageInsertRef.current(message)
    }

    const channel = supabase.channel(marketplaceThreadChannel(conversationId), {
      config: { private: true },
    })

    channel.on("broadcast", { event: MARKETPLACE_THREAD_MESSAGE_EVENT }, ({ payload }) => {
      const parsed = marketplaceThreadBroadcastMessageSchema.safeParse(payload)
      if (!parsed.success || parsed.data.conversation_id !== conversationId) return
      appendMessage({
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

    // Database insert, same append. Used when the private channel is still
    // connecting. A duplicate of the broadcast is ignored by message id.
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
        const message = realtimeThreadMessage(payload.new)
        if (!message) return
        appendMessage(message)
      },
    )
    fallback.subscribe()

    void attachRealtimeAuth(supabase).finally(() => {
      if (!active) return
      channel.subscribe()
    })

    // The client router keeps this page for several minutes. Pull history once
    // on open. Later messages append; they do not run this again.
    scheduleReload()

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
      subscription.unsubscribe()
      void supabase.removeChannel(channel)
      void supabase.removeChannel(fallback)
    }
  }, [conversationId, supabase])
}

async function attachRealtimeAuth(supabase: SupabaseClient): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await supabase.realtime.setAuth(token)
  } catch {
    // The database insert listener can still append a bubble.
  }
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
