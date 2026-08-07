"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import {
  getOrCreateLiveChatVisitorToken,
  getStoredLiveChatSessionPublicId,
  setStoredLiveChatSessionPublicId,
} from "@/lib/live-chat/visitor-storage"
import type { LiveChatUiMessage } from "@/components/features/live-chat/hooks/use-live-chat-realtime"

const VISITOR_DISPLAY_NAME = "Guest"

type PendingSend = {
  content: string
  email: string | null | undefined
  optimisticId: string
}

function mapApiMessages(
  rows: Array<{
    id: string
    sender_type: "visitor" | "agent" | "system"
    content: string
    created_at: string
    agent_display_name?: string | null
  }>,
): LiveChatUiMessage[] {
  return rows.map((row) => ({
    id: row.id,
    sender_type: row.sender_type,
    content: row.content,
    created_at: row.created_at,
    agent_display_name: row.agent_display_name ?? null,
  }))
}

function sortMessages(messages: LiveChatUiMessage[]): LiveChatUiMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

export function useLiveChatSession(options?: {
  onVisitorMessageConfirmed?: (message: LiveChatUiMessage) => void
}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [publicId, setPublicId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveChatUiMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, startBootstrap] = useTransition()
  const [sending, setSending] = useState(false)

  const visitorTokenRef = useRef<string>("")
  const pendingSendRef = useRef<PendingSend | null>(null)
  const publicIdRef = useRef<string | null>(null)
  const sessionReadyRef = useRef(false)
  const onConfirmedRef = useRef(options?.onVisitorMessageConfirmed)
  onConfirmedRef.current = options?.onVisitorMessageConfirmed

  if (!visitorTokenRef.current && typeof window !== "undefined") {
    visitorTokenRef.current = getOrCreateLiveChatVisitorToken()
  }

  const sessionReady = Boolean(sessionId && publicId)
  sessionReadyRef.current = sessionReady
  publicIdRef.current = publicId

  const hasHumanConversation = messages.some((m) => m.sender_type === "visitor" || m.sender_type === "agent")

  const bootstrapSession = useCallback(() => {
    return new Promise<{ ok: boolean; hasHumanConversation: boolean }>((resolve) => {
      startBootstrap(async () => {
        setError(null)
        const token = visitorTokenRef.current || getOrCreateLiveChatVisitorToken()
        visitorTokenRef.current = token
        const resumePublicId = getStoredLiveChatSessionPublicId()

        try {
          const res = await fetch("/api/live-chat/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              visitor_token: token,
              visitor_name: VISITOR_DISPLAY_NAME,
              resume_public_id: resumePublicId ?? undefined,
            }),
          })
          const json = (await res.json()) as {
            data?: {
              session: { id: string; public_id: string; visitor_name: string }
              messages: Array<{
                id: string
                sender_type: "visitor" | "agent" | "system"
                content: string
                created_at: string
              }>
            }
            error?: string
          }

          if (!res.ok || !json.data) {
            setError(json.error ?? "Could not start chat")
            resolve({ ok: false, hasHumanConversation: false })
            return
          }

          const mapped = mapApiMessages(json.data.messages)
          setStoredLiveChatSessionPublicId(json.data.session.public_id)
          setSessionId(json.data.session.id)
          setPublicId(json.data.session.public_id)
          setMessages((prev) => {
            const pending = prev.filter((m) => m.pending)
            const merged = [...mapped]
            for (const p of pending) {
              if (!merged.some((m) => m.id === p.id)) merged.push(p)
            }
            return sortMessages(merged)
          })
          const hasHuman = mapped.some((m) => m.sender_type === "visitor" || m.sender_type === "agent")
          resolve({ ok: true, hasHumanConversation: hasHuman })
        } catch {
          setError("Could not start chat. Check your connection and try again.")
          resolve({ ok: false, hasHumanConversation: false })
        }
      })
    })
  }, [])

  const appendMessage = useCallback((message: LiveChatUiMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev
      return sortMessages([...prev, message])
    })
  }, [])

  const replaceMessage = useCallback((optimisticId: string, confirmed: LiveChatUiMessage) => {
    setMessages((prev) =>
      sortMessages(prev.map((m) => (m.id === optimisticId ? { ...confirmed, pending: false } : m))),
    )
  }, [])

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }, [])

  const postMessage = useCallback(
    async (
      trimmed: string,
      visitorEmail: string | null | undefined,
      optimisticId: string,
    ): Promise<LiveChatUiMessage | null> => {
      const activePublicId = publicIdRef.current
      if (!activePublicId) return null

      try {
        const res = await fetch(`/api/live-chat/session/${encodeURIComponent(activePublicId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitor_token: visitorTokenRef.current,
            content: trimmed,
            visitor_name: VISITOR_DISPLAY_NAME,
            visitor_email: visitorEmail?.trim() || undefined,
          }),
        })
        const json = (await res.json()) as {
          data?: { message: LiveChatUiMessage; session_id: string }
          error?: string
        }

        if (!res.ok || !json.data) {
          setError(json.error ?? "Could not send message")
          removeMessage(optimisticId)
          return null
        }

        const ui: LiveChatUiMessage = {
          id: json.data.message.id,
          sender_type: "visitor",
          content: json.data.message.content,
          created_at: json.data.message.created_at,
          pending: false,
        }
        replaceMessage(optimisticId, ui)
        onConfirmedRef.current?.(ui)
        return ui
      } catch {
        setError("Could not send message")
        removeMessage(optimisticId)
        return null
      }
    },
    [removeMessage, replaceMessage],
  )

  const flushPendingSend = useCallback(async () => {
    const pending = pendingSendRef.current
    if (!pending || !sessionReadyRef.current) return
    pendingSendRef.current = null
    setSending(true)
    setError(null)
    const result = await postMessage(pending.content, pending.email, pending.optimisticId)
    setSending(false)
    return result
  }, [postMessage])

  useEffect(() => {
    if (!sessionReady || !pendingSendRef.current) return
    void flushPendingSend()
  }, [sessionReady, flushPendingSend])

  const sendMessage = useCallback(
    async (content: string, visitorEmail?: string | null): Promise<LiveChatUiMessage | null> => {
      const trimmed = content.trim()
      if (!trimmed || sending) return null

      const optimisticId = `pending-${crypto.randomUUID()}`
      const optimistic: LiveChatUiMessage = {
        id: optimisticId,
        sender_type: "visitor",
        content: trimmed,
        created_at: new Date().toISOString(),
        pending: true,
      }

      appendMessage(optimistic)
      setError(null)

      if (!sessionReadyRef.current || !publicIdRef.current) {
        pendingSendRef.current = { content: trimmed, email: visitorEmail, optimisticId }
        return optimistic
      }

      setSending(true)
      const result = await postMessage(trimmed, visitorEmail, optimisticId)
      setSending(false)
      return result ?? optimistic
    },
    [appendMessage, postMessage, sending],
  )

  return {
    sessionId,
    publicId,
    messages,
    error,
    setError,
    bootstrapping,
    sending,
    sessionReady,
    hasHumanConversation,
    bootstrapSession,
    appendMessage,
    sendMessage,
    visitorToken: visitorTokenRef.current,
    visitorDisplayName: VISITOR_DISPLAY_NAME,
  }
}
