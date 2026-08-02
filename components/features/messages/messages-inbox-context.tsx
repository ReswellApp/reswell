"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import { refreshMessagesInbox } from "@/app/actions/messages"
import {
  markConversationMessagesReadLocally,
  type InboxConversationRow,
} from "@/lib/utils/messages-inbox-grouping"
import {
  CONVERSATION_THREAD_OPENED_EVENT,
  MESSAGES_INBOX_REFRESH_EVENT,
  UNREAD_COUNT_REFRESH_EVENT,
  type ConversationThreadOpenedDetail,
} from "@/lib/utils/unread-message-count-events"

interface MessagesInboxContextValue {
  currentUserId: string
  conversations: InboxConversationRow[]
  notifications: MessagesInboxNotification[]
  messageSmsOptIn: boolean
  hasSmsPhone: boolean
  smsPhone: string | null
  refreshInbox: () => Promise<void>
}

const MessagesInboxContext = createContext<MessagesInboxContextValue | null>(null)

export function useMessagesInbox(): MessagesInboxContextValue {
  const ctx = useContext(MessagesInboxContext)
  if (!ctx) {
    throw new Error("useMessagesInbox must be used within MessagesInboxProvider")
  }
  return ctx
}

interface MessagesInboxProviderProps {
  userId: string
  initialConversations: InboxConversationRow[]
  initialNotifications: MessagesInboxNotification[]
  initialMessageSmsOptIn?: boolean
  initialHasSmsPhone?: boolean
  initialSmsPhone?: string | null
  children: ReactNode
}

export function MessagesInboxProvider({
  userId,
  initialConversations,
  initialNotifications,
  initialMessageSmsOptIn = false,
  initialHasSmsPhone = false,
  initialSmsPhone = null,
  children,
}: MessagesInboxProviderProps) {
  const supabase = useMemo(() => createClient(), [])
  const [conversations, setConversations] = useState(initialConversations)
  const [notifications, setNotifications] = useState(initialNotifications)

  useEffect(() => {
    setConversations(initialConversations)
    setNotifications(initialNotifications)
  }, [initialConversations, initialNotifications])

  const refreshInbox = useCallback(async () => {
    const fresh = await refreshMessagesInbox()
    if ("error" in fresh) return
    setConversations(fresh.conversations)
    setNotifications(fresh.notifications)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(UNREAD_COUNT_REFRESH_EVENT))
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        void refreshInbox().catch(() => {})
      }, 300)
    }

    const onThreadOpened = (event: Event) => {
      const detail = (event as CustomEvent<ConversationThreadOpenedDetail>).detail
      if (!detail?.conversationId) return
      // Optimistic only — server reconcile waits for mark-read (MESSAGES_INBOX_REFRESH).
      setConversations((prev) =>
        markConversationMessagesReadLocally(prev, detail.conversationId, userId),
      )
    }

    const onInboxRefresh = () => {
      scheduleRefresh()
    }

    window.addEventListener(CONVERSATION_THREAD_OPENED_EVENT, onThreadOpened)
    window.addEventListener(MESSAGES_INBOX_REFRESH_EVENT, onInboxRefresh)

    const channels = (["buyer_id", "seller_id"] as const).map((column) =>
      supabase
        .channel(`inbox:${column}:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `${column}=eq.${userId}`,
          },
          scheduleRefresh,
        )
        .subscribe(),
    )

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      window.removeEventListener(CONVERSATION_THREAD_OPENED_EVENT, onThreadOpened)
      window.removeEventListener(MESSAGES_INBOX_REFRESH_EVENT, onInboxRefresh)
      for (const channel of channels) void supabase.removeChannel(channel)
    }
  }, [userId, supabase, refreshInbox])

  const value = useMemo(
    () => ({
      currentUserId: userId,
      conversations,
      notifications,
      messageSmsOptIn: initialMessageSmsOptIn,
      hasSmsPhone: initialHasSmsPhone,
      smsPhone: initialSmsPhone,
      refreshInbox,
    }),
    [
      userId,
      conversations,
      notifications,
      initialMessageSmsOptIn,
      initialHasSmsPhone,
      initialSmsPhone,
      refreshInbox,
    ],
  )

  return (
    <MessagesInboxContext.Provider value={value}>{children}</MessagesInboxContext.Provider>
  )
}
