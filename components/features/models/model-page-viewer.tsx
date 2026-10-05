"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  SaveEntitySearchButton,
  type SaveEntitySearchButtonProps,
} from "@/components/features/saved-search/save-entity-search-button"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { createClient } from "@/lib/supabase/client"
import { findSavedSearchForModel } from "@/lib/utils/saved-search-alert-kind"
import {
  BOARD_SAVED_SEARCHES_MAX,
  type BoardSavedSearchCriteria,
} from "@/lib/validations/boardSavedSearch"

type ModelPageViewerState = {
  userId: string | null
  isLoggedIn: boolean
  favoritedIds: string[]
  savedSearchId: string | null
  ready: boolean
}

const EMPTY_VIEWER: ModelPageViewerState = {
  userId: null,
  isLoggedIn: false,
  favoritedIds: [],
  savedSearchId: null,
  ready: false,
}

const ModelPageViewerContext = createContext<ModelPageViewerState>(EMPTY_VIEWER)

export function useModelPageViewer(): ModelPageViewerState {
  return useContext(ModelPageViewerContext)
}

function savedSearchRows(
  data: unknown,
): Array<{ id: string; criteria: BoardSavedSearchCriteria }> {
  if (!Array.isArray(data)) return []
  const rows: Array<{ id: string; criteria: BoardSavedSearchCriteria }> = []
  for (const row of data) {
    if (!row || typeof row !== "object") continue
    const id = "id" in row && typeof row.id === "string" ? row.id : ""
    const criteria =
      "criteria" in row && row.criteria && typeof row.criteria === "object"
        ? (row.criteria as BoardSavedSearchCriteria)
        : null
    if (!id || !criteria) continue
    rows.push({ id, criteria })
  }
  return rows
}

/**
 * Model pages are one cached document for every visitor. After paint, fill
 * hearts and "Save this model" from the browser session.
 */
export function ModelPageViewerProvider({
  listingIds,
  brandModelId,
  children,
}: {
  listingIds: string[]
  brandModelId: string
  children: ReactNode
}) {
  const listingIdsKey = useMemo(() => {
    const ids = new Set<string>()
    for (const id of listingIds) {
      if (id.length > 0) ids.add(id)
    }
    return Array.from(ids).join(",")
  }, [listingIds])
  const [state, setState] = useState<ModelPageViewerState>(EMPTY_VIEWER)

  useEffect(() => {
    if (!hasSupabaseAuthCookiesClient()) {
      setState({ ...EMPTY_VIEWER, ready: true })
      return
    }

    let cancelled = false
    const ids = listingIdsKey.length > 0 ? listingIdsKey.split(",") : []

    async function hydrate() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({
          userId: null,
          isLoggedIn: false,
          favoritedIds: [],
          savedSearchId: null,
          ready: true,
        })
        return
      }

      const [favoritesRes, searchesRes] = await Promise.all([
        ids.length > 0
          ? supabase
              .from("favorites")
              .select("listing_id")
              .eq("user_id", user.id)
              .in("listing_id", ids)
          : Promise.resolve({ data: [] as { listing_id: string }[] | null }),
        supabase
          .from("saved_searches")
          .select("id, criteria")
          .eq("user_id", user.id)
          .limit(BOARD_SAVED_SEARCHES_MAX),
      ])
      if (cancelled) return

      setState({
        userId: user.id,
        isLoggedIn: true,
        favoritedIds: (favoritesRes.data ?? []).map((row) => row.listing_id),
        savedSearchId:
          findSavedSearchForModel(savedSearchRows(searchesRes.data), brandModelId)?.id ?? null,
        ready: true,
      })
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [brandModelId, listingIdsKey])

  return (
    <ModelPageViewerContext.Provider value={state}>{children}</ModelPageViewerContext.Provider>
  )
}

type ModelSaveModelButtonProps = Omit<
  SaveEntitySearchButtonProps,
  "isLoggedIn" | "initialSavedSearchId"
>

/** Header save control. Logged-in state arrives after the cached shell paints. */
export function ModelSaveModelButton(props: ModelSaveModelButtonProps) {
  const viewer = useModelPageViewer()
  return (
    <SaveEntitySearchButton
      {...props}
      isLoggedIn={viewer.ready ? viewer.isLoggedIn : false}
      initialSavedSearchId={viewer.ready ? viewer.savedSearchId : null}
    />
  )
}
