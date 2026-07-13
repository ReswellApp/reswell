"use client"

import { createContext, useContext, type ReactNode } from "react"
import {
  useBoardTalkPresence,
  type BoardTalkPresenceEntry,
} from "@/components/features/forum/hooks/use-board-talk-presence"

type ThreadsPresenceContextValue = {
  members: BoardTalkPresenceEntry[]
  guestCount: number
  total: number
}

const ThreadsPresenceContext = createContext<ThreadsPresenceContextValue | null>(null)

export function ThreadsPresenceProvider({
  userId,
  displayName,
  children,
}: {
  userId: string | null
  displayName: string | null
  children: ReactNode
}) {
  const presence = useBoardTalkPresence(displayName, userId)

  return (
    <ThreadsPresenceContext.Provider value={presence}>{children}</ThreadsPresenceContext.Provider>
  )
}

export function useThreadsPresence(): ThreadsPresenceContextValue {
  const ctx = useContext(ThreadsPresenceContext)
  if (!ctx) {
    return { members: [], guestCount: 0, total: 0 }
  }
  return ctx
}
