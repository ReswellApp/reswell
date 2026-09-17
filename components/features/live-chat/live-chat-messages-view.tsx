"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { LiveChatAdminOnlyBadge } from "@/components/features/live-chat/live-chat-admin-only-badge"
import { LiveChatComposer } from "@/components/features/live-chat/live-chat-composer"
import { LiveChatLabelUpdatePanel } from "@/components/features/live-chat/live-chat-label-update-panel"
import { LiveChatPendingActions } from "@/components/features/live-chat/live-chat-pending-actions"
import { LiveChatWaitingBanner } from "@/components/features/live-chat/live-chat-waiting-banner"
import { LiveChatWordmark } from "@/components/features/live-chat/live-chat-wordmark"
import { cn } from "@/lib/utils"
import { LIVE_CHAT_TEAM_NAME } from "@/lib/live-chat/widget-config"
import { isLiveChatShipFromLabelUpdateIntent, threadHasLiveChatShipFromLabelUpdateIntent } from "@/lib/live-chat/label-update-intent"
import { isLegacyLiveChatWidgetCopy } from "@/lib/live-chat/team-display"
import { liveChatThreadSurfaceClass } from "@/lib/live-chat/widget-ui"
import type { LiveChatUiMessage } from "@/components/features/live-chat/hooks/use-live-chat-realtime"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"
import { resolveWorkingSupportAgent } from "@/lib/live-chat/support-lead-display"

interface LiveChatMessagesViewProps {
  onBack: () => void
  serverMessages: LiveChatUiMessage[]
  typingName: string | null
  sending: boolean
  teamThinking?: boolean
  error: string | null
  sessionClosed?: boolean
  onStartNewConversation?: () => void
  composerLocked?: boolean
  onSendMessage: (content: string, email: string | null) => Promise<boolean>
  onPublishTyping: (isTyping: boolean) => void
  publicId?: string | null
  visitorToken?: string | null
  visitorEmail: string | null
  isSignedIn: boolean
  onAuthRequired?: () => void
  showEmailField: boolean
  emailDraft: string
  onEmailDraftChange: (value: string) => void
  emailLocked?: boolean
  isSupportOnline: boolean
  supportLead: LiveChatSupportTeamMember
  supportTeam?: LiveChatSupportTeamMember[]
  onlineMemberIds?: string[]
  assignedAgentId?: string | null
}

export function LiveChatMessagesView({
  onBack,
  serverMessages,
  typingName,
  sending,
  teamThinking = false,
  error,
  sessionClosed = false,
  onStartNewConversation,
  composerLocked = false,
  onSendMessage,
  onPublishTyping,
  publicId = null,
  visitorToken = null,
  visitorEmail,
  isSignedIn,
  onAuthRequired,
  showEmailField,
  emailDraft,
  onEmailDraftChange,
  emailLocked = false,
  isSupportOnline,
  supportLead,
  supportTeam = [],
  onlineMemberIds = [],
  assignedAgentId = null,
}: LiveChatMessagesViewProps) {
  const [draft, setDraft] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [labelUpdateDismissed, setLabelUpdateDismissed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const latestVisitorText = useMemo(() => {
    for (let i = serverMessages.length - 1; i >= 0; i -= 1) {
      const message = serverMessages[i]
      if (message?.sender_type === "visitor" && message.content.trim()) {
        return message.content
      }
    }
    return ""
  }, [serverMessages])

  const threadWantsLabelUpdate = useMemo(
    () => threadHasLiveChatShipFromLabelUpdateIntent(serverMessages),
    [serverMessages],
  )

  const showLabelUpdatePanel =
    !sessionClosed &&
    !labelUpdateDismissed &&
    Boolean(publicId) &&
    threadWantsLabelUpdate

  useEffect(() => {
    if (isLiveChatShipFromLabelUpdateIntent(latestVisitorText)) {
      setLabelUpdateDismissed(false)
    }
  }, [latestVisitorText])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [serverMessages, typingName, sending, teamThinking, showLabelUpdatePanel])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (showEmailField && !emailLocked) {
        emailInputRef.current?.focus()
      } else {
        inputRef.current?.focus()
      }
    }, 50)
    return () => window.clearTimeout(timer)
  }, [emailLocked, showEmailField])

  async function handleSend() {
    const content = draft.trim()
    if (!content || sending || composerLocked || sessionClosed) return

    setEmailError(null)
    const email: string | null = isSignedIn ? visitorEmail : emailDraft.trim() || null
    if (!isSignedIn) {
      if (!email) {
        setEmailError("Add your email so we can reply.")
        emailInputRef.current?.focus()
        return
      }
      if (!z.string().email().safeParse(email).success) {
        setEmailError("Enter a valid email address.")
        emailInputRef.current?.focus()
        return
      }
    }

    setDraft("")
    if (inputRef.current) inputRef.current.style.height = "auto"
    onPublishTyping(false)
    inputRef.current?.focus()
    const result = await onSendMessage(content, email)
    if (!result) setDraft(content)
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    onPublishTyping(value.trim().length > 0)
  }

  const visibleThreadMessages = serverMessages.filter((message, index, list) => {
    if (isLegacyLiveChatWidgetCopy(message.content)) return false
    if (list.findIndex((m) => m.id === message.id) !== index) return false
    if (message.sender_type === "visitor") {
      const sameVisitor = list.filter(
        (item) => item.sender_type === "visitor" && item.content === message.content,
      )
      if (sameVisitor.length > 1) {
        const confirmed = sameVisitor.find((item) => !item.pending) ?? sameVisitor[0]
        return message.id === confirmed.id
      }
    }
    return message.sender_type !== "system" || index > 0
  })

  const assignedAgent = resolveWorkingSupportAgent(
    serverMessages,
    supportTeam.length > 0 ? supportTeam : [supportLead],
    assignedAgentId,
  )
  const isAssignedAgentOnline = Boolean(
    assignedAgent && onlineMemberIds.includes(assignedAgent.id),
  )
  const showTeamTyping = teamThinking || Boolean(typingName)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/50 bg-background px-3 py-3">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LiveChatWordmark className="max-h-5" />
            <LiveChatAdminOnlyBadge />
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{LIVE_CHAT_TEAM_NAME}</p>
        </div>
      </div>

      <div ref={scrollRef} className={liveChatThreadSurfaceClass}>
        {visibleThreadMessages.map((message) => {
          const isVisitor = message.sender_type === "visitor"
          if (message.sender_type === "system") {
            return (
              <p key={message.id} className="text-center text-xs text-muted-foreground">
                {message.content}
              </p>
            )
          }
          return (
            <div
              key={message.id}
              className={cn("flex flex-col gap-1", isVisitor ? "items-end" : "items-start")}
            >
              {!isVisitor ? (
                <span className="px-1 text-[11px] text-muted-foreground">
                  {message.agent_display_name ?? LIVE_CHAT_TEAM_NAME}
                </span>
              ) : null}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed transition-opacity",
                  isVisitor
                    ? "rounded-2xl rounded-br-md bg-listingHeart text-white"
                    : "rounded-2xl rounded-bl-md border border-border/50 bg-background text-foreground",
                  message.pending && "opacity-80",
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          )
        })}

        {showTeamTyping ? (
          <div className="flex items-center gap-2" aria-live="polite" aria-label={`${LIVE_CHAT_TEAM_NAME} is typing`}>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/50 bg-background px-3 py-2.5 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {typingName ?? `${LIVE_CHAT_TEAM_NAME} is typing…`}
            </span>
          </div>
        ) : null}
      </div>

      <LiveChatWaitingBanner
        lead={supportLead}
        assignedAgent={assignedAgent}
        isAssignedAgentOnline={isAssignedAgentOnline}
        isAssignedAgentTyping={showTeamTyping}
        isSupportOnline={isSupportOnline}
      />
      {sessionClosed ? (
        <div className="flex flex-col items-center gap-2 px-4 pb-2">
          <p className="text-center text-xs text-muted-foreground">This conversation is closed.</p>
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={() => onStartNewConversation?.()}
          >
            Start a new conversation
          </Button>
        </div>
      ) : null}
      {error && !sessionClosed ? <p className="px-4 pt-2 text-xs text-destructive">{error}</p> : null}
      {!sessionClosed && showLabelUpdatePanel ? (
        <LiveChatLabelUpdatePanel
          publicId={publicId}
          visitorToken={visitorToken}
          enabled
          isSignedIn={isSignedIn}
          onAuthRequired={onAuthRequired}
          onDismiss={() => setLabelUpdateDismissed(true)}
        />
      ) : null}
      {!sessionClosed ? (
        <LiveChatPendingActions
          publicId={publicId}
          visitorToken={visitorToken}
          enabled={Boolean(publicId) && !showLabelUpdatePanel}
          isSignedIn={isSignedIn}
          onAuthRequired={onAuthRequired}
        />
      ) : null}
      {!sessionClosed ? (
        <LiveChatComposer
          draft={draft}
          onDraftChange={handleDraftChange}
          onSend={() => void handleSend()}
          sending={sending || composerLocked}
          showEmailField={showEmailField}
          emailDraft={emailDraft}
          emailLocked={emailLocked}
          onEmailDraftChange={(value) => {
            setEmailError(null)
            onEmailDraftChange(value)
          }}
          emailError={emailError}
          inputRef={inputRef}
          emailInputRef={emailInputRef}
        />
      ) : null}
    </div>
  )
}
