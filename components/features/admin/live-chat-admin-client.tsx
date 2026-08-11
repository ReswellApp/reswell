"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { Circle, Loader2, MessageCircle, RefreshCw, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  escalateLiveChatSessionAdminAction,
  listLiveChatAdminQueueAction,
  loadLiveChatAdminThreadAction,
  sendLiveChatAgentMessageAction,
  updateLiveChatSessionAdminAction,
} from "@/lib/actions/liveChatAdmin"
import type { LiveChatAdminMessage, LiveChatAdminSession } from "@/lib/services/liveChatAdmin"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  useLiveChatAgentPresence,
  type LiveChatAgentPresence,
} from "@/components/features/live-chat/hooks/use-live-chat-agent-presence"
import {
  useLiveChatSessionRealtime,
  useLiveChatTyping,
  type LiveChatUiMessage,
} from "@/components/features/live-chat/hooks/use-live-chat-realtime"
import { format } from "date-fns"

interface LiveChatAdminClientProps {
  initialStaff: { userId: string; displayName: string }
}

function sessionLabel(session: LiveChatAdminSession): string {
  if (session.user_id) return session.visitor_name
  return `${session.visitor_name} · ${session.public_id}`
}

function AgentsOnlineBar({
  agents,
  currentUserId,
}: {
  agents: LiveChatAgentPresence[]
  currentUserId: string
}) {
  if (agents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        You&apos;re the only agent online in live chat right now.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Agents online</span>
      {agents.map((agent) => (
        <Badge
          key={agent.userId}
          variant="secondary"
          className="gap-1.5 rounded-full font-normal"
        >
          <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" aria-hidden />
          {agent.displayName}
          {agent.userId === currentUserId ? " (you)" : ""}
        </Badge>
      ))}
    </div>
  )
}

function QueueList({
  sessions,
  activeSessionId,
  onSelect,
  loading,
}: {
  sessions: LiveChatAdminSession[]
  activeSessionId: string | null
  onSelect: (sessionId: string) => void
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Loading chats…</p>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
        <MessageCircle className="h-8 w-8 opacity-40" aria-hidden />
        <p className="text-sm">No open live chats right now.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border/60">
      {sessions.map((session) => {
        const active = session.id === activeSessionId
        const waiting = session.last_visitor_message_at && session.status === "open"
        return (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              className={cn(
                "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                active && "bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {sessionLabel(session)}
                </span>
                {waiting ? (
                  <Badge variant="default" className="shrink-0 rounded-full text-[10px]">
                    Waiting
                  </Badge>
                ) : null}
              </div>
              {session.preview ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{session.preview}</p>
              ) : null}
              <p className="text-[10px] text-muted-foreground">
                {session.last_message_at
                  ? formatDistanceToNow(new Date(session.last_message_at), { addSuffix: true })
                  : "Just started"}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ThreadPane({
  session,
  messages,
  staff,
  onRefreshQueue,
}: {
  session: LiveChatAdminSession
  messages: LiveChatAdminMessage[]
  staff: { userId: string; displayName: string }
  onRefreshQueue: () => void
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [resolving, startResolve] = useTransition()
  const [escalating, startEscalate] = useTransition()
  const [ticketLinked, setTicketLinked] = useState(Boolean(session.contact_message_id))
  const [escalateError, setEscalateError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localMessages, setLocalMessages] = useState<LiveChatAdminMessage[]>(messages)

  useEffect(() => {
    setLocalMessages(messages)
    setTicketLinked(Boolean(session.contact_message_id))
    setEscalateError(null)
  }, [messages, session.id, session.contact_message_id])

  const appendRemote = useCallback((message: LiveChatUiMessage) => {
    setLocalMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev
      return [
        ...prev,
        {
          id: message.id,
          session_id: session.id,
          sender_type: message.sender_type,
          sender_agent_id: message.sender_type === "agent" ? staff.userId : null,
          content: message.content,
          created_at: message.created_at,
          agent_display_name:
            message.sender_type === "bot"
              ? "Reswell AI"
              : (message.agent_display_name ?? null),
        },
      ]
    })
  }, [session.id, staff.userId])

  const { broadcastMessage } = useLiveChatSessionRealtime(session.id, true, appendRemote)
  const { typingName, publishTyping } = useLiveChatTyping(session.id, true, "visitor")

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [localMessages, typingName])

  async function sendReply() {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setDraft("")
    void publishTyping("agent", staff.displayName, false)

    const result = await sendLiveChatAgentMessageAction({
      session_id: session.id,
      content,
    })

    if ("error" in result && result.error) {
      setDraft(content)
      setSending(false)
      return
    }

    if ("success" in result && result.success) {
      const newMessages = result.joined_message
        ? [result.joined_message, result.message]
        : [result.message]
      setLocalMessages((prev) => {
        const additions = newMessages.filter((m) => !prev.some((p) => p.id === m.id))
        return additions.length > 0 ? [...prev, ...additions] : prev
      })
      if (result.joined_message) {
        void broadcastMessage({
          id: result.joined_message.id,
          sender_type: "system",
          content: result.joined_message.content,
          created_at: result.joined_message.created_at,
        })
      }
      void broadcastMessage({
        id: result.message.id,
        sender_type: "agent",
        content: result.message.content,
        created_at: result.message.created_at,
        agent_display_name: result.agent_display_name,
      })
      onRefreshQueue()
    }
    setSending(false)
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    void publishTyping("agent", staff.displayName, true)
    typingTimeoutRef.current = setTimeout(() => {
      void publishTyping("agent", staff.displayName, false)
    }, 1200)
  }

  function resolveChat() {
    startResolve(async () => {
      await updateLiveChatSessionAdminAction({
        session_id: session.id,
        status: "resolved",
        assigned_agent_id: staff.userId,
      })
      onRefreshQueue()
    })
  }

  function createTicket() {
    startEscalate(async () => {
      setEscalateError(null)
      const result = await escalateLiveChatSessionAdminAction({ session_id: session.id })
      if ("success" in result && result.success) {
        setTicketLinked(true)
        onRefreshQueue()
      } else if ("error" in result) {
        setEscalateError(result.error)
      }
    })
  }

  return (
    <div className="flex min-h-[min(72vh,720px)] flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{sessionLabel(session)}</p>
          <p className="text-xs text-muted-foreground">
            Session {session.public_id}
            {ticketLinked ? ` · Ticket linked` : ""}
          </p>
          {escalateError ? <p className="text-xs text-destructive">{escalateError}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full capitalize">
            {session.status}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={escalating || ticketLinked}
            onClick={createTicket}
          >
            {escalating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : ticketLinked ? (
              "Ticket created"
            ) : (
              "Create ticket"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={resolving || session.status === "resolved" || session.status === "closed"}
            onClick={resolveChat}
          >
            {resolving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Resolve"}
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {localMessages.map((message) => {
          const isAgent = message.sender_type === "agent"
          const isBot = message.sender_type === "bot"
          const isSystem = message.sender_type === "system"
          if (isSystem) {
            return (
              <p key={message.id} className="text-center text-xs text-muted-foreground">
                {message.content}
              </p>
            )
          }
          return (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-1",
                isAgent ? "items-end" : "items-start",
              )}
            >
              {isAgent ? (
                <span className="px-1 text-[11px] text-muted-foreground">
                  {message.agent_display_name ?? staff.displayName}
                </span>
              ) : isBot ? (
                <span className="px-1 text-[11px] font-medium text-muted-foreground">
                  Reswell AI
                </span>
              ) : (
                <span className="px-1 text-[11px] text-muted-foreground">{session.visitor_name}</span>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  isAgent
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : isBot
                      ? "rounded-bl-md border border-dashed border-border bg-muted/80 text-foreground"
                      : "rounded-bl-md bg-muted text-foreground",
                )}
              >
                {message.content}
              </div>
              <span className="px-1 text-[10px] text-muted-foreground">
                {format(new Date(message.created_at), "h:mm a")}
              </span>
            </div>
          )
        })}
        {typingName ? <p className="text-xs italic text-muted-foreground">{typingName}</p> : null}
      </div>

      <div className="border-t border-border/60 p-4">
        <Textarea
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Reply to visitor…"
          rows={3}
          className="min-h-[88px] resize-none"
          maxLength={10000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void sendReply()
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button type="button" disabled={sending || draft.trim().length === 0} onClick={() => void sendReply()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Send reply"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function LiveChatAdminClient({ initialStaff }: LiveChatAdminClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const [sessions, setSessions] = useState<LiveChatAdminSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<{
    session: LiveChatAdminSession
    messages: LiveChatAdminMessage[]
  } | null>(null)
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)

  const { agentsOnline } = useLiveChatAgentPresence(
    initialStaff.userId,
    initialStaff.displayName,
    true,
  )

  const refreshQueue = useCallback(async () => {
    setLoadingQueue(true)
    const result = await listLiveChatAdminQueueAction()
    if ("success" in result && result.success) {
      setSessions(result.sessions)
      if (activeSessionId && !result.sessions.some((s) => s.id === activeSessionId)) {
        setActiveSessionId(null)
        setActiveThread(null)
      }
    }
    setLoadingQueue(false)
  }, [activeSessionId])

  const loadThread = useCallback(async (sessionId: string) => {
    setLoadingThread(true)
    const result = await loadLiveChatAdminThreadAction(sessionId)
    if ("success" in result && result.success) {
      setActiveThread({ session: result.session, messages: result.messages })
    }
    setLoadingThread(false)
  }, [])

  useEffect(() => {
    void refreshQueue()
  }, [refreshQueue])

  useEffect(() => {
    if (!activeSessionId) return
    void loadThread(activeSessionId)
  }, [activeSessionId, loadThread])

  useEffect(() => {
    const channel = supabase
      .channel("live-chat-admin-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_chat_sessions" },
        () => {
          void refreshQueue()
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages" },
        (payload) => {
          const row = payload.new as { session_id?: string }
          if (row.session_id && row.session_id === activeSessionId) {
            void loadThread(row.session_id)
          }
          void refreshQueue()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeSessionId, loadThread, refreshQueue, supabase])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live chat</h1>
          <p className="text-sm text-muted-foreground">
            Real-time visitor conversations — separate from marketplace Messages.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void refreshQueue()}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </Button>
      </div>

      <AgentsOnlineBar agents={agentsOnline} currentUserId={initialStaff.userId} />

      <div className="grid min-h-[min(72vh,720px)] grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <aside className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Open chats ({sessions.length})</p>
          </div>
          <div className="max-h-[min(72vh,720px)] overflow-y-auto">
            <QueueList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={setActiveSessionId}
              loading={loadingQueue}
            />
          </div>
        </aside>

        <section className="min-h-[320px]">
          {loadingThread ? (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            </div>
          ) : activeThread ? (
            <ThreadPane
              session={activeThread.session}
              messages={activeThread.messages}
              staff={initialStaff}
              onRefreshQueue={() => void refreshQueue()}
            />
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 text-center text-muted-foreground">
              <MessageCircle className="mb-3 h-10 w-10 opacity-40" aria-hidden />
              <p className="text-sm">Select a chat from the queue to reply.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
