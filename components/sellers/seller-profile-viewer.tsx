"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * ISR-safe seller profile viewer state. The server page is user-agnostic.
 * After mount we hydrate follow state, favorites, and whether this is the
 * viewer's own shop — same pattern as SellersDirectoryViewerProvider.
 */
export type SellerProfileViewerState = {
  userId: string | null
  isFollowing: boolean
  favoritedIds: string[]
  hydrated: boolean
}

const SellerProfileViewerContext = createContext<SellerProfileViewerState>({
  userId: null,
  isFollowing: false,
  favoritedIds: [],
  hydrated: false,
})

export function useSellerProfileViewer(): SellerProfileViewerState {
  return useContext(SellerProfileViewerContext)
}

const FAVORITE_ID_CHUNK = 100

export function SellerProfileViewerProvider({
  sellerId,
  listingIds,
  children,
}: {
  sellerId: string
  listingIds: string[]
  children: ReactNode
}) {
  const listingIdsKey = useMemo(
    () => Array.from(new Set(listingIds.filter((id) => id.length > 0))).join(","),
    [listingIds],
  )
  const [state, setState] = useState<SellerProfileViewerState>({
    userId: null,
    isFollowing: false,
    favoritedIds: [],
    hydrated: false,
  })

  useEffect(() => {
    let cancelled = false
    const ids = listingIdsKey.length > 0 ? listingIdsKey.split(",") : []

    async function hydrate() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ userId: null, isFollowing: false, favoritedIds: [], hydrated: true })
        return
      }

      const favoritedIds: string[] = []
      const favoritesPromise = (async () => {
        for (let offset = 0; offset < ids.length; offset += FAVORITE_ID_CHUNK) {
          const chunk = ids.slice(offset, offset + FAVORITE_ID_CHUNK)
          const { data } = await supabase
            .from("favorites")
            .select("listing_id")
            .eq("user_id", user.id)
            .in("listing_id", chunk)
          if (cancelled) return
          for (const row of data ?? []) favoritedIds.push(row.listing_id)
        }
      })()

      const followPromise =
        user.id === sellerId
          ? Promise.resolve(false)
          : supabase
              .from("seller_follows")
              .select("seller_id")
              .eq("follower_id", user.id)
              .eq("seller_id", sellerId)
              .maybeSingle()
              .then(({ data }) => Boolean(data))

      const [, isFollowing] = await Promise.all([favoritesPromise, followPromise])
      if (cancelled) return
      setState({ userId: user.id, isFollowing, favoritedIds, hydrated: true })
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [listingIdsKey, sellerId])

  return (
    <SellerProfileViewerContext.Provider value={state}>{children}</SellerProfileViewerContext.Provider>
  )
}
