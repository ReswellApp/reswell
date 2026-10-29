import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { AppState } from "react-native"
import { fetchInbox } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type InboxUnreadValue = {
  count: number
  reload: () => void
  sync: (count: number) => void
  adjust: (delta: number) => void
}

const InboxUnreadContext = createContext<InboxUnreadValue | null>(null)

/** Header inbox badge from GET /api/mobile/v1/me/inbox `unread_count` (website ticker). */
export function InboxUnreadProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [count, setCount] = useState(0)

  const sync = useCallback((next: number) => {
    setCount(Math.max(0, next))
  }, [])

  const adjust = useCallback((delta: number) => {
    setCount((current) => Math.max(0, current + delta))
  }, [])

  const reload = useCallback(() => {
    if (!token) {
      setCount(0)
      return
    }
    fetchInbox(token)
      .then((inbox) => setCount(inbox.unread_count))
      .catch(() => undefined)
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload()
    })
    return () => subscription.remove()
  }, [reload])

  const value = useMemo(() => ({ count, reload, sync, adjust }), [count, reload, sync, adjust])
  return <InboxUnreadContext.Provider value={value}>{children}</InboxUnreadContext.Provider>
}

export function useInboxUnreadCount(): number {
  return useContext(InboxUnreadContext)?.count ?? 0
}

export function useInboxUnreadReload(): () => void {
  return useContext(InboxUnreadContext)?.reload ?? (() => undefined)
}

export function useSyncInboxUnreadCount(): (count: number) => void {
  return useContext(InboxUnreadContext)?.sync ?? (() => undefined)
}

export function useInboxUnreadAdjust(): (delta: number) => void {
  return useContext(InboxUnreadContext)?.adjust ?? (() => undefined)
}
