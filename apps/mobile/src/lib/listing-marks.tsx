import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { fetchFavorites } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type ListingMarksValue = {
  favorited: ReadonlySet<string>
  setFavorited: (listingId: string, favorited: boolean) => void
}

const EMPTY_FAVORITES: ReadonlySet<string> = new Set()

const EMPTY_MARKS: ListingMarksValue = {
  favorited: EMPTY_FAVORITES,
  setFavorited: () => undefined,
}

const ListingMarksContext = createContext<ListingMarksValue | null>(null)

/** Saved listing ids for the signed-in user, so tile hearts match the favorites API. */
export function ListingMarksProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [favorited, setFavoritedIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!token) {
      setFavoritedIds(new Set())
      return
    }
    let cancelled = false
    fetchFavorites(token)
      .then((page) => {
        if (cancelled) return
        const server = new Set(page.favorites.map((favorite) => favorite.listing.id))
        setFavoritedIds((current) => {
          for (const id of current) server.add(id)
          return server
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token])

  const setFavorited = useCallback((listingId: string, next: boolean) => {
    setFavoritedIds((current) => {
      const ids = new Set(current)
      if (next) ids.add(listingId)
      else ids.delete(listingId)
      return ids
    })
  }, [])

  const value = useMemo(() => ({ favorited, setFavorited }), [favorited, setFavorited])
  return <ListingMarksContext.Provider value={value}>{children}</ListingMarksContext.Provider>
}

export function useListingMarks(): ListingMarksValue {
  const value = useContext(ListingMarksContext)
  if (!value) return EMPTY_MARKS
  return value
}
