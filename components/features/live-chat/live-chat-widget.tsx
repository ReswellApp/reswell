"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, MessageCircle, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LiveChatHomeView } from "@/components/features/live-chat/live-chat-home-view"
import { LiveChatHelpArticleView } from "@/components/features/live-chat/live-chat-help-article-view"
import { LiveChatHelpView } from "@/components/features/live-chat/live-chat-help-view"
import { LiveChatMessagesView } from "@/components/features/live-chat/live-chat-messages-view"
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
import { useLiveChatSupportTeam } from "@/components/features/live-chat/hooks/use-live-chat-support-lead"
import {
  getStoredLiveChatVisitorEmail,
  setStoredLiveChatVisitorEmail,
} from "@/lib/live-chat/visitor-storage"
import {
  LIVE_CHAT_ADMIN_ONLY_LABEL,
  LIVE_CHAT_TEAM_NAME,
  LIVE_CHAT_WIDGET_ADMIN_ONLY,
  type LiveChatHelpArticleRef,
} from "@/lib/live-chat/widget-config"
import { liveChatShellClass } from "@/lib/live-chat/widget-ui"
import { LiveChatAdminOnlyBadge } from "@/components/features/live-chat/live-chat-admin-only-badge"

interface LiveChatWidgetProps {
  className?: string
}

function articleKey(article: LiveChatHelpArticleRef): string {
  return `${article.topicId}/${article.slug}`
}

export function LiveChatWidget({ className }: LiveChatWidgetProps) {
  const [open, setOpen] = useState(false)
  // Panel mounts lazily on first open, then stays mounted so open/close can animate.
  const [hasOpened, setHasOpened] = useState(false)
  const [tab, setTab] = useState<LiveChatWidgetTab>("home")
  const [emailDraft, setEmailDraft] = useState("")
  const [emailLocked, setEmailLocked] = useState(
    () => Boolean(getStoredLiveChatVisitorEmail()),
  )
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  /** Unknown until auth resolves — avoids flashing the guest email field for signed-in users. */
  const [authStatus, setAuthStatus] = useState<"loading" | "signed_in" | "signed_out">("loading")
  const [agentPreview, setAgentPreview] = useState<LiveChatUiMessage | null>(null)
  const [helpArticleStack, setHelpArticleStack] = useState<LiveChatHelpArticleRef[]>([])
  const [helpReturnTab, setHelpReturnTab] = useState<LiveChatWidgetTab>("help")
  const messagesInitRef = useRef(false)
  const handoffBootstrapRef = useRef(false)
  const lastReadAtRef = useRef(Date.now())
  const [lastReadAt, setLastReadAt] = useState(Date.now())
  const openRef = useRef(open)
  const isSupportOnlineRef = useRef(false)
  openRef.current = open

  const activeHelpArticle = helpArticleStack[helpArticleStack.length - 1] ?? null

  const session = useLiveChatSession()
  const {
    lead: supportLead,
    members: supportTeam,
    onlineMemberIds,
    isSupportOnline,
  } = useLiveChatSupportTeam(open || session.sessionReady)
  isSupportOnlineRef.current = isSupportOnline

  const handleRemoteMessage = useCallback(
    (message: Parameters<typeof session.appendMessage>[0]) => {
      if (message.sender_type === "visitor") return
      session.appendMessage(message)
      if (
        (message.sender_type === "agent" || message.sender_type === "bot") &&
        !openRef.current
      ) {
        setAgentPreview(message)
      }
    },
    [session],
  )

  // Stays subscribed while the widget is closed so agent replies surface as a preview bubble.
  useLiveChatSessionRealtime(
    session.sessionId,
    session.sessionReady,
    handleRemoteMessage,
    (status) => {
      if (status === "resolved" || status === "closed") {
        session.markSessionClosed()
      }
    },
  )

  const { typingName, publishTyping } = useLiveChatTyping({
    sessionId: session.sessionId,
    publicId: session.publicId,
    enabled:
      open &&
      tab === "messages" &&
      session.sessionReady &&
      !activeHelpArticle,
    watchParticipantType: "agent",
    participantType: "visitor",
    displayName: session.visitorDisplayName,
    visitorToken: session.visitorToken,
  })

  const resetLocalSession = session.resetLocalSession

  useEffect(() => {
    if (!open) return
    const stored = getStoredLiveChatVisitorEmail()
    setEmailDraft(stored)
    if (stored) setEmailLocked(true)
  }, [open])

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      setAuthStatus(data.user ? "signed_in" : "signed_out")
      setSignedInEmail(data.user?.email?.trim() ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, authSession) => {
      setAuthStatus(authSession?.user ? "signed_in" : "signed_out")
      setSignedInEmail(authSession?.user?.email?.trim() ?? null)
      if (event !== "SIGNED_OUT") return
      // Auth cookies clear on sign-out; live-chat resume keys do not — start fresh as guest.
      resetLocalSession()
      setEmailDraft("")
      setEmailLocked(false)
      setAgentPreview(null)
      messagesInitRef.current = false
      handoffBootstrapRef.current = false
    })
    return () => subscription.unsubscribe()
  }, [resetLocalSession])

  const sessionReady = session.sessionReady
  const sessionBootstrapping = session.bootstrapping
  const bootstrapSession = session.bootstrapSession

  const ensureChatSession = useCallback(async () => {
    // Session uses visitor_token — do not wait on auth or the composer stays dead.
    if (sessionReady || sessionBootstrapping || handoffBootstrapRef.current) return
    handoffBootstrapRef.current = true
    try {
      await bootstrapSession({ prefer: "human" })
    } finally {
      handoffBootstrapRef.current = false
    }
  }, [bootstrapSession, sessionBootstrapping, sessionReady])

  useEffect(() => {
    if (sessionReady || handoffBootstrapRef.current) return
    if (!open && tab !== "messages") return
    void ensureChatSession()
  }, [ensureChatSession, open, sessionReady, tab])

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

  function markMessagesRead() {
    const now = Date.now()
    lastReadAtRef.current = now
    setLastReadAt(now)
  }

  function openWidget() {
    setAgentPreview(null)
    setTab("messages")
    markMessagesRead()
    clearHelpArticleStack()
    setHasOpened(true)
    setOpen(true)
    void ensureChatSession()
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
    void ensureChatSession()
  }

  function changeTab(next: LiveChatWidgetTab) {
    clearHelpArticleStack()
    setTab(next)
    if (next === "messages") {
      markMessagesRead()
      void ensureChatSession()
    }
  }

  useEffect(() => {
    if (open && tab === "messages" && !activeHelpArticle) {
      markMessagesRead()
    }
  }, [activeHelpArticle, open, session.messages.length, tab])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        closeWidget()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  const isSignedIn = authStatus === "signed_in"
  const composerLocked = session.bootstrapping && !session.sessionReady

  async function handleStartNewConversation() {
    setEmailDraft("")
    setEmailLocked(false)
    setAgentPreview(null)
    messagesInitRef.current = false
    handoffBootstrapRef.current = false
    await session.startNewConversation()
  }

  async function handleSendMessage(content: string, email: string | null): Promise<boolean> {
    const sent = await session.sendMessage(content, email)
    if (sent && email && !isSignedIn) {
      setStoredLiveChatVisitorEmail(email)
      setEmailLocked(true)
    }
    return sent !== null
  }

  const showEmailField = authStatus === "signed_out"

  const lastConversationMessage =
    [...session.messages].reverse().find((m) => m.sender_type !== "system") ?? null
  const recentMessage = lastConversationMessage
    ? {
        content: lastConversationMessage.content,
        createdAt: lastConversationMessage.created_at,
        fromAgent:
          lastConversationMessage.sender_type === "agent" ||
          lastConversationMessage.sender_type === "bot",
        fromBot: lastConversationMessage.sender_type === "bot",
        senderName:
          lastConversationMessage.sender_type === "bot" ||
          lastConversationMessage.sender_type === "agent"
            ? (lastConversationMessage.agent_display_name ?? LIVE_CHAT_TEAM_NAME)
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
          aria-modal="true"
          aria-label={
            LIVE_CHAT_WIDGET_ADMIN_ONLY ? "Reswell support (admin only)" : "Reswell support"
          }
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
                onBack={() => changeTab("home")}
                serverMessages={session.messages}
                typingName={typingName}
                sending={session.sending}
                teamThinking={session.aiThinking}
                error={session.error}
                sessionClosed={session.sessionClosed}
                onStartNewConversation={() => void handleStartNewConversation()}
                composerLocked={composerLocked}
                onSendMessage={handleSendMessage}
                onPublishTyping={(isTyping) => void publishTyping(isTyping)}
                publicId={session.publicId}
                sessionId={session.sessionId}
                visitorToken={session.visitorToken}
                enableReplyRatings={LIVE_CHAT_WIDGET_ADMIN_ONLY}
                visitorEmail={signedInEmail}
                isSignedIn={isSignedIn}
                onAuthRequired={() => {
                  window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`
                }}
                showEmailField={showEmailField}
                emailDraft={emailDraft}
                emailLocked={emailLocked}
                onEmailDraftChange={setEmailDraft}
                isSupportOnline={isSupportOnline}
                supportLead={supportLead}
                supportTeam={supportTeam}
                onlineMemberIds={onlineMemberIds}
                assignedAgentId={session.assignedAgentId}
              />
            ) : null}

            {!activeHelpArticle && tab === "help" ? (
              <div className="flex items-center justify-between border-b border-border/50 bg-background px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Help guides</p>
                  <LiveChatAdminOnlyBadge />
                </div>
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
              session.messages.some(
                (m) =>
                  (m.sender_type === "agent" || m.sender_type === "bot") &&
                  new Date(m.created_at).getTime() > lastReadAt,
              ) && !(open && tab === "messages")
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
              {agentPreview.agent_display_name ?? LIVE_CHAT_TEAM_NAME}
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

      {LIVE_CHAT_WIDGET_ADMIN_ONLY && !open ? (
        <span className="pointer-events-none rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          {LIVE_CHAT_ADMIN_ONLY_LABEL}
        </span>
      ) : null}

      <button
        type="button"
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-listingHeart text-white shadow-lg transition-transform duration-200 ease-out hover:scale-105 hover:bg-listingHeart/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
        onClick={toggleWidget}
        aria-label={
          open
            ? LIVE_CHAT_WIDGET_ADMIN_ONLY
              ? "Close Reswell support (admin only)"
              : "Close Reswell support"
            : session.messages.some(
                  (m) =>
                    (m.sender_type === "agent" || m.sender_type === "bot") &&
                    new Date(m.created_at).getTime() > lastReadAt,
                )
              ? LIVE_CHAT_WIDGET_ADMIN_ONLY
                ? "Open Reswell support, unread reply (admin only)"
                : "Open Reswell support, unread reply"
              : LIVE_CHAT_WIDGET_ADMIN_ONLY
                ? "Open Reswell support (admin only)"
                : "Open Reswell support"
        }
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
