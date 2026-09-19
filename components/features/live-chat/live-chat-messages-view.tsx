"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LiveChatAdminOnlyBadge } from "@/components/features/live-chat/live-chat-admin-only-badge"
import { LiveChatComposer } from "@/components/features/live-chat/live-chat-composer"
import { LiveChatLabelUpdatePanel } from "@/components/features/live-chat/live-chat-label-update-panel"
import { LiveChatOrderTiles } from "@/components/features/live-chat/live-chat-order-tiles"
import { LiveChatPendingActions } from "@/components/features/live-chat/live-chat-pending-actions"
import { LiveChatWaitingBanner } from "@/components/features/live-chat/live-chat-waiting-banner"
import { LiveChatWordmark } from "@/components/features/live-chat/live-chat-wordmark"
import { LiveChatReplyRatingControls } from "@/components/features/live-chat/live-chat-reply-rating-controls"
import { supportReplyExampleRatingToast } from "@/components/features/admin/support-reply-examples/support-reply-example-rating"
import { cn } from "@/lib/utils"
import { LIVE_CHAT_MESSAGES_EMPTY, LIVE_CHAT_TEAM_NAME } from "@/lib/live-chat/widget-config"
import { isLiveChatJoinMessage, liveChatTypingLabel } from "@/lib/live-chat/human-feel"
import { latestLiveChatShipFromLabelUpdateMessage } from "@/lib/live-chat/label-update-intent"
import { latestLiveChatSpecificOrderLookupMessage } from "@/lib/live-chat/order-tile-intent"
import { isLegacyLiveChatWidgetCopy } from "@/lib/live-chat/team-display"
import { liveChatThreadSurfaceClass } from "@/lib/live-chat/widget-ui"
import { rateLiveChatReplyAction } from "@/lib/actions/liveChatAdmin"
import type { SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"
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
  inputLocked?: boolean
  unlockFailed?: boolean
  onSendMessage: (content: string, email: string | null) => Promise<boolean>
  onPublishTyping: (isTyping: boolean) => void
  publicId?: string | null
  sessionId?: string | null
  visitorToken?: string | null
  /** Soft-launch: show staff rating controls on auto team replies. */
  enableReplyRatings?: boolean
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
  personaFirstName?: string | null
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
  inputLocked = false,
  unlockFailed = false,
  onSendMessage,
  onPublishTyping,
  publicId = null,
  sessionId = null,
  visitorToken = null,
  enableReplyRatings = false,
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
  personaFirstName = null,
}: LiveChatMessagesViewProps) {
  const [draft, setDraft] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  /** Hide the label panel until a newer visitor message arrives. */
  const [labelPanelDismissedThroughCount, setLabelPanelDismissedThroughCount] = useState(0)
  /** Hide order tiles until a newer visitor message arrives. */
  const [orderTilesDismissedThroughCount, setOrderTilesDismissedThroughCount] = useState(0)
  const [ratingMessageId, setRatingMessageId] = useState<string | null>(null)
  const [ratedMessageIds, setRatedMessageIds] = useState<Set<string>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const visitorMessageCount = useMemo(
    () => serverMessages.filter((message) => message.sender_type === "visitor").length,
    [serverMessages],
  )
  const visitorMessageCountRef = useRef(visitorMessageCount)
  visitorMessageCountRef.current = visitorMessageCount

  const dismissLabelPanel = useCallback(() => {
    setLabelPanelDismissedThroughCount(visitorMessageCountRef.current)
  }, [])

  const dismissOrderTiles = useCallback(() => {
    setOrderTilesDismissedThroughCount(visitorMessageCountRef.current)
  }, [])

  const selectOrderTile = useCallback(
    (content: string) => {
      void onSendMessage(content, visitorEmail)
    },
    [onSendMessage, visitorEmail],
  )

  const latestLabelAsk = useMemo(
    () => latestLiveChatShipFromLabelUpdateMessage(serverMessages),
    [serverMessages],
  )

  const latestOrderLookup = useMemo(
    () => latestLiveChatSpecificOrderLookupMessage(serverMessages),
    [serverMessages],
  )

  const showLabelUpdatePanel =
    !sessionClosed &&
    Boolean(publicId) &&
    latestLabelAsk !== null &&
    visitorMessageCount > labelPanelDismissedThroughCount

  const showOrderTiles =
    !sessionClosed &&
    !showLabelUpdatePanel &&
    Boolean(publicId) &&
    isSignedIn &&
    latestOrderLookup !== null &&
    visitorMessageCount > orderTilesDismissedThroughCount

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [serverMessages, typingName, sending, teamThinking, showLabelUpdatePanel, showOrderTiles])

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
    // Never block on "connecting" or a stuck sending flag — queue and bootstrap.
    if (!content || sessionClosed || inputLocked) return

    setEmailError(null)
    // showEmailField is only true once auth resolves as signed_out. While auth is
    // still loading, do not demand an email (that left the send button looking dead).
    const email: string | null = isSignedIn
      ? visitorEmail
      : showEmailField
        ? emailDraft.trim() || null
        : null
    if (!isSignedIn && showEmailField) {
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

  async function rateTeamReply(
    messageId: string,
    rating: SupportReplyDraftRating,
    note: string,
  ) {
    if (!sessionId) {
      toast.error("Chat session not ready to rate yet.")
      return
    }
    setRatingMessageId(messageId)
    const result = await rateLiveChatReplyAction({
      session_id: sessionId,
      message_id: messageId,
      rating,
      rating_note: note || undefined,
    })
    setRatingMessageId(null)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setRatedMessageIds((prev) => new Set(prev).add(messageId))
    toast.success(supportReplyExampleRatingToast(rating))
  }

  function handleDraftChange(value: string) {
    if (inputLocked) return
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
    if (message.sender_type === "system") {
      return isLiveChatJoinMessage(message.content) || index > 0
    }
    return true
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
          <p className="truncate text-[11px] text-muted-foreground">
            {assignedAgent?.name.split(/\s+/)[0] ?? personaFirstName ?? "Hayden or David"}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className={liveChatThreadSurfaceClass}>
        {visibleThreadMessages.map((message) => {
          const isVisitor = message.sender_type === "visitor"
          const isTeamAutoReply =
            message.sender_type === "agent" && !message.sender_agent_id && !message.pending
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
                  {message.agent_display_name ?? personaFirstName ?? LIVE_CHAT_TEAM_NAME}
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
              {enableReplyRatings && isTeamAutoReply && !ratedMessageIds.has(message.id) ? (
                <LiveChatReplyRatingControls
                  disabled={!sessionId}
                  saving={ratingMessageId === message.id}
                  onSubmit={(rating, note) => rateTeamReply(message.id, rating, note)}
                />
              ) : null}
              {enableReplyRatings && isTeamAutoReply && ratedMessageIds.has(message.id) ? (
                <span className="px-1 text-[10px] text-muted-foreground">
                  Rated — teaches later live chat replies
                </span>
              ) : null}
            </div>
          )
        })}

        {visibleThreadMessages.length === 0 && !showTeamTyping ? (
          <p className="px-2 py-6 text-center text-sm leading-relaxed text-muted-foreground">
            {LIVE_CHAT_MESSAGES_EMPTY}
          </p>
        ) : null}

        {showTeamTyping ? (
          <div
            className="flex items-center gap-2"
            aria-live="polite"
            aria-label={typingName ?? liveChatTypingLabel(personaFirstName ?? "Hayden")}
          >
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/50 bg-background px-3 py-2.5 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {typingName ?? liveChatTypingLabel(personaFirstName ?? "Hayden")}
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
          <p className="text-center text-xs text-muted-foreground">
            This chat was closed after it looked solved. Start a new conversation anytime.
          </p>
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
          onDismiss={dismissLabelPanel}
        />
      ) : null}
      {!sessionClosed && showOrderTiles ? (
        <LiveChatOrderTiles
          publicId={publicId}
          visitorToken={visitorToken}
          enabled
          isSignedIn={isSignedIn}
          sending={sending}
          onSelect={selectOrderTile}
          onAuthRequired={onAuthRequired}
          onDismiss={dismissOrderTiles}
        />
      ) : null}
      {!sessionClosed ? (
        <LiveChatPendingActions
          publicId={publicId}
          visitorToken={visitorToken}
          enabled={Boolean(publicId) && !showLabelUpdatePanel && !showOrderTiles}
          isSignedIn={isSignedIn}
          onAuthRequired={onAuthRequired}
        />
      ) : null}
      {!sessionClosed ? (
        <LiveChatComposer
          draft={draft}
          onDraftChange={handleDraftChange}
          onSend={() => void handleSend()}
          sending={sending}
          inputLocked={inputLocked}
          showEmailField={showEmailField}
          emailDraft={emailDraft}
          emailLocked={emailLocked}
          onEmailDraftChange={(value) => {
            setEmailError(null)
            onEmailDraftChange(value)
          }}
          emailError={emailError}
          placeholder={
            inputLocked
              ? unlockFailed
                ? "Refresh to send messages"
                : "One moment…"
              : composerLocked
                ? "Connecting…"
                : undefined
          }
          inputRef={inputRef}
          emailInputRef={emailInputRef}
        />
      ) : null}
    </div>
  )
}
