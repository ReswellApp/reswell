"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import {
  LIVE_CHAT_BROADCAST_EVENT,
  liveChatSessionChannel,
  type LiveChatBroadcastEvent,
} from "@/lib/live-chat/realtime-channels"
import { mergeIncomingLiveChatUiMessage } from "@/lib/live-chat/merge-messages"

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
  return mergeIncomingLiveChatUiMessage(prev, incoming)
}

type LiveChatBroadcastListener = (event: LiveChatBroadcastEvent) => void

type LiveChatSessionFanout = {
  channel: RealtimeChannel
  listeners: Set<LiveChatBroadcastListener>
}

const sessionFanouts = new Map<string, LiveChatSessionFanout>()

/**
 * One Realtime topic per session. Typing and message hooks used to each
 * `removeChannel` the same name, which silently killed the LLM-reply listener.
 */
function subscribeLiveChatBroadcast(
  supabase: SupabaseClient,
  sessionId: string,
  listener: LiveChatBroadcastListener,
): () => void {
  const topic = liveChatSessionChannel(sessionId)
  let fanout = sessionFanouts.get(topic)
  if (!fanout) {
    const listeners = new Set<LiveChatBroadcastListener>()
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: LIVE_CHAT_BROADCAST_EVENT }, (payload) => {
        const event = payload.payload as LiveChatBroadcastEvent | undefined
        if (!event) return
        for (const next of listeners) next(event)
      })
      .subscribe()
    fanout = { channel, listeners }
    sessionFanouts.set(topic, fanout)
  }
  fanout.listeners.add(listener)
  return () => {
    const current = sessionFanouts.get(topic)
    if (!current) return
    current.listeners.delete(listener)
    if (current.listeners.size > 0) return
    sessionFanouts.delete(topic)
    void supabase.removeChannel(current.channel)
  }
}

/** Subscribe-only. Message fanout is published by the server after auth. */
export function useLiveChatSessionRealtime(
  sessionId: string | null,
  enabled: boolean,
  onRemoteMessage?: (message: LiveChatUiMessage) => void,
  onSessionStatus?: (status: "resolved" | "closed") => void,
) {
  const supabase = useMemo(() => createClient(), [])
  const onRemoteMessageRef = useRef(onRemoteMessage)
  const onSessionStatusRef = useRef(onSessionStatus)
  onRemoteMessageRef.current = onRemoteMessage
  onSessionStatusRef.current = onSessionStatus

  useEffect(() => {
    if (!sessionId || !enabled) return

    return subscribeLiveChatBroadcast(supabase, sessionId, (event) => {
      if (event.type === "session") {
        onSessionStatusRef.current?.(event.status)
        return
      }
      if (event.type !== "message") return
      const msg = event.message
      onRemoteMessageRef.current?.({
        id: msg.id,
        sender_type: msg.sender_type,
        content: msg.content,
        created_at: msg.created_at,
        agent_display_name: msg.agent_display_name ?? null,
        sender_agent_id: msg.sender_agent_id ?? null,
      })
    })
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
  composerUnlockToken?: string | null
}) {
  const {
    sessionId,
    publicId,
    enabled,
    watchParticipantType,
    participantType,
    displayName,
    visitorToken,
    composerUnlockToken,
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
            composer_unlock_token: composerUnlockToken || undefined,
          }),
        })
      } catch {
        /* typing is best-effort */
      }
    },
    [composerUnlockToken, displayName, enabled, participantType, publicId, visitorToken],
  )

  useEffect(() => {
    if (!sessionId || !enabled) return

    const unsubscribe = subscribeLiveChatBroadcast(supabase, sessionId, (event) => {
      if (event.type !== "typing") return
      if (event.participant_type !== watchParticipantType) return
      if (!event.is_typing) {
        setTypingName(null)
        return
      }
      setTypingName(`${event.display_name} is typing…`)
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      clearTimerRef.current = setTimeout(() => setTypingName(null), 2800)
    })

    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      unsubscribe()
    }
  }, [enabled, sessionId, supabase, watchParticipantType])

  return { typingName, publishTyping }
}
