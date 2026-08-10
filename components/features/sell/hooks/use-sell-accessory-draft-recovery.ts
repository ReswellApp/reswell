"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { createClient } from "@/lib/supabase/client"
import {
  clearGuestSellListingDraft,
  clearSellListingDraft,
  loadGuestSellListingDraft,
  loadSellListingDraft,
  migrateGuestSellListingDraftToUser,
  type SellListingDraftFormSnapshot,
  type SellListingDraftListingType,
} from "@/lib/sell-listing-draft-idb"
import {
  listingPhotoSlotsFromDraftBlobs,
  type ListingPhotoSlot,
} from "@/lib/sell-flow/listing-photo-slot"
import { persistListingDraftSnapshot } from "@/lib/sell-flow/persist-listing-draft-snapshot"

export type UseSellAccessoryDraftRecoveryOptions = {
  listingType: SellListingDraftListingType
  /** Editing an existing listing — recovery is disabled (server row is the source of truth). */
  editId: string | null
  /** `?new=1` — discard any stashed draft and start blank. */
  startFresh: boolean
  /** Current form values — must be JSON-serializable. */
  formSnapshot: SellListingDraftFormSnapshot
  /** Photo slots from `useListingPhotoUpload`. */
  images: ListingPhotoSlot[]
  /** Apply a restored snapshot onto the form state. */
  onRestoreForm: (snapshot: SellListingDraftFormSnapshot) => void
  /** `setImages` from `useListingPhotoUpload` — restored slots are injected here. */
  setImages: React.Dispatch<React.SetStateAction<ListingPhotoSlot[]>>
  /** `handlePhotoTileRetry` from `useListingPhotoUpload` — kicks optimize+upload per restored slot. */
  retryPhotoSlot: (clientId: string) => void
  /** Checked at restore time — return true to keep autosaving but skip applying the stash (e.g. a fresh catalog handoff outranks an old draft). */
  skipRestore?: () => boolean
}

/**
 * Refresh/crash recovery for accessory-style sell forms (wetsuits, apparel,
 * bags, …): the in-progress listing (fields + photo files) is autosaved to
 * IndexedDB and silently restored on the next visit, matching the safety the
 * board and fin flows already have. Call `clearRecoveredDraft` after a
 * successful publish so the stash never resurrects a published listing.
 */
export function useSellAccessoryDraftRecovery({
  listingType,
  editId,
  startFresh,
  formSnapshot,
  images,
  onRestoreForm,
  setImages,
  retryPhotoSlot,
  skipRestore,
}: UseSellAccessoryDraftRecoveryOptions): {
  draftHydrated: boolean
  clearRecoveredDraft: () => Promise<void>
  flushDraftNow: (opts?: { includeInFlightPhotos?: boolean }) => Promise<void>
} {
  const supabaseRef = useRef(createClient())
  const [draftHydrated, setDraftHydrated] = useState(false)
  const userIdRef = useRef<string | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Restored slot ids awaiting their upload kick (imagesRef syncs on render). */
  const pendingRetryClientIdsRef = useRef<string[] | null>(null)

  const latestRef = useRef({ formSnapshot, images, editId, draftHydrated })
  latestRef.current = { formSnapshot, images, editId, draftHydrated }

  // Restore (or discard on ?new=1) exactly once per mount.
  useEffect(() => {
    if (editId) {
      setDraftHydrated(true)
      return
    }
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabaseRef.current.auth.getUser()
      userIdRef.current = user?.id ?? null

      if (startFresh) {
        if (user?.id) await clearSellListingDraft(user.id, listingType)
        await clearGuestSellListingDraft(listingType)
        if (!cancelled) setDraftHydrated(true)
        return
      }

      if (user?.id) await migrateGuestSellListingDraftToUser(user.id, listingType)
      const record = skipRestore?.()
        ? null
        : user?.id
          ? await loadSellListingDraft(user.id, listingType)
          : await loadGuestSellListingDraft(listingType)

      if (record && !cancelled) {
        onRestoreForm(record.formData)
        const restored = listingPhotoSlotsFromDraftBlobs(record.imageBlobs)
        if (restored.length) {
          pendingRetryClientIdsRef.current = restored.map((s) => s.clientId)
          setImages(restored)
        }
      }
      if (!cancelled) setDraftHydrated(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, listingType, startFresh])

  // Kick optimize+upload for restored slots once they're committed to state.
  useEffect(() => {
    const pending = pendingRetryClientIdsRef.current
    if (!pending?.length) return
    const present = pending.filter((id) => images.some((s) => s.clientId === id))
    if (!present.length) return
    pendingRetryClientIdsRef.current = null
    for (const id of present) retryPhotoSlot(id)
  }, [images, retryPhotoSlot])

  // Track auth so guest drafts follow the user through sign-in.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      userIdRef.current = uid
      if (uid) {
        void migrateGuestSellListingDraftToUser(uid, listingType)
        void import("@/lib/sell-flow/claim-guest-listing-drafts").then(({ claimGuestListingDraftsClient }) =>
          claimGuestListingDraftsClient(),
        )
      }
    })
    return () => subscription.unsubscribe()
  }, [listingType])

  const flushDraftNow = useCallback(
    async (opts?: { includeInFlightPhotos?: boolean }) => {
      const r = latestRef.current
      if (r.editId || !r.draftHydrated) return
      await persistListingDraftSnapshot({
        listingType,
        formData: r.formSnapshot,
        images: r.images,
        userId: userIdRef.current,
        includeInFlightPhotos: opts?.includeInFlightPhotos,
      })
    },
    [listingType],
  )

  // Debounced autosave on any form/photo change.
  useEffect(() => {
    if (editId || !draftHydrated) return
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null
      void flushDraftNow()
    }, 600)
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [draftHydrated, editId, flushDraftNow, formSnapshot, images])

  // Flush when the tab hides/closes so a hard refresh never loses work.
  useEffect(() => {
    if (editId || !draftHydrated) return
    const flush = () => void flushDraftNow()
    const onVis = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [draftHydrated, editId, flushDraftNow])

  const clearRecoveredDraft = useCallback(async () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    if (userIdRef.current) await clearSellListingDraft(userIdRef.current, listingType)
    await clearGuestSellListingDraft(listingType)
  }, [listingType])

  return { draftHydrated, clearRecoveredDraft, flushDraftNow }
}
