"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  liveChatSessionChannel,
  type LiveChatBroadcastEvent,
} from "@/lib/live-chat/realtime-channels"

export type LiveChatUiMessage = {
  id: string
  sender_type: "visitor" | "agent" | "system" | "bot"
  content: string
  created_at: string
  agent_display_name?: string | null
  sender_agent_id?: string | null
  /** Optimistic outgoing message — replaced when the server confirms. */
  pending?: boolean
}

function mergeMessages(prev: LiveChatUiMessage[], incoming: LiveChatUiMessage): LiveChatUiMessage[] {
  if (prev.some((m) => m.id === incoming.id)) return prev
  return [...prev, incoming].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

/** Subscribe-only. Message fanout is published by the server after auth. */
export function useLiveChatSessionRealtime(
  sessionId: string | null,
  enabled: boolean,
  onRemoteMessage?: (message: LiveChatUiMessage) => void,
) {
  const supabase = useMemo(() => createClient(), [])
  const onRemoteMessageRef = useRef(onRemoteMessage)
  onRemoteMessageRef.current = onRemoteMessage

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
          sender_agent_id: msg.sender_agent_id ?? null,
        }
        onRemoteMessageRef.current?.(ui)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, sessionId, supabase])
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

export function useLiveChatTyping(options: {
  sessionId: string | null
  publicId: string | null
  enabled: boolean
  watchParticipantType: "visitor" | "agent"
  participantType: "visitor" | "agent"
  displayName: string
  visitorToken?: string | null
}) {
  const {
    sessionId,
    publicId,
    enabled,
    watchParticipantType,
    participantType,
    displayName,
    visitorToken,
  } = options
  const supabase = useMemo(() => createClient(), [])
  const [typingName, setTypingName] = useState<string | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const publishTyping = useCallback(
    async (isTyping: boolean) => {
      if (!publicId || !enabled) return
      try {
        await fetch(`/api/live-chat/session/${encodeURIComponent(publicId)}/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitor_token: visitorToken || undefined,
            participant_type: participantType,
            display_name: displayName,
            is_typing: isTyping,
          }),
        })
      } catch {
        /* typing is best-effort */
      }
    },
    [displayName, enabled, participantType, publicId, visitorToken],
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
