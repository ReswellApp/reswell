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
import type { InboxConversationRow } from "@/lib/utils/messages-inbox-grouping"

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
      window.dispatchEvent(new CustomEvent("unreadCountRefresh"))
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        void refreshInbox().catch(() => {})
      }, 300)
    }

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
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
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
