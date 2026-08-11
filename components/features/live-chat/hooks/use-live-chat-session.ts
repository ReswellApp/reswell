"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import {
  clearLiveChatBrowserState,
  getOrCreateLiveChatVisitorToken,
  getStoredLiveChatSessionPublicId,
  setStoredLiveChatSessionPublicId,
} from "@/lib/live-chat/visitor-storage"
import type { LiveChatUiMessage } from "@/components/features/live-chat/hooks/use-live-chat-realtime"
import type { LiveChatAiIntent } from "@/lib/validations/liveChatAi"

const VISITOR_DISPLAY_NAME = "Guest"

type PendingSend = {
  content: string
  email: string | null | undefined
  optimisticId: string
}

type ThreadModeHint = "ai" | "human" | "none"

function mapApiMessages(
  rows: Array<{
    id: string
    sender_type: "visitor" | "agent" | "system" | "bot"
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

function inferThreadMode(messages: LiveChatUiMessage[]): ThreadModeHint {
  const hasAgent = messages.some((m) => m.sender_type === "agent")
  if (hasAgent) return "human"

  const thread = messages.filter(
    (m) => m.sender_type === "visitor" || m.sender_type === "bot" || m.sender_type === "agent",
  )
  const firstVisitorIdx = thread.findIndex((m) => m.sender_type === "visitor")
  const firstBotIdx = thread.findIndex((m) => m.sender_type === "bot")
  const hasVisitor = firstVisitorIdx >= 0
  const hasBot = firstBotIdx >= 0

  // AI threads usually start with a bot welcome before the visitor types.
  // Offline human-queue assist is the opposite: visitor first, then bot — stay human
  // so the guest email field does not vanish after an assist reply.
  if (hasBot && hasVisitor) {
    return firstBotIdx < firstVisitorIdx ? "ai" : "human"
  }
  if (hasBot) return "ai"
  if (hasVisitor) return "human"
  return "none"
}

function toUiMessage(
  row: {
    id: string
    sender_type: "visitor" | "agent" | "system" | "bot"
    content: string
    created_at: string
    agent_display_name?: string | null
  },
): LiveChatUiMessage {
  return {
    id: row.id,
    sender_type: row.sender_type,
    content: row.content,
    created_at: row.created_at,
    agent_display_name:
      row.sender_type === "bot" ? "Reswell AI" : (row.agent_display_name ?? null),
    pending: false,
  }
}

export function useLiveChatSession(options?: {
  onVisitorMessageConfirmed?: (message: LiveChatUiMessage) => void
  onRemoteWorthyMessage?: (message: LiveChatUiMessage) => void
}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [publicId, setPublicId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveChatUiMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, startBootstrap] = useTransition()
  const [sending, setSending] = useState(false)
  /** True while Reswell AI is generating a reply (separate from visitor send). */
  const [aiThinking, setAiThinking] = useState(false)

  const visitorTokenRef = useRef<string>("")
  const pendingSendRef = useRef<PendingSend | null>(null)
  const publicIdRef = useRef<string | null>(null)
  const sessionReadyRef = useRef(false)
  const onConfirmedRef = useRef(options?.onVisitorMessageConfirmed)
  const onRemoteWorthyRef = useRef(options?.onRemoteWorthyMessage)
  onConfirmedRef.current = options?.onVisitorMessageConfirmed
  onRemoteWorthyRef.current = options?.onRemoteWorthyMessage

  if (!visitorTokenRef.current && typeof window !== "undefined") {
    visitorTokenRef.current = getOrCreateLiveChatVisitorToken()
  }

  const sessionReady = Boolean(sessionId && publicId)
  sessionReadyRef.current = sessionReady
  publicIdRef.current = publicId

  const hasPersistedThread = messages.some(
    (m) =>
      m.sender_type === "visitor" || m.sender_type === "agent" || m.sender_type === "bot",
  )
  const threadModeHint = inferThreadMode(messages)

  const bootstrapSession = useCallback(() => {
    return new Promise<{
      ok: boolean
      hasPersistedThread: boolean
      threadModeHint: ThreadModeHint
    }>((resolve) => {
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
                sender_type: "visitor" | "agent" | "system" | "bot"
                content: string
                created_at: string
                agent_display_name?: string | null
              }>
            }
            error?: string
          }

          if (!res.ok || !json.data) {
            setError(json.error ?? "Could not start chat")
            resolve({ ok: false, hasPersistedThread: false, threadModeHint: "none" })
            return
          }

          const mapped = mapApiMessages(json.data.messages).map((m) =>
            m.sender_type === "bot"
              ? { ...m, agent_display_name: m.agent_display_name ?? "Reswell AI" }
              : m,
          )
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
          const hint = inferThreadMode(mapped)
          resolve({
            ok: true,
            hasPersistedThread: hint !== "none",
            threadModeHint: hint,
          })
        } catch {
          setError("Could not start chat. Check your connection and try again.")
          resolve({ ok: false, hasPersistedThread: false, threadModeHint: "none" })
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

  const callAi = useCallback(
    async (options: {
      intent: LiveChatAiIntent
      content?: string
      agentsOnline?: boolean
      optimisticId?: string
    }): Promise<{
      ok: boolean
      handoff: boolean
      aiMode: "active" | "off" | null
    }> => {
      const activePublicId = publicIdRef.current
      if (!activePublicId) {
        setError("Chat session not ready")
        return { ok: false, handoff: false, aiMode: null }
      }

      const awaitsBotReply =
        options.intent === "activate" ||
        options.intent === "chat" ||
        options.intent === "offline_assist"
      if (awaitsBotReply) setAiThinking(true)
      setSending(true)
      setError(null)
      try {
        const res = await fetch(`/api/live-chat/session/${encodeURIComponent(activePublicId)}/ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitor_token: visitorTokenRef.current,
            intent: options.intent,
            content: options.content,
            agents_online: options.agentsOnline,
          }),
        })
        const json = (await res.json()) as {
          data?: {
            visitor_message: {
              id: string
              sender_type: "visitor"
              content: string
              created_at: string
            } | null
            bot_message: {
              id: string
              sender_type: "bot"
              content: string
              created_at: string
            } | null
            system_message: {
              id: string
              sender_type: "system"
              content: string
              created_at: string
            } | null
            ai_mode: "active" | "off"
            handoff: boolean
          }
          error?: string
        }

        if (!res.ok || !json.data) {
          if (options.optimisticId) removeMessage(options.optimisticId)
          if (options.intent === "offline_assist" && (res.status === 409 || res.status === 503)) {
            setSending(false)
            setAiThinking(false)
            return { ok: false, handoff: false, aiMode: null }
          }
          setError(json.error ?? "Could not reach Reswell AI")
          setSending(false)
          setAiThinking(false)
          return { ok: false, handoff: false, aiMode: null }
        }

        if (options.optimisticId && json.data.visitor_message) {
          replaceMessage(options.optimisticId, toUiMessage(json.data.visitor_message))
          onConfirmedRef.current?.(toUiMessage(json.data.visitor_message))
        } else if (json.data.visitor_message) {
          const ui = toUiMessage(json.data.visitor_message)
          appendMessage(ui)
          onConfirmedRef.current?.(ui)
        }

        if (json.data.bot_message) {
          const botUi = toUiMessage(json.data.bot_message)
          appendMessage(botUi)
          onRemoteWorthyRef.current?.(botUi)
        }
        if (json.data.system_message) {
          appendMessage(toUiMessage(json.data.system_message))
        }

        setSending(false)
        setAiThinking(false)
        return {
          ok: true,
          handoff: json.data.handoff,
          aiMode: json.data.ai_mode,
        }
      } catch {
        if (options.optimisticId) removeMessage(options.optimisticId)
        if (options.intent !== "offline_assist") {
          setError("Could not reach Reswell AI")
        }
        setSending(false)
        setAiThinking(false)
        return { ok: false, handoff: false, aiMode: null }
      }
    },
    [appendMessage, removeMessage, replaceMessage],
  )

  const activateAi = useCallback(
    async (firstMessage?: string) => {
      if (!sessionReadyRef.current) {
        const boot = await bootstrapSession()
        if (!boot.ok) return { ok: false as const, handoff: false }
      }
      return callAi({ intent: "activate", content: firstMessage })
    },
    [bootstrapSession, callAi],
  )

  const sendAiMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || sending || aiThinking) return { ok: false as const, handoff: false }

      if (!sessionReadyRef.current) {
        const boot = await bootstrapSession()
        if (!boot.ok) return { ok: false as const, handoff: false }
      }

      const optimisticId = `pending-${crypto.randomUUID()}`
      setAiThinking(true)
      appendMessage({
        id: optimisticId,
        sender_type: "visitor",
        content: trimmed,
        created_at: new Date().toISOString(),
        pending: true,
      })

      return callAi({ intent: "chat", content: trimmed, optimisticId })
    },
    [aiThinking, appendMessage, bootstrapSession, callAi, sending],
  )

  const requestAiHandoff = useCallback(async () => {
    if (!sessionReadyRef.current) {
      const boot = await bootstrapSession()
      if (!boot.ok) return { ok: false as const }
    }
    return callAi({ intent: "handoff" })
  }, [bootstrapSession, callAi])

  const requestOfflineAiAssist = useCallback(
    async (content: string, agentsOnline: boolean) => {
      if (agentsOnline) return { ok: false as const }
      if (!sessionReadyRef.current) return { ok: false as const }
      // Show typing immediately — before the visitor send path clears `sending`.
      setAiThinking(true)
      return callAi({ intent: "offline_assist", content, agentsOnline: false })
    },
    [callAi],
  )

  const resetLocalSession = useCallback(() => {
    clearLiveChatBrowserState()
    visitorTokenRef.current = getOrCreateLiveChatVisitorToken()
    pendingSendRef.current = null
    setSessionId(null)
    setPublicId(null)
    setMessages([])
    setError(null)
    setSending(false)
    setAiThinking(false)
  }, [])

  return {
    sessionId,
    publicId,
    messages,
    error,
    setError,
    bootstrapping,
    sending,
    aiThinking,
    sessionReady,
    hasPersistedThread,
    /** @deprecated use hasPersistedThread / threadModeHint */
    hasHumanConversation: hasPersistedThread,
    threadModeHint,
    bootstrapSession,
    appendMessage,
    sendMessage,
    activateAi,
    sendAiMessage,
    requestAiHandoff,
    requestOfflineAiAssist,
    resetLocalSession,
    visitorToken: visitorTokenRef.current,
    visitorDisplayName: VISITOR_DISPLAY_NAME,
  }
}
