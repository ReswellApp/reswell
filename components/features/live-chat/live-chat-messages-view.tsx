"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { LiveChatComposer } from "@/components/features/live-chat/live-chat-composer"
import { LiveChatWaitingBanner } from "@/components/features/live-chat/live-chat-waiting-banner"
import { LiveChatWordmark } from "@/components/features/live-chat/live-chat-wordmark"
import { cn } from "@/lib/utils"
import {
  LIVE_CHAT_BOT_AI_STUB,
  LIVE_CHAT_BOT_HANDOFF,
  LIVE_CHAT_BOT_INTRO,
  LIVE_CHAT_BOT_MISSION,
  LIVE_CHAT_HANDOFF_HELP_PREVIEW,
  LIVE_CHAT_MESSAGES_EMPTY,
  LIVE_CHAT_MESSAGES_REPLY_NOTE,
  LIVE_CHAT_QUICK_ACTIONS,
  LIVE_CHAT_STARTER_TOPICS,
  RESEWELL_BOT_NAME,
  type LiveChatHelpArticleRef,
  type LiveChatHelpLink,
} from "@/lib/live-chat/widget-config"
import { liveChatThreadSurfaceClass } from "@/lib/live-chat/widget-ui"
import type { LiveChatUiMessage } from "@/components/features/live-chat/hooks/use-live-chat-realtime"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"

export type BotUiMessage = {
  id: string
  kind: "mission" | "intro" | "ai_stub" | "handoff" | "user_choice"
  content: string
  created_at: string
  helpLinks?: LiveChatHelpLink[]
}

type MessageMode = "bot" | "human"

interface LiveChatMessagesViewProps {
  mode: MessageMode
  onModeChange: (mode: MessageMode) => void
  onBack: () => void
  onOpenArticle: (article: LiveChatHelpArticleRef) => void
  botMessages: BotUiMessage[]
  onBotMessagesChange: (messages: BotUiMessage[]) => void
  serverMessages: LiveChatUiMessage[]
  typingName: string | null
  sending: boolean
  error: string | null
  onSendHumanMessage: (content: string, email: string | null) => Promise<boolean>
  onPublishTyping: (isTyping: boolean) => void
  visitorEmail: string | null
  isSignedIn: boolean
  showEmailField: boolean
  emailDraft: string
  onEmailDraftChange: (value: string) => void
  isSupportOnline: boolean
  supportLead: LiveChatSupportTeamMember
}

function BotBubble({
  message,
  showMeta = true,
  onOpenArticle,
}: {
  message: BotUiMessage
  showMeta?: boolean
  onOpenArticle: (article: LiveChatHelpArticleRef) => void
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-muted px-3 py-2.5 text-sm leading-relaxed text-foreground">
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.helpLinks?.length ? (
          <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
            <p className="text-xs font-medium text-muted-foreground">In the meantime, these articles might help:</p>
            <ul className="space-y-1">
              {message.helpLinks.map((link) => (
                <li key={`${link.topicId}/${link.slug}`}>
                  <button
                    type="button"
                    onClick={() => onOpenArticle({ topicId: link.topicId, slug: link.slug })}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-background/80 px-2 py-1.5 text-left text-xs text-foreground hover:bg-background"
                  >
                    <span className="line-clamp-2">{link.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {showMeta ? (
        <span className="px-1 text-[10px] text-muted-foreground">
          {RESEWELL_BOT_NAME} · AI Agent · {format(new Date(message.created_at), "h:mm a")}
        </span>
      ) : null}
    </div>
  )
}

function UserChoiceBubble({ label }: { label: string }) {
  return (
    <div className="flex justify-end">
      <span className="rounded-2xl rounded-br-md bg-listingHeart px-3 py-2 text-sm font-medium text-white">
        {label}
      </span>
    </div>
  )
}

export function LiveChatMessagesView({
  mode,
  onModeChange,
  onBack,
  onOpenArticle,
  botMessages,
  onBotMessagesChange,
  serverMessages,
  typingName,
  sending,
  error,
  onSendHumanMessage,
  onPublishTyping,
  visitorEmail,
  isSignedIn,
  showEmailField,
  emailDraft,
  onEmailDraftChange,
  isSupportOnline,
  supportLead,
}: LiveChatMessagesViewProps) {
  const [draft, setDraft] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [botMessages, serverMessages, typingName])

  useEffect(() => {
    if (mode !== "human") return
    const timer = window.setTimeout(() => {
      if (showEmailField) {
        emailInputRef.current?.focus()
      } else {
        inputRef.current?.focus()
      }
    }, 50)
    return () => window.clearTimeout(timer)
  }, [mode, showEmailField])

  function appendBot(partial: Omit<BotUiMessage, "id" | "created_at">) {
    onBotMessagesChange([
      ...botMessages,
      {
        ...partial,
        id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
      },
    ])
  }

  function handleQuickAction(actionId: "ask_ai" | "wait_team", label: string) {
    appendBot({ kind: "user_choice", content: label })
    if (actionId === "ask_ai") {
      appendBot({ kind: "ai_stub", content: LIVE_CHAT_BOT_AI_STUB, helpLinks: LIVE_CHAT_HANDOFF_HELP_PREVIEW })
      return
    }
    onModeChange("human")
    appendBot({
      kind: "handoff",
      content: LIVE_CHAT_BOT_HANDOFF,
      helpLinks: LIVE_CHAT_HANDOFF_HELP_PREVIEW,
    })
  }

  async function handleSend() {
    const content = draft.trim()
    if (!content || sending) return

    if (mode === "human") {
      setEmailError(null)
      let email: string | null = isSignedIn ? visitorEmail : emailDraft.trim() || null

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
      const result = await onSendHumanMessage(content, email)
      if (!result) setDraft(content)
    }
  }

  function handleStarterTopic(starter: string) {
    if (starter) setDraft(starter)
    if (showEmailField && !emailDraft.trim()) {
      emailInputRef.current?.focus()
    } else {
      inputRef.current?.focus()
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    if (mode === "human") {
      onPublishTyping(value.trim().length > 0)
    }
  }

  const showQuickActions =
    mode === "bot" && !botMessages.some((m) => m.kind === "user_choice" || m.kind === "handoff")

  const visibleHumanMessages = serverMessages.filter(
    (m) => m.sender_type !== "system" || serverMessages.indexOf(m) > 0,
  )
  const showHumanEmptyState = mode === "human" && visibleHumanMessages.length === 0
  const hasConfirmedVisitorMessage = visibleHumanMessages.some(
    (m) => m.sender_type === "visitor" && !m.pending,
  )
  const replyEmail = isSignedIn ? visitorEmail : emailDraft.trim() || null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/50 bg-background px-3 py-3">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <LiveChatWordmark className="max-h-5" />
          <p className="truncate text-[11px] text-muted-foreground">
            {mode === "human" ? LIVE_CHAT_MESSAGES_REPLY_NOTE : "Browse guides or message our team"}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className={liveChatThreadSurfaceClass}>
        {mode === "bot" && botMessages.length <= 1 ? (
          <p className="text-center text-xs leading-relaxed text-muted-foreground">{LIVE_CHAT_BOT_MISSION}</p>
        ) : null}

        {showHumanEmptyState ? (
          <div className="mx-1 rounded-2xl border border-border/50 bg-background px-4 py-4 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">{LIVE_CHAT_MESSAGES_EMPTY}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {LIVE_CHAT_STARTER_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleStarterTopic(topic.starter)}
                  className="rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-listingHeart/40 hover:bg-listingHeart/5"
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {botMessages.map((message) => {
          if (message.kind === "user_choice") {
            return <UserChoiceBubble key={message.id} label={message.content} />
          }
          return <BotBubble key={message.id} message={message} onOpenArticle={onOpenArticle} />
        })}

        {mode === "human" ? (
          <>
            {visibleHumanMessages.map((message) => {
                const isVisitor = message.sender_type === "visitor"
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
                    className={cn("flex flex-col gap-1", isVisitor ? "items-end" : "items-start")}
                  >
                    {!isVisitor ? (
                      <span className="px-1 text-[11px] text-muted-foreground">
                        {message.agent_display_name ?? "Support"}
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed transition-opacity",
                        isVisitor
                          ? "rounded-br-md bg-listingHeart text-white"
                          : "rounded-bl-md border border-border/50 bg-background text-foreground",
                        message.pending && "opacity-80",
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                )
              })}
            {typingName ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/50 bg-background px-3 py-2.5 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                </div>
                <span className="text-[11px] text-muted-foreground">{typingName}</span>
              </div>
            ) : null}
            {hasConfirmedVisitorMessage && replyEmail ? (
              <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
                We&apos;ll reply here and email you at <span className="font-medium text-foreground/80">{replyEmail}</span>
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {showQuickActions ? (
        <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-3">
          {LIVE_CHAT_QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => handleQuickAction(action.id, action.label)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {mode === "human" ? (
        <>
          <LiveChatWaitingBanner lead={supportLead} isSupportOnline={isSupportOnline} />
          {error ? <p className="px-4 pt-2 text-xs text-destructive">{error}</p> : null}
          <LiveChatComposer
            draft={draft}
            onDraftChange={handleDraftChange}
            onSend={() => void handleSend()}
            sending={sending}
            showEmailField={showEmailField}
            emailDraft={emailDraft}
            onEmailDraftChange={(value) => {
              setEmailError(null)
              onEmailDraftChange(value)
            }}
            emailError={emailError}
            inputRef={inputRef}
            emailInputRef={emailInputRef}
          />
        </>
      ) : null}
    </div>
  )
}

export function createInitialBotMessages(): BotUiMessage[] {
  return [
    {
      id: "bot-intro",
      kind: "intro",
      content: LIVE_CHAT_BOT_INTRO,
      created_at: new Date().toISOString(),
    },
  ]
}
