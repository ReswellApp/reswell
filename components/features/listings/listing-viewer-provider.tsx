"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { readSupabaseBrowserUserId } from "@/lib/auth/supabase-browser-user-id"
import { loadListingPrivateChrome } from "@/lib/actions/listing-private-chrome"
import type { ListingPrivateChrome } from "@/lib/listing-private-chrome"
import { listingViewerIsOwner } from "@/lib/listing-owner-view"
import { createClient } from "@/lib/supabase/client"
import { resolveHydratedIsLoggedIn } from "@/lib/auth/hydrated-is-logged-in"
import { LISTING_BUYER_OPEN_OFFER_STATUSES } from "@/lib/utils/offer-messages-href"
import { dashboardOffersPath } from "@/lib/utils/offers-dashboard-display"

type ListingViewerValue = {
  userId: string | null
  ready: boolean
  sellerUserId: string | null
  listingId: string | null
  /** Owner or admin payload. Null in the shared document and for other shoppers. */
  privateChrome: ListingPrivateChrome | null
  listingInCart: boolean
  markListingInCart: (inCart: boolean) => void
  openOfferHref: string | null
  markOpenOfferHref: (href: string | null) => void
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

function loadListingInBuyerCart(userId: string, listingId: string): Promise<boolean> {
  return createClient()
    .from("cart_items")
    .select("id")
    .eq("profile_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle()
    .then(({ data }) => Boolean(data))
    .catch(() => false)
}

function loadListingOpenOfferHref(userId: string, listingId: string): Promise<string | null> {
  return createClient()
    .from("offers")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", userId)
    .in("status", [...LISTING_BUYER_OPEN_OFFER_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then(({ data }) => {
      const offerId = data && typeof data.id === "string" ? data.id : null
      return offerId ? dashboardOffersPath({ role: "buyer", offerId }) : null
    })
    .catch(() => null)
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
  const [listingInCart, setListingInCart] = useState(false)
  const [openOfferHref, setOpenOfferHref] = useState<string | null>(null)
  const cartQuerySeq = useRef(0)
  const offerQuerySeq = useRef(0)
  const markListingInCart = useCallback((inCart: boolean) => {
    cartQuerySeq.current += 1
    setListingInCart(inCart)
  }, [])
  const markOpenOfferHref = useCallback((href: string | null) => {
    offerQuerySeq.current += 1
    setOpenOfferHref(href)
  }, [])

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

  useEffect(() => {
    // Cached /l HTML is anonymous. After the session hydrates, the PDP cart
    // and offer buttons reflect whether this listing is already in the buyer's
    // cart or they have an open offer.
    if (!userId || !listingId || listingViewerIsOwner(userId, sellerUserId)) {
      cartQuerySeq.current += 1
      offerQuerySeq.current += 1
      setListingInCart(false)
      setOpenOfferHref(null)
      return
    }
    const buyerId = userId
    const id = listingId
    let cancelled = false
    setListingInCart(false)
    setOpenOfferHref(null)
    async function loadCart() {
      const seq = ++cartQuerySeq.current
      const inCart = await loadListingInBuyerCart(buyerId, id)
      if (!cancelled && seq === cartQuerySeq.current) setListingInCart(inCart)
    }
    async function loadOffer() {
      const seq = ++offerQuerySeq.current
      const href = await loadListingOpenOfferHref(buyerId, id)
      if (!cancelled && seq === offerQuerySeq.current) setOpenOfferHref(href)
    }
    void loadCart()
    void loadOffer()
    function onCartUpdated() {
      void loadCart()
    }
    window.addEventListener("cartUpdated", onCartUpdated)
    return () => {
      cancelled = true
      window.removeEventListener("cartUpdated", onCartUpdated)
    }
  }, [userId, listingId, sellerUserId])

  return (
    <ListingViewerContext.Provider
      value={{
        userId,
        ready,
        sellerUserId,
        listingId,
        privateChrome,
        listingInCart,
        markListingInCart,
        openOfferHref,
        markOpenOfferHref,
      }}
    >
      {children}
    </ListingViewerContext.Provider>
  )
}

export function useListingViewer(): ListingViewerValue | null {
  return useContext(ListingViewerContext)
}

/** Whether this listing is already in the signed-in buyer's cart. */
export function useListingInCart(): {
  inCart: boolean
  markInCart: (value: boolean) => void
} {
  const viewer = useListingViewer()
  const [fallback, setFallback] = useState(false)
  const markFallback = useCallback((value: boolean) => {
    setFallback(value)
  }, [])
  if (!viewer) {
    return { inCart: fallback, markInCart: markFallback }
  }
  return { inCart: viewer.listingInCart, markInCart: viewer.markListingInCart }
}

/** Open buyer offer on this listing, if the signed-in viewer has one. */
export function useListingOpenOffer(): {
  href: string | null
  markHref: (href: string | null) => void
} {
  const viewer = useListingViewer()
  const [fallback, setFallback] = useState<string | null>(null)
  const markFallback = useCallback((href: string | null) => {
    setFallback(href)
  }, [])
  if (!viewer) {
    return { href: fallback, markHref: markFallback }
  }
  return { href: viewer.openOfferHref, markHref: viewer.markOpenOfferHref }
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
    if (serverIsLoggedIn || viewer?.userId) return
    if (!hasSupabaseAuthCookiesClient()) return
    let cancelled = false
    void browserHasSession().then((loggedIn) => {
      if (!cancelled) setClientLoggedIn(loggedIn)
    })
    return () => {
      cancelled = true
    }
  }, [serverIsLoggedIn, viewer?.userId])

  return resolveHydratedIsLoggedIn({
    serverIsLoggedIn,
    viewerUserId: viewer?.userId,
    clientLoggedIn,
  })
}
