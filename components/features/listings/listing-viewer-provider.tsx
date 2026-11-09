"use client"

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { readSupabaseBrowserUserId } from "@/lib/auth/supabase-browser-user-id"
import { loadListingPrivateChrome } from "@/lib/actions/listing-private-chrome"
import type { ListingPrivateChrome } from "@/lib/listing-private-chrome"
import { listingViewerIsOwner } from "@/lib/listing-owner-view"
import { createClient } from "@/lib/supabase/client"

type ListingViewerValue = {
  userId: string | null
  ready: boolean
  sellerUserId: string | null
  listingId: string | null
  /** Owner or admin payload. Null in the shared document and for other shoppers. */
  privateChrome: ListingPrivateChrome | null
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
 * anonymous. A layout effect reads the browser session before paint so the
 * seller sees their own controls without those controls existing in the shared HTML.
 */
export function ListingViewerProvider({
  sellerUserId,
  listingId = null,
  children,
}: {
  sellerUserId: string | null
  listingId?: string | null
  children: ReactNode
}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [privateChrome, setPrivateChrome] = useState<ListingPrivateChrome | null>(null)

  // Cookie read happens after hydration so the shared HTML stays the buyer page,
  // and before paint so the owner does not see that buyer page first.
  useLayoutEffect(() => {
    const id = readSupabaseBrowserUserId()
    if (id) setUserId(id)
  }, [])

  useEffect(() => {
    if (!hasSupabaseAuthCookiesClient()) {
      setReady(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await createClient().auth.getUser()
        if (cancelled) return
        const confirmed = data.user?.id ?? null
        setUserId(confirmed)
        if (!listingId || !confirmed) {
          setPrivateChrome(null)
          return
        }
        const chrome = await loadListingPrivateChrome(listingId)
        if (!cancelled) setPrivateChrome(chrome)
      } catch {
        // Keep the cookie-derived id. A failed confirm must not flash the buyer page
        // back over a seller who already painted their controls.
        if (!cancelled) setPrivateChrome(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [listingId])

  return (
    <ListingViewerContext.Provider value={{ userId, ready, sellerUserId, listingId, privateChrome }}>
      {children}
    </ListingViewerContext.Provider>
  )
}

export function useListingViewer(): ListingViewerValue | null {
  return useContext(ListingViewerContext)
}

export function useListingOwner(): boolean {
  const viewer = useListingViewer()
  return listingViewerIsOwner(viewer?.userId, viewer?.sellerUserId)
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
