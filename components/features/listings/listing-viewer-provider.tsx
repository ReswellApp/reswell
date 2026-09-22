"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { createClient } from "@/lib/supabase/client"

type ListingViewerValue = {
  userId: string | null
  ready: boolean
  sellerUserId: string | null
}

const ListingViewerContext = createContext<ListingViewerValue | null>(null)

let browserSessionLoggedIn: Promise<boolean> | null = null

function browserHasSession(): Promise<boolean> {
  if (!hasSupabaseAuthCookiesClient()) return Promise.resolve(false)
  if (!browserSessionLoggedIn) {
    browserSessionLoggedIn = createClient()
      .auth.getUser()
      .then(({ data }) => Boolean(data.user))
      .catch(() => false)
  }
  return browserSessionLoggedIn
}

/**
 * Signed-in identity for a cached listing page. The server render stays
 * anonymous; this fills after paint when the browser has a session.
 */
export function ListingViewerProvider({
  sellerUserId,
  children,
}: {
  sellerUserId: string | null
  children: ReactNode
}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!hasSupabaseAuthCookiesClient()) {
      setReady(true)
      return
    }
    let cancelled = false
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled) return
        setUserId(data.user?.id ?? null)
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ListingViewerContext.Provider value={{ userId, ready, sellerUserId }}>
      {children}
    </ListingViewerContext.Provider>
  )
}

export function useListingViewer(): ListingViewerValue | null {
  return useContext(ListingViewerContext)
}

/** Server `isLoggedIn` plus the cached-page session, without a second auth read inside the provider. */
export function useHydratedIsLoggedIn(serverIsLoggedIn: boolean): boolean {
  const viewer = useListingViewer()
  const [clientLoggedIn, setClientLoggedIn] = useState(serverIsLoggedIn)

  useEffect(() => {
    if (serverIsLoggedIn || viewer) return
    if (!hasSupabaseAuthCookiesClient()) return
    let cancelled = false
    void browserHasSession().then((loggedIn) => {
      if (!cancelled) setClientLoggedIn(loggedIn)
    })
    return () => {
      cancelled = true
    }
  }, [serverIsLoggedIn, viewer])

  if (serverIsLoggedIn) return true
  if (viewer) return Boolean(viewer.userId)
  return clientLoggedIn
}
