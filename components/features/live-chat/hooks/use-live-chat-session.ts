"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import {
  clearLiveChatBrowserState,
  clearStoredLiveChatSessionPublicId,
  getOrCreateLiveChatVisitorToken,
  getStoredLiveChatSessionPublicId,
  setStoredLiveChatSessionPublicId,
} from "@/lib/live-chat/visitor-storage"
import type { LiveChatUiMessage } from "@/components/features/live-chat/hooks/use-live-chat-realtime"
import type { LiveChatAiIntent } from "@/lib/validations/liveChatAi"
import { isLiveChatSessionClosedPayload } from "@/lib/live-chat/errors"

const VISITOR_DISPLAY_NAME = "Guest"

type PendingSend = {
  content: string
  email: string | null | undefined
  optimisticId: string
}

type ThreadModeHint = "ai" | "human" | "none"

export type LiveChatBootstrapOptions = {
  forceNew?: boolean
  prefer?: "ai" | "human" | "any"
}

function mapApiMessages(
  rows: Array<{
    id: string
    sender_type: "visitor" | "agent" | "system" | "bot"
    content: string
    created_at: string
    agent_display_name?: string | null
    sender_agent_id?: string | null
  }>,
): LiveChatUiMessage[] {
  return rows.map((row) => ({
    id: row.id,
    sender_type: row.sender_type,
    content: row.content,
    created_at: row.created_at,
    agent_display_name: row.agent_display_name ?? null,
    sender_agent_id: row.sender_agent_id ?? null,
  }))
}

function sortMessages(messages: LiveChatUiMessage[]): LiveChatUiMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function mergeIncomingMessage(
  prev: LiveChatUiMessage[],
  incoming: LiveChatUiMessage,
): LiveChatUiMessage[] {
  if (prev.some((message) => message.id === incoming.id)) return prev
  if (incoming.sender_type === "visitor" && !incoming.pending) {
    const pendingIndex = prev.findIndex(
      (message) =>
        message.pending &&
        message.sender_type === "visitor" &&
        message.content === incoming.content,
    )
    if (pendingIndex >= 0) {
      const next = [...prev]
      next[pendingIndex] = { ...incoming, pending: false }
      return sortMessages(next)
    }
  }
  return sortMessages([...prev, incoming])
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
    sender_agent_id?: string | null
  },
): LiveChatUiMessage {
  return {
    id: row.id,
    sender_type: row.sender_type,
    content: row.content,
    created_at: row.created_at,
    agent_display_name:
      row.sender_type === "bot" ? "Reswell AI" : (row.agent_display_name ?? null),
    sender_agent_id: row.sender_agent_id ?? null,
    pending: false,
  }
}

export function useLiveChatSession(options?: {
  onVisitorMessageConfirmed?: (message: LiveChatUiMessage) => void
  onRemoteWorthyMessage?: (message: LiveChatUiMessage) => void
}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [publicId, setPublicId] = useState<string | null>(null)
  const [supportCaseId, setSupportCaseId] = useState<string | null>(null)
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveChatUiMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, startBootstrap] = useTransition()
  const [sending, setSending] = useState(false)
  /** True while Reswell AI is generating a reply (separate from visitor send). */
  const [aiThinking, setAiThinking] = useState(false)

  const [sessionClosed, setSessionClosed] = useState(false)
  const visitorTokenRef = useRef<string>("")
  const pendingSendRef = useRef<PendingSend[]>([])
  const pendingAiRef = useRef<string[]>([])
  const aiInFlightRef = useRef(false)
  const sendAiMessageRef = useRef<(content: string) => Promise<{ ok: boolean; handoff: boolean }>>(
    async () => ({ ok: false, handoff: false }),
  )
  const publicIdRef = useRef<string | null>(null)
  const sessionReadyRef = useRef(false)
  const supportCaseIdRef = useRef<string | null>(null)
  const threadModeHintRef = useRef<ThreadModeHint>("none")
  const flushingPendingRef = useRef(false)
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
  supportCaseIdRef.current = supportCaseId

  const hasPersistedThread = messages.some(
    (m) =>
      m.sender_type === "visitor" || m.sender_type === "agent" || m.sender_type === "bot",
  )
  const threadModeHint = inferThreadMode(messages)
  threadModeHintRef.current = threadModeHint

  const detachThread = useCallback(() => {
    clearStoredLiveChatSessionPublicId()
    pendingSendRef.current = []
    pendingAiRef.current = []
    aiInFlightRef.current = false
    flushingPendingRef.current = false
    publicIdRef.current = null
    sessionReadyRef.current = false
    supportCaseIdRef.current = null
    setSessionId(null)
    setPublicId(null)
    setSupportCaseId(null)
    setAssignedAgentId(null)
    setMessages([])
    setError(null)
    setSending(false)
    setAiThinking(false)
    setSessionClosed(false)
  }, [])

  const bootstrapSession = useCallback((options?: LiveChatBootstrapOptions) => {
    return new Promise<{
      ok: boolean
      hasPersistedThread: boolean
      threadModeHint: ThreadModeHint
    }>((resolve) => {
      startBootstrap(async () => {
        setError(null)
        const token = visitorTokenRef.current || getOrCreateLiveChatVisitorToken()
        visitorTokenRef.current = token
        const resumePublicId = options?.forceNew ? null : getStoredLiveChatSessionPublicId()

        try {
          const res = await fetch("/api/live-chat/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              visitor_token: token,
              visitor_name: VISITOR_DISPLAY_NAME,
              resume_public_id: resumePublicId ?? undefined,
              force_new: options?.forceNew === true ? true : undefined,
              prefer: options?.prefer,
            }),
          })
          const json = (await res.json()) as {
            data?: {
              session: {
                id: string
                public_id: string
                visitor_name: string
                support_case_id?: string | null
                assigned_agent_id?: string | null
              }
              messages: Array<{
                id: string
                sender_type: "visitor" | "agent" | "system" | "bot"
                content: string
                created_at: string
                agent_display_name?: string | null
                sender_agent_id?: string | null
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
          setSessionClosed(false)
          setSessionId(json.data.session.id)
          setPublicId(json.data.session.public_id)
          setSupportCaseId(json.data.session.support_case_id ?? null)
          setAssignedAgentId(json.data.session.assigned_agent_id ?? null)
          publicIdRef.current = json.data.session.public_id
          sessionReadyRef.current = true
          supportCaseIdRef.current = json.data.session.support_case_id ?? null
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
    if (message.sender_type === "agent" && message.sender_agent_id) {
      setAssignedAgentId(message.sender_agent_id)
    }
    setMessages((prev) => mergeIncomingMessage(prev, message))
  }, [])

  const replaceMessage = useCallback((optimisticId: string, confirmed: LiveChatUiMessage) => {
    setMessages((prev) => {
      const next = prev
        .filter((m) => {
          if (m.id === optimisticId || m.id === confirmed.id) return false
          if (
            m.pending &&
            m.sender_type === "visitor" &&
            confirmed.sender_type === "visitor" &&
            m.content === confirmed.content
          ) {
            return false
          }
          return true
        })
        .concat({ ...confirmed, pending: false })
      return sortMessages(next)
    })
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
          data?: {
            message: LiveChatUiMessage
            session_id: string
            support_case_id?: string | null
          }
          error?: string
        }

        if (!res.ok || !json.data) {
          if (isLiveChatSessionClosedPayload(json)) {
            setSessionClosed(true)
            setError(json.error ?? "This chat is closed. Start a new conversation anytime.")
          } else {
            setError(json.error ?? "Could not send message")
          }
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
        if (json.data.support_case_id) {
          setSupportCaseId(json.data.support_case_id)
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
    if (flushingPendingRef.current || !sessionReadyRef.current) return
    flushingPendingRef.current = true
    setSending(true)
    setError(null)
    while (pendingSendRef.current.length > 0 && sessionReadyRef.current) {
      const pending = pendingSendRef.current.shift()
      if (!pending) break
      await postMessage(pending.content, pending.email, pending.optimisticId)
    }
    setSending(false)
    flushingPendingRef.current = false
  }, [postMessage])

  useEffect(() => {
    if (!sessionReady || pendingSendRef.current.length === 0) return
    void flushPendingSend()
  }, [sessionReady, flushPendingSend])

  const sendMessage = useCallback(
    async (content: string, visitorEmail?: string | null): Promise<LiveChatUiMessage | null> => {
      const trimmed = content.trim()
      if (!trimmed) return null

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
        pendingSendRef.current = [
          ...pendingSendRef.current,
          { content: trimmed, email: visitorEmail, optimisticId },
        ]
        return optimistic
      }

      const result = await postMessage(trimmed, visitorEmail, optimisticId)
      return result ?? optimistic
    },
    [appendMessage, postMessage],
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
            support_case_id?: string | null
          }
          error?: string
          code?: string
        }

        if (!res.ok || !json.data) {
          if (options.optimisticId) removeMessage(options.optimisticId)
          if (isLiveChatSessionClosedPayload(json)) {
            setSessionClosed(true)
            setError(json.error ?? "This chat is closed. Start a new conversation anytime.")
            setSending(false)
            setAiThinking(false)
            return { ok: false, handoff: false, aiMode: null }
          }
          if (
            options.intent === "offline_assist" &&
            (res.status === 409 || res.status === 503 || res.status === 500)
          ) {
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
        if (json.data.support_case_id) {
          setSupportCaseId(json.data.support_case_id)
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
      const onHumanThread =
        threadModeHintRef.current === "human" || Boolean(supportCaseIdRef.current)
      if (!sessionReadyRef.current || onHumanThread) {
        if (onHumanThread) detachThread()
        const boot = await bootstrapSession({ prefer: "ai" })
        if (!boot.ok) return { ok: false as const, handoff: false }
      }
      aiInFlightRef.current = true
      try {
        return await callAi({ intent: "activate", content: firstMessage })
      } finally {
        aiInFlightRef.current = false
        const queued = pendingAiRef.current.shift()
        if (queued) void sendAiMessageRef.current(queued)
      }
    },
    [bootstrapSession, callAi, detachThread],
  )

  const sendAiMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return { ok: false as const, handoff: false }

      if (aiInFlightRef.current) {
        pendingAiRef.current.push(trimmed)
        return { ok: true as const, handoff: false }
      }

      if (!sessionReadyRef.current) {
        const boot = await bootstrapSession({ prefer: "ai" })
        if (!boot.ok) return { ok: false as const, handoff: false }
      }

      const optimisticId = `pending-${crypto.randomUUID()}`
      setAiThinking(true)
      aiInFlightRef.current = true
      appendMessage({
        id: optimisticId,
        sender_type: "visitor",
        content: trimmed,
        created_at: new Date().toISOString(),
        pending: true,
      })

      try {
        return await callAi({ intent: "chat", content: trimmed, optimisticId })
      } finally {
        aiInFlightRef.current = false
        const queued = pendingAiRef.current.shift()
        if (queued) void sendAiMessage(queued)
      }
    },
    [appendMessage, bootstrapSession, callAi],
  )
  sendAiMessageRef.current = sendAiMessage

  const requestAiHandoff = useCallback(async () => {
    if (!sessionReadyRef.current) {
      const boot = await bootstrapSession({ prefer: "human" })
      if (!boot.ok) return { ok: false as const }
    }
    return callAi({ intent: "handoff" })
  }, [bootstrapSession, callAi])

  const requestOfflineAiAssist = useCallback(
    async (content: string, agentsOnline: boolean) => {
      if (agentsOnline) return { ok: false as const }
      if (!sessionReadyRef.current) return { ok: false as const }
      if (supportCaseIdRef.current) return { ok: false as const }
      // Show typing immediately — before the visitor send path clears `sending`.
      setAiThinking(true)
      return callAi({ intent: "offline_assist", content, agentsOnline: false })
    },
    [callAi],
  )

  const resetLocalSession = useCallback(() => {
    clearLiveChatBrowserState()
    visitorTokenRef.current = getOrCreateLiveChatVisitorToken()
    pendingSendRef.current = []
    pendingAiRef.current = []
    aiInFlightRef.current = false
    flushingPendingRef.current = false
    publicIdRef.current = null
    sessionReadyRef.current = false
    supportCaseIdRef.current = null
    setSessionId(null)
    setPublicId(null)
    setSupportCaseId(null)
    setAssignedAgentId(null)
    setMessages([])
    setError(null)
    setSending(false)
    setAiThinking(false)
    setSessionClosed(false)
  }, [])

  const startNewConversation = useCallback(async () => {
    resetLocalSession()
    visitorTokenRef.current = getOrCreateLiveChatVisitorToken()
    return bootstrapSession({ forceNew: true })
  }, [bootstrapSession, resetLocalSession])

  return {
    sessionId,
    publicId,
    supportCaseId,
    assignedAgentId,
    messages,
    error,
    setError,
    bootstrapping,
    sending,
    aiThinking,
    sessionReady,
    sessionClosed,
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
    startNewConversation,
    visitorToken: visitorTokenRef.current,
    visitorDisplayName: VISITOR_DISPLAY_NAME,
  }
}
