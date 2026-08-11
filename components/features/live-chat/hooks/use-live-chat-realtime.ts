"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  liveChatSessionChannel,
  type LiveChatBroadcastEvent,
  type LiveChatBroadcastMessage,
} from "@/lib/live-chat/realtime-channels"

export type LiveChatUiMessage = {
  id: string
  sender_type: "visitor" | "agent" | "system" | "bot"
  content: string
  created_at: string
  agent_display_name?: string | null
  /** Optimistic outgoing message — replaced when the server confirms. */
  pending?: boolean
}

function mergeMessages(prev: LiveChatUiMessage[], incoming: LiveChatUiMessage): LiveChatUiMessage[] {
  if (prev.some((m) => m.id === incoming.id)) return prev
  return [...prev, incoming].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

export function useLiveChatSessionRealtime(
  sessionId: string | null,
  enabled: boolean,
  onRemoteMessage?: (message: LiveChatUiMessage) => void,
) {
  const supabase = useMemo(() => createClient(), [])
  const onRemoteMessageRef = useRef(onRemoteMessage)
  onRemoteMessageRef.current = onRemoteMessage

  const broadcastMessage = useCallback(
    async (message: LiveChatUiMessage) => {
      if (!sessionId || !enabled) return
      const channel = supabase.channel(liveChatSessionChannel(sessionId))
      const payload: LiveChatBroadcastMessage = {
        type: "message",
        message: {
          id: message.id,
          session_id: sessionId,
          sender_type: message.sender_type,
          sender_agent_id: null,
          content: message.content,
          created_at: message.created_at,
          agent_display_name: message.agent_display_name ?? null,
        },
      }
      await channel.subscribe()
      await channel.send({
        type: "broadcast",
        event: "live_chat",
        payload,
      })
      void supabase.removeChannel(channel)
    },
    [enabled, sessionId, supabase],
  )

  useEffect(() => {
    if (!sessionId || !enabled) return

    const channel = supabase
      .channel(liveChatSessionChannel(sessionId))
      .on("broadcast", { event: "live_chat" }, (payload) => {
        const event = payload.payload as LiveChatBroadcastEvent | undefined
        if (!event || event.type !== "message") return
        const msg = event.message
        const ui: LiveChatUiMessage = {
          id: msg.id,
          sender_type: msg.sender_type,
          content: msg.content,
          created_at: msg.created_at,
          agent_display_name: msg.agent_display_name ?? null,
        }
        onRemoteMessageRef.current?.(ui)
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const ui: LiveChatUiMessage = {
            id: String(row.id),
            sender_type: row.sender_type as LiveChatUiMessage["sender_type"],
            content: String(row.content ?? ""),
            created_at: String(row.created_at ?? new Date().toISOString()),
          }
          onRemoteMessageRef.current?.(ui)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, sessionId, supabase])

  return { broadcastMessage }
}

export function useLiveChatMessageList(initial: LiveChatUiMessage[] = []) {
  const [messages, setMessages] = useState<LiveChatUiMessage[]>(initial)

  const appendMessage = useCallback((message: LiveChatUiMessage) => {
    setMessages((prev) => mergeMessages(prev, message))
  }, [])

  const replaceAll = useCallback((next: LiveChatUiMessage[]) => {
    setMessages(next)
  }, [])

  return { messages, appendMessage, replaceAll }
}

export function useLiveChatTyping(
  sessionId: string | null,
  enabled: boolean,
  watchParticipantType: "visitor" | "agent" = "agent",
) {
  const supabase = useMemo(() => createClient(), [])
  const [typingName, setTypingName] = useState<string | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const publishTyping = useCallback(
    async (participantType: "visitor" | "agent", displayName: string, isTyping: boolean) => {
      if (!sessionId || !enabled) return
      const channel = supabase.channel(liveChatSessionChannel(sessionId))
      await channel.subscribe()
      await channel.send({
        type: "broadcast",
        event: "live_chat",
        payload: {
          type: "typing",
          participant_type: participantType,
          display_name: displayName,
          is_typing: isTyping,
        },
      })
      void supabase.removeChannel(channel)
    },
    [enabled, sessionId, supabase],
  )

  useEffect(() => {
    if (!sessionId || !enabled) return

    const channel = supabase
      .channel(liveChatSessionChannel(sessionId))
      .on("broadcast", { event: "live_chat" }, (payload) => {
        const event = payload.payload as LiveChatBroadcastEvent | undefined
        if (!event || event.type !== "typing") return
        if (event.participant_type !== watchParticipantType) return
        if (!event.is_typing) {
          setTypingName(null)
          return
        }
        setTypingName(`${event.display_name} is typing…`)
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
        clearTimerRef.current = setTimeout(() => setTypingName(null), 2800)
      })
      .subscribe()

    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [enabled, sessionId, supabase, watchParticipantType])

  return { typingName, publishTyping }
}
