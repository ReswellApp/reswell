"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { SellersPageSellCta } from "@/components/sellers/sellers-page-sell-cta"
import { createClient } from "@/lib/supabase/client"

/**
 * ISR-safe `/sellers` viewer state. The server page is user-agnostic (same HTML
 * for everyone). After mount we hydrate the viewer id and which directory shops
 * they follow — same pattern as HomeViewerProvider.
 */
export type SellersDirectoryViewerState = {
  userId: string | null
  followingIds: string[]
  hydrated: boolean
}

const SellersDirectoryViewerContext = createContext<SellersDirectoryViewerState>({
  userId: null,
  followingIds: [],
  hydrated: false,
})

export function useSellersDirectoryViewer(): SellersDirectoryViewerState {
  return useContext(SellersDirectoryViewerContext)
}

const FOLLOW_ID_CHUNK = 100

export function SellersDirectoryViewerProvider({
  sellerIds,
  children,
}: {
  sellerIds: string[]
  children: ReactNode
}) {
  const sellerIdsKey = useMemo(
    () => Array.from(new Set(sellerIds.filter((id) => id.length > 0))).join(","),
    [sellerIds],
  )
  const [state, setState] = useState<SellersDirectoryViewerState>({
    userId: null,
    followingIds: [],
    hydrated: false,
  })

  useEffect(() => {
    let cancelled = false
    const ids = sellerIdsKey.length > 0 ? sellerIdsKey.split(",") : []

    async function hydrate() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ userId: null, followingIds: [], hydrated: true })
        return
      }

      const followingIds: string[] = []
      for (let offset = 0; offset < ids.length; offset += FOLLOW_ID_CHUNK) {
        const chunk = ids.slice(offset, offset + FOLLOW_ID_CHUNK)
        const { data } = await supabase
          .from("seller_follows")
          .select("seller_id")
          .eq("follower_id", user.id)
          .in("seller_id", chunk)
        if (cancelled) return
        for (const row of data ?? []) followingIds.push(row.seller_id)
      }

      if (cancelled) return
      setState({ userId: user.id, followingIds, hydrated: true })
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [sellerIdsKey])

  return (
    <SellersDirectoryViewerContext.Provider value={state}>
      {children}
    </SellersDirectoryViewerContext.Provider>
  )
}

/** Anonymous sell banner. Hidden after hydration when a viewer is signed in. */
export function SellersDirectoryGuestSellCta() {
  const { userId, hydrated } = useSellersDirectoryViewer()
  if (hydrated && userId) return null

  return (
    <div className="border-t border-border/60">
      <SellersPageSellCta />
    </div>
  )
}
