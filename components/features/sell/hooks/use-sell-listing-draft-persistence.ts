"use client"

import { useEffect, useRef } from "react"
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
import { listingPhotoSlotsFromDraftBlobs } from "@/lib/sell-flow/listing-photo-slot"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import { persistListingDraftSnapshot } from "@/lib/sell-flow/persist-listing-draft-snapshot"
import {
  isPendingPublishForDraftType,
  SELL_SUPPRESS_IDB_RESTORE_KEY,
} from "@/lib/sell-flow/session-keys"
import { getImpersonation } from "@/lib/impersonation"

export type UseSellListingDraftPersistenceOptions = {
  listingType: SellListingDraftListingType
  editId: string | null
  startFresh: boolean
  draftHydrated: boolean
  setDraftHydrated: (value: boolean) => void
  formSnapshot: SellListingDraftFormSnapshot
  images: ListingPhotoSlot[]
  onRestoreForm: (snapshot: SellListingDraftFormSnapshot) => void
  idbRestoreOptimizeQueueRef: React.MutableRefObject<ListingPhotoSlot[] | null>
  draftPhotosPendingRef: React.MutableRefObject<ListingPhotoSlot[] | null>
}

export function useSellListingDraftPersistence({
  listingType,
  editId,
  startFresh,
  draftHydrated,
  setDraftHydrated,
  formSnapshot,
  images,
  onRestoreForm,
  idbRestoreOptimizeQueueRef,
  draftPhotosPendingRef,
}: UseSellListingDraftPersistenceOptions): {
  sellDraftUserIdRef: React.MutableRefObject<string | null>
  flushDraftNow: () => Promise<void>
} {
  const supabaseRef = useRef(createClient())
  const sellDraftUserIdRef = useRef<string | null>(null)
  const sellDraftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sellDraftLatestRef = useRef({
    listingType,
    formData: formSnapshot,
    images,
    editId,
    draftHydrated,
  })

  sellDraftLatestRef.current = {
    listingType,
    formData: formSnapshot,
    images,
    editId,
    draftHydrated,
  }

  useEffect(() => {
    if (!startFresh) return
    if (isPendingPublishForDraftType(listingType)) return
    void (async () => {
      const {
        data: { user },
      } = await supabaseRef.current.auth.getUser()
      if (user) await clearSellListingDraft(user.id, listingType)
      await clearGuestSellListingDraft(listingType)
    })()
  }, [listingType, startFresh])

  useEffect(() => {
    if (editId) {
      setDraftHydrated(true)
      return
    }
    let cancelled = false
    void (async () => {
      const wantsBlankListing =
        startFresh ||
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("new") === "1")

      const suppressIdbForNewListing =
        typeof window !== "undefined" &&
        (() => {
          try {
            return sessionStorage.getItem(SELL_SUPPRESS_IDB_RESTORE_KEY) === "1"
          } catch {
            return false
          }
        })()

      const pendingPublishResume = isPendingPublishForDraftType(listingType)

      if (
        (pendingPublishResume || (!wantsBlankListing && !suppressIdbForNewListing)) &&
        !getImpersonation()
      ) {
        const {
          data: { user },
        } = await supabaseRef.current.auth.getUser()
        sellDraftUserIdRef.current = user?.id ?? null
        if (user?.id) {
          await migrateGuestSellListingDraftToUser(user.id, listingType)
        }
        const record = user?.id
          ? await loadSellListingDraft(user.id, listingType)
          : await loadGuestSellListingDraft(listingType)
        if (record && !cancelled) {
          onRestoreForm(record.formData)
          const restored = listingPhotoSlotsFromDraftBlobs(record.imageBlobs)
          if (restored.length) {
            idbRestoreOptimizeQueueRef.current = restored
            draftPhotosPendingRef.current = restored
          }
        }
      }
      if (!cancelled) setDraftHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [
    draftPhotosPendingRef,
    editId,
    idbRestoreOptimizeQueueRef,
    listingType,
    onRestoreForm,
    setDraftHydrated,
    startFresh,
  ])

  useEffect(() => {
    void supabaseRef.current.auth.getUser().then(({ data: { user } }) => {
      sellDraftUserIdRef.current = user?.id ?? null
    })
    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      sellDraftUserIdRef.current = uid
      if (uid) void migrateGuestSellListingDraftToUser(uid, listingType)
    })
    return () => subscription.unsubscribe()
  }, [listingType])

  const flushDraftNow = async () => {
    const r = sellDraftLatestRef.current
    if (r.editId || !r.draftHydrated) return
    await persistListingDraftSnapshot({
      listingType: r.listingType,
      formData: r.formData,
      images: r.images,
      userId: sellDraftUserIdRef.current,
    })
  }

  useEffect(() => {
    if (editId || !draftHydrated) return
    if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    sellDraftPersistTimerRef.current = setTimeout(() => {
      sellDraftPersistTimerRef.current = null
      void flushDraftNow()
    }, 600)
    return () => {
      if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    }
  }, [draftHydrated, editId, formSnapshot, images, listingType])

  useEffect(() => {
    if (editId || !draftHydrated) return
    const flush = () => void flushDraftNow()
    window.addEventListener("pagehide", flush)
    const onVis = () => {
      if (document.visibilityState === "hidden") flush()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [draftHydrated, editId, formSnapshot, images, listingType])

  return { sellDraftUserIdRef, flushDraftNow }
}
