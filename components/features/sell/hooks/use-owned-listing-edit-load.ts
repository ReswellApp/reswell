"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { toast } from "sonner"

import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import { fetchOwnedListingForSellEditClient } from "@/lib/sell-flow/fetch-owned-listing-for-edit-client"

export type OwnedListingEditHydrateResult =
  | { status: "ready" }
  /** Caller already toasted / navigated (sold, wrong section, etc.). */
  | { status: "handled" }

export type UseOwnedListingEditLoadOptions = {
  editId: string | null
  supabase: SupabaseClient
  /** Path passed to the sign-in gate when the session is missing. */
  signInReturnPath: string
  openSignIn: (redirect?: string | null) => void
  /** Blank create route for this section (e.g. `/sell/wetsuits`). */
  notFoundRedirectHref: string
  router: { replace: (href: string, options?: { scroll?: boolean }) => void }
  /** Optional cleanup before the default not-found toast + redirect (e.g. clear local draft id). */
  onNotFound?: () => void
  /**
   * Map the fetched listing into local form state.
   * Return `{ status: "handled" }` when this callback already redirected / toasted.
   */
  onHydrate: (
    listing: OwnedListingForEditRow,
    userId: string,
  ) => OwnedListingEditHydrateResult | Promise<OwnedListingEditHydrateResult>
}

export type UseOwnedListingEditLoadResult = {
  editLoading: boolean
  /**
   * Whether to swap the form for a loading skeleton. Immediate on the first
   * load (deep links land on an empty form), but delayed on subsequent edit-id
   * switches so fast draft opens keep the current form in place — no skeleton
   * flash / page bounce.
   */
  showEditSkeleton: boolean
  editLoadError: string | null
  retryEditLoad: () => void
}

/** Soft draft switches only reveal the skeleton once the load is genuinely slow. */
const EDIT_SKELETON_REVEAL_DELAY_MS = 400

function errorMessageForReason(reason: "timeout" | "error"): string {
  if (reason === "timeout") {
    return "Loading timed out. Check your connection and try again."
  }
  return "Couldn’t load this listing. Try again."
}

/**
 * Shared edit-listing fetch lifecycle: always clears loading, surfaces retryable
 * errors, and opens the sign-in gate on 401 — without multi-second session polling.
 */
export function useOwnedListingEditLoad(
  options: UseOwnedListingEditLoadOptions,
): UseOwnedListingEditLoadResult {
  const {
    editId,
    supabase,
    signInReturnPath,
    openSignIn,
    notFoundRedirectHref,
    router,
    onNotFound,
    onHydrate,
  } = options

  const [editLoading, setEditLoading] = useState(Boolean(editId))
  const [showEditSkeleton, setShowEditSkeleton] = useState(Boolean(editId))
  const [editLoadError, setEditLoadError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const hasLoadedOnceRef = useRef(false)

  const onHydrateRef = useRef(onHydrate)
  onHydrateRef.current = onHydrate
  const openSignInRef = useRef(openSignIn)
  openSignInRef.current = openSignIn
  const onNotFoundRef = useRef(onNotFound)
  onNotFoundRef.current = onNotFound

  const retryEditLoad = useCallback(() => {
    setEditLoadError(null)
    setRetryNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!editId) {
      setEditLoading(false)
      setShowEditSkeleton(false)
      setEditLoadError(null)
      return
    }

    const controller = new AbortController()
    let mounted = true
    setEditLoading(true)
    setEditLoadError(null)

    let skeletonRevealTimer: number | undefined
    if (!hasLoadedOnceRef.current) {
      setShowEditSkeleton(true)
    } else {
      skeletonRevealTimer = window.setTimeout(() => {
        if (mounted && !controller.signal.aborted) setShowEditSkeleton(true)
      }, EDIT_SKELETON_REVEAL_DELAY_MS)
    }
    hasLoadedOnceRef.current = true

    void (async () => {
      try {
        const owned = await fetchOwnedListingForSellEditClient(supabase, editId, {
          signal: controller.signal,
        })
        if (!mounted || controller.signal.aborted) return

        if (!owned.ok) {
          if (owned.reason === "unauthorized") {
            setEditLoading(false)
            openSignInRef.current(signInReturnPath)
            return
          }
          if (owned.reason === "not_found") {
            onNotFoundRef.current?.()
            toast.error("Listing not found or cannot be edited")
            router.replace(notFoundRedirectHref, { scroll: false })
            setEditLoading(false)
            return
          }
          setEditLoadError(errorMessageForReason(owned.reason))
          return
        }

        const result = await onHydrateRef.current(owned.listing, owned.userId)
        if (!mounted || controller.signal.aborted) return
        if (result.status === "handled") return
      } catch {
        if (!mounted || controller.signal.aborted) return
        setEditLoadError(errorMessageForReason("error"))
      } finally {
        if (mounted && !controller.signal.aborted) {
          if (skeletonRevealTimer != null) window.clearTimeout(skeletonRevealTimer)
          setEditLoading(false)
          setShowEditSkeleton(false)
        }
      }
    })()

    return () => {
      mounted = false
      controller.abort()
      if (skeletonRevealTimer != null) window.clearTimeout(skeletonRevealTimer)
    }
  }, [editId, notFoundRedirectHref, retryNonce, router, signInReturnPath, supabase])

  return { editLoading, showEditSkeleton, editLoadError, retryEditLoad }
}
