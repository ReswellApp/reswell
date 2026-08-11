"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, MessageCircle, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LiveChatHomeView } from "@/components/features/live-chat/live-chat-home-view"
import { LiveChatHelpArticleView } from "@/components/features/live-chat/live-chat-help-article-view"
import { LiveChatHelpView } from "@/components/features/live-chat/live-chat-help-view"
import {
  LiveChatMessagesView,
  type BotUiMessage,
} from "@/components/features/live-chat/live-chat-messages-view"
import {
  LiveChatWidgetNav,
  type LiveChatWidgetTab,
} from "@/components/features/live-chat/live-chat-widget-nav"
import { useLiveChatSession } from "@/components/features/live-chat/hooks/use-live-chat-session"
import {
  useLiveChatSessionRealtime,
  useLiveChatTyping,
  type LiveChatUiMessage,
} from "@/components/features/live-chat/hooks/use-live-chat-realtime"
import { useLiveChatSupportOnlineStatus } from "@/components/features/live-chat/hooks/use-live-chat-agent-presence"
import { useLiveChatSupportLead } from "@/components/features/live-chat/hooks/use-live-chat-support-lead"
import { getStoredLiveChatSessionPublicId } from "@/lib/live-chat/visitor-storage"
import type { LiveChatHelpArticleRef } from "@/lib/live-chat/widget-config"
import { liveChatShellClass } from "@/lib/live-chat/widget-ui"

const VISITOR_EMAIL_KEY = "reswell-live-chat-visitor-email"

interface LiveChatWidgetProps {
  className?: string
}

function getStoredVisitorEmail(): string {
  if (typeof localStorage === "undefined") return ""
  return localStorage.getItem(VISITOR_EMAIL_KEY)?.trim() ?? ""
}

function setStoredVisitorEmail(email: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(VISITOR_EMAIL_KEY, email.trim())
}

function articleKey(article: LiveChatHelpArticleRef): string {
  return `${article.topicId}/${article.slug}`
}

export function LiveChatWidget({ className }: LiveChatWidgetProps) {
  const [open, setOpen] = useState(false)
  // Panel mounts lazily on first open, then stays mounted so open/close can animate.
  const [hasOpened, setHasOpened] = useState(false)
  const [tab, setTab] = useState<LiveChatWidgetTab>("home")
  const [messageMode, setMessageMode] = useState<"bot" | "human">("bot")
  const [botMessages, setBotMessages] = useState<BotUiMessage[]>([])
  const [emailDraft, setEmailDraft] = useState("")
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [agentPreview, setAgentPreview] = useState<LiveChatUiMessage | null>(null)
  const [helpArticleStack, setHelpArticleStack] = useState<LiveChatHelpArticleRef[]>([])
  const [helpReturnTab, setHelpReturnTab] = useState<LiveChatWidgetTab>("help")
  const messagesInitRef = useRef(false)
  const handoffBootstrapRef = useRef(false)
  const broadcastRef = useRef<(message: LiveChatUiMessage) => void>(() => {})
  const openRef = useRef(open)
  openRef.current = open

  const activeHelpArticle = helpArticleStack[helpArticleStack.length - 1] ?? null

  const session = useLiveChatSession({
    onVisitorMessageConfirmed: (message) => broadcastRef.current(message),
  })
  const { isSupportOnline } = useLiveChatSupportOnlineStatus(open || session.sessionReady)
  const supportLead = useLiveChatSupportLead(open)

  const handleRemoteMessage = useCallback(
    (message: Parameters<typeof session.appendMessage>[0]) => {
      session.appendMessage(message)
      if (message.sender_type === "agent" && !openRef.current) {
        setAgentPreview(message)
      }
    },
    [session],
  )

  // Stays subscribed while the widget is closed so agent replies surface as a preview bubble.
  const { broadcastMessage } = useLiveChatSessionRealtime(
    session.sessionId,
    session.sessionReady,
    handleRemoteMessage,
  )
  broadcastRef.current = (message) => void broadcastMessage(message)

  const { typingName, publishTyping } = useLiveChatTyping(
    session.sessionId,
    open && tab === "messages" && messageMode === "human" && session.sessionReady && !activeHelpArticle,
    "agent",
  )

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user))
      setSignedInEmail(data.user?.email?.trim() ?? null)
    })
    setEmailDraft(getStoredVisitorEmail())
  }, [open])

  const ensureMessagesViewState = useCallback(async () => {
    const storedSession = getStoredLiveChatSessionPublicId()
    if (storedSession && !session.sessionReady && !session.bootstrapping) {
      const result = await session.bootstrapSession()
      if (result.ok && result.hasHumanConversation) {
        setMessageMode("human")
        return
      }
    }
    if (session.sessionReady && session.hasHumanConversation) {
      setMessageMode("human")
    }
  }, [session])

  useEffect(() => {
    if (!open || tab !== "messages" || messagesInitRef.current) return
    messagesInitRef.current = true
    void ensureMessagesViewState()
  }, [open, tab, ensureMessagesViewState])

  useEffect(() => {
    if (messageMode !== "human" || session.sessionReady || handoffBootstrapRef.current) return
    handoffBootstrapRef.current = true
    void session.bootstrapSession()
  }, [messageMode, session])

  function clearHelpArticleStack() {
    setHelpArticleStack([])
  }

  function openHelpArticle(article: LiveChatHelpArticleRef, fromTab: LiveChatWidgetTab = tab) {
    setHelpReturnTab(fromTab)
    setHelpArticleStack((prev) => {
      const current = prev[prev.length - 1]
      if (current && articleKey(current) === articleKey(article)) return prev
      return [...prev, article]
    })
  }

  function openRelatedHelpArticle(article: LiveChatHelpArticleRef) {
    setHelpArticleStack((prev) => {
      const current = prev[prev.length - 1]
      if (current && articleKey(current) === articleKey(article)) return prev
      return [...prev, article]
    })
  }

  function backFromHelpArticle() {
    if (helpArticleStack.length <= 1) {
      clearHelpArticleStack()
      setTab(helpReturnTab)
      return
    }
    setHelpArticleStack((prev) => prev.slice(0, -1))
  }

  function openWidget() {
    setAgentPreview(null)
    setTab("messages")
    setMessageMode("human")
    clearHelpArticleStack()
    if (!messagesInitRef.current) {
      messagesInitRef.current = true
      void ensureMessagesViewState()
    }
    if (!handoffBootstrapRef.current) {
      handoffBootstrapRef.current = true
      void session.bootstrapSession()
    }
    setHasOpened(true)
    setOpen(true)
  }

  function closeWidget() {
    setOpen(false)
  }

  function toggleWidget() {
    if (open) {
      closeWidget()
    } else {
      openWidget()
    }
  }

  function openMessagesFromHome() {
    clearHelpArticleStack()
    setTab("messages")
    setMessageMode("human")
    if (!messagesInitRef.current) {
      messagesInitRef.current = true
      void ensureMessagesViewState()
    }
    if (!handoffBootstrapRef.current) {
      handoffBootstrapRef.current = true
      void session.bootstrapSession()
    }
  }

  function changeTab(next: LiveChatWidgetTab) {
    clearHelpArticleStack()
    setTab(next)
    if (next === "messages") {
      setMessageMode("human")
      if (!messagesInitRef.current) {
        messagesInitRef.current = true
        void ensureMessagesViewState()
      }
      if (!handoffBootstrapRef.current) {
        handoffBootstrapRef.current = true
        void session.bootstrapSession()
      }
    }
  }

  async function handleSendHumanMessage(content: string, email: string | null): Promise<boolean> {
    if (email && !isSignedIn) {
      setStoredVisitorEmail(email)
    }
    const sent = await session.sendMessage(content, email)
    return sent !== null
  }

  const showEmailField = messageMode === "human" && !isSignedIn

  const lastConversationMessage =
    [...session.messages].reverse().find((m) => m.sender_type !== "system") ?? null
  const recentMessage = lastConversationMessage
    ? {
        content: lastConversationMessage.content,
        createdAt: lastConversationMessage.created_at,
        fromAgent: lastConversationMessage.sender_type === "agent",
        senderName:
          lastConversationMessage.sender_type === "agent"
            ? (lastConversationMessage.agent_display_name ?? "Reswell Support")
            : "You",
      }
    : null

  return (
    <div className={cn("pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-3", className)}>
      {hasOpened ? (
        <div
          aria-hidden={!open}
          className={cn(
            "origin-bottom-right transition-all duration-300 ease-out",
            open
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "invisible pointer-events-none translate-y-4 scale-95 opacity-0",
          )}
        >
        <div
          className={liveChatShellClass}
          role="dialog"
          aria-label="Reswell support"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeHelpArticle ? (
              <LiveChatHelpArticleView
                articleRef={activeHelpArticle}
                onBack={backFromHelpArticle}
                onClose={closeWidget}
                onOpenArticle={openRelatedHelpArticle}
              />
            ) : null}

            {!activeHelpArticle && tab === "home" ? (
              <LiveChatHomeView
                isSupportOnline={isSupportOnline}
                onSendMessage={openMessagesFromHome}
                onOpenHelp={() => changeTab("help")}
                onOpenArticle={(article) => openHelpArticle(article, "home")}
                onClose={closeWidget}
                recentMessage={recentMessage}
                supportLead={supportLead}
              />
            ) : null}

            {!activeHelpArticle && tab === "messages" ? (
              <LiveChatMessagesView
                mode={messageMode}
                onModeChange={setMessageMode}
                onBack={() => changeTab("home")}
                onOpenArticle={(article) => openHelpArticle(article, "messages")}
                botMessages={botMessages}
                onBotMessagesChange={setBotMessages}
                serverMessages={session.messages}
                typingName={typingName}
                sending={session.sending}
                error={session.error}
                onSendHumanMessage={handleSendHumanMessage}
                onPublishTyping={(isTyping) =>
                  void publishTyping("visitor", session.visitorDisplayName, isTyping)
                }
                visitorEmail={signedInEmail}
                isSignedIn={isSignedIn}
                showEmailField={showEmailField}
                emailDraft={emailDraft}
                onEmailDraftChange={setEmailDraft}
                isSupportOnline={isSupportOnline}
                supportLead={supportLead}
              />
            ) : null}

            {!activeHelpArticle && tab === "help" ? (
              <div className="flex items-center justify-between border-b border-border/50 bg-background px-4 py-3">
                <p className="text-sm font-semibold">Help guides</p>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={closeWidget} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            {!activeHelpArticle && tab === "help" ? (
              <LiveChatHelpView onOpenArticle={(article) => openHelpArticle(article, "help")} />
            ) : null}
          </div>

          <LiveChatWidgetNav
            active={tab}
            onChange={changeTab}
            hasUnreadMessages={
              session.messages.some((m) => m.sender_type === "agent") && tab !== "messages"
            }
          />
        </div>
        </div>
      ) : null}

      {!open && agentPreview ? (
        <div className="pointer-events-auto relative w-72 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={openWidget}
            className="w-full rounded-2xl border border-border/50 bg-background p-3 text-left shadow-[0_12px_32px_rgba(15,23,42,0.16)] transition-colors hover:bg-muted/40"
          >
            <p className="text-xs font-semibold text-foreground">
              {agentPreview.agent_display_name ?? "Reswell Support"}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">
              {agentPreview.content}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setAgentPreview(null)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label="Dismiss message preview"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-listingHeart text-white shadow-lg transition-transform duration-200 ease-out hover:scale-105 hover:bg-listingHeart/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
        onClick={toggleWidget}
        aria-label={open ? "Close Reswell support" : "Open Reswell support"}
        aria-expanded={open}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <MessageCircle
            className={cn(
              "absolute h-6 w-6 transition-all duration-200 ease-out",
              open ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
            aria-hidden
          />
          <ChevronDown
            className={cn(
              "absolute h-6 w-6 transition-all duration-200 ease-out",
              open ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0",
            )}
            aria-hidden
          />
        </span>
        {isSupportOnline && !open ? (
          <span
            className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500"
            aria-hidden
          />
        ) : null}
      </button>
    </div>
  )
}
