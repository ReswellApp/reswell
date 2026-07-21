"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  DraftSavedStatus,
  DraftsPicker,
  type DraftSaveStatusKind,
  type SellDraftItem,
} from "@/components/features/sell/drafts-picker"
import { getImpersonation } from "@/lib/impersonation"
import { peerListingEditHref } from "@/lib/peer-listing-sections"
import {
  clearSellServerDraftListingId,
  getSellServerDraftListingId,
  replaceSellDraftEditUrl,
  setSellServerDraftListingId,
  type SellDraftSection,
} from "@/lib/sell-draft-local-meta"
import {
  listingPhotosReadyForDraftSync,
  type ListingPhotoSlot,
} from "@/lib/sell-flow/listing-photo-slot"
import { syncListingDraftImagesClient } from "@/lib/sell-flow/sync-listing-draft-images-client"
import {
  SELL_SUBMIT_INTERRUPTED_MESSAGE,
  isSellSubmitAbortError,
  sellSubmitErrorMessage,
} from "@/lib/sell-flow/sell-submit-error"
import { sellDraftFormLooksFilled, type SellListingDraftFormSnapshot } from "@/lib/sell-listing-draft-idb"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"

export type UseSellServerDraftOptions = {
  section: SellDraftSection
  supabase: SupabaseClient
  editId: string | null
  editListingStatus: string | null
  editLoading: boolean
  draftHydrated: boolean
  loading: boolean
  formLooksFilled: () => boolean
  buildDraftPayload: (listingId: string | null) => Record<string, unknown>
  imagesRef: React.MutableRefObject<ListingPhotoSlot[]>
  removedImageIdsRef: React.MutableRefObject<string[]>
  setImages: React.Dispatch<React.SetStateAction<ListingPhotoSlot[]>>
  onStartNewListing?: () => void | Promise<void>
  startNewListingBusy?: boolean
  optimizingAny?: boolean
  extraDisabled?: boolean
}

export type UseSellServerDraftResult = {
  localServerDraftId: string | null
  currentDraftId: string | null
  listingIsDraft: boolean
  showDraftControls: boolean
  draftControls: React.ReactNode
  handleSaveDraft: () => Promise<void>
  persistServerDraftRef: React.MutableRefObject<
    (opts?: { keepalive?: boolean }) => Promise<{ ok: false } | { ok: true; listingId: string }>
  >
  clearLocalServerDraft: () => void
}

export function useSellServerDraft(options: UseSellServerDraftOptions): UseSellServerDraftResult {
  const router = useRouter()
  const listingIsDraft = options.editListingStatus === "draft"
  const [localServerDraftId, setLocalServerDraftId] = useState<string | null>(null)
  const [availableDrafts, setAvailableDrafts] = useState<SellDraftItem[]>([])
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatusKind>("idle")
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const [draftSwitching, setDraftSwitching] = useState(false)

  const localServerDraftIdRef = useRef<string | null>(null)
  useEffect(() => {
    localServerDraftIdRef.current = localServerDraftId
  }, [localServerDraftId])

  useEffect(() => {
    if (options.editId || getImpersonation()) return
    setLocalServerDraftId(getSellServerDraftListingId(options.section))
  }, [options.editId, options.section])

  const reloadDrafts = useCallback(async () => {
    if (getImpersonation()) {
      setAvailableDrafts([])
      return
    }
    try {
      const res = await fetch(
        `/api/listings/draft?section=${encodeURIComponent(options.section)}`,
        { credentials: "include" },
      )
      if (!res.ok) {
        setAvailableDrafts([])
        return
      }
      const json = (await res.json()) as {
        data?: {
          drafts?: Array<{
            id: string
            title: string | null
            price: number | null
            updatedAt: string
            primaryImageUrl: string | null
          }>
        }
      }
      const rows = json.data?.drafts ?? []
      setAvailableDrafts(
        rows.map((d) => ({
          id: d.id,
          title: d.title,
          price: d.price,
          updatedAt: d.updatedAt,
          primaryImageUrl: d.primaryImageUrl,
        })),
      )
    } catch {
      setAvailableDrafts([])
    }
  }, [options.section])

  useEffect(() => {
    if (!options.draftHydrated || options.editId) return
    void reloadDrafts()
  }, [options.draftHydrated, options.editId, reloadDrafts])

  const currentDraftId = useMemo(() => {
    if (options.editId && listingIsDraft) return options.editId
    if (!options.editId && localServerDraftId) return localServerDraftId
    return null
  }, [listingIsDraft, localServerDraftId, options.editId])

  type PersistDraftResult = { ok: false } | { ok: true; listingId: string }

  const persistServerDraft = useCallback(
    async (opts?: { keepalive?: boolean }): Promise<PersistDraftResult> => {
      if (!options.draftHydrated) return { ok: false }
      if (options.editLoading) return { ok: false }
      if (getImpersonation()) return { ok: false }
      const session = await resolveClientSessionForMutation(options.supabase)
      if (!session?.user || !session.access_token) {
        toast.message("Sign in to save a draft")
        return { ok: false }
      }
      if (options.editId && !listingIsDraft) return { ok: false }

      const hasDraftableContent =
        options.imagesRef.current.length > 0 || options.formLooksFilled()
      if (!hasDraftableContent) return { ok: false }

      const body = options.buildDraftPayload(options.editId ?? localServerDraftIdRef.current)
      const init: RequestInit = {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
      if (opts?.keepalive) init.keepalive = true

      setDraftSaveStatus("saving")
      const res = await fetch("/api/listings/draft", init)
      if (!res.ok) {
        if (res.status === 404 || res.status === 403) {
          clearSellServerDraftListingId(options.section)
          setLocalServerDraftId(null)
        }
        setDraftSaveStatus("error")
        return { ok: false }
      }
      const json = (await res.json()) as { data?: { id?: string } }
      const id = json?.data?.id
      const resolvedId =
        typeof id === "string" && id
          ? id
          : options.editId ?? localServerDraftIdRef.current ?? ""
      if (!resolvedId) {
        setDraftSaveStatus("error")
        return { ok: false }
      }
      setSellServerDraftListingId(options.section, resolvedId)
      const wasNewDraft = !options.editId && !localServerDraftIdRef.current
      setLocalServerDraftId(resolvedId)
      if (!options.editId) {
        replaceSellDraftEditUrl(options.section, resolvedId)
      }
      setDraftSaveStatus("saved")
      setDraftSavedAt(Date.now())
      if (wasNewDraft) void reloadDrafts()
      return { ok: true, listingId: resolvedId }
    },
    [
      listingIsDraft,
      options.buildDraftPayload,
      options.draftHydrated,
      options.editId,
      options.editLoading,
      options.formLooksFilled,
      options.imagesRef,
      options.section,
      options.supabase,
      reloadDrafts,
    ],
  )

  const persistServerDraftRef = useRef(persistServerDraft)
  persistServerDraftRef.current = persistServerDraft

  const syncDraftImages = useCallback(
    async (listingId: string) => {
      const slots = options.imagesRef.current
      if (!listingPhotosReadyForDraftSync(slots)) return
      const { nextSlots, didInsert } = await syncListingDraftImagesClient(
        options.supabase,
        listingId,
        slots,
        options.removedImageIdsRef.current,
      )
      if (didInsert) options.setImages(nextSlots)
    },
    [options.imagesRef, options.removedImageIdsRef, options.setImages, options.supabase],
  )

  const handleSaveDraft = useCallback(async () => {
    const hasDraftableContent =
      options.imagesRef.current.length > 0 || options.formLooksFilled()
    if (!hasDraftableContent) {
      toast.message("Add at least one detail or photo before saving a draft.")
      return
    }
    const result = await persistServerDraft()
    if (!result.ok) {
      toast.error("Failed to save draft — please try again")
      return
    }
    try {
      await syncDraftImages(result.listingId)
    } catch (e) {
      toast.error(
        isSellSubmitAbortError(e)
          ? SELL_SUBMIT_INTERRUPTED_MESSAGE
          : sellSubmitErrorMessage(e, "Photos could not be saved to the draft."),
      )
      setDraftSaveStatus("error")
      return
    }
    toast.success("Draft saved")
  }, [options.formLooksFilled, options.imagesRef, persistServerDraft, syncDraftImages])

  const handleOpenDraft = useCallback(
    async (draftId: string) => {
      if (!draftId) return
      if (draftId === currentDraftId) {
        if (!options.editId) {
          router.push(peerListingEditHref(options.section, draftId))
        }
        return
      }
      setDraftSwitching(true)
      try {
        if (currentDraftId) {
          const persisted = await persistServerDraft()
          if (persisted.ok) {
            try {
              await syncDraftImages(persisted.listingId)
            } catch {
              /* best-effort before switch */
            }
          }
        }
        router.push(peerListingEditHref(options.section, draftId))
      } finally {
        setDraftSwitching(false)
      }
    },
    [currentDraftId, options.section, persistServerDraft, router, syncDraftImages],
  )

  const handleDiscardDraftFromPicker = useCallback(
    async (draftId: string) => {
      if (!draftId) return
      const res = await fetch(
        `/api/listings/discard-draft?id=${encodeURIComponent(draftId)}`,
        { method: "DELETE", credentials: "include" },
      )
      if (!res.ok) {
        toast.error("Could not discard draft")
        return
      }
      setAvailableDrafts((prev) => prev.filter((d) => d.id !== draftId))
      if (draftId === currentDraftId) {
        clearSellServerDraftListingId(options.section)
        setLocalServerDraftId(null)
        if (options.editId) {
          router.push(options.section === "fins" ? "/sell/fins?new=1" : "/sell?new=1")
        } else {
          await options.onStartNewListing?.()
        }
      }
    },
    [currentDraftId, options, router],
  )

  const handleStartNewListing = useCallback(async () => {
    await options.onStartNewListing?.()
    void reloadDrafts()
  }, [options, reloadDrafts])

  const clearLocalServerDraft = useCallback(() => {
    clearSellServerDraftListingId(options.section)
    setLocalServerDraftId(null)
  }, [options.section])

  useEffect(() => {
    const flushAll = () => {
      void (async () => {
        const persisted = await persistServerDraftRef.current({ keepalive: true })
        if (!persisted.ok) return
        try {
          await syncDraftImages(persisted.listingId)
        } catch {
          /* best-effort on page hide */
        }
      })()
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") flushAll()
    }
    window.addEventListener("pagehide", flushAll)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("pagehide", flushAll)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [syncDraftImages])

  const showDraftControls =
    !options.loading &&
    !options.editLoading &&
    !getImpersonation() &&
    (!options.editId || listingIsDraft)

  const draftControls = showDraftControls ? (
    <>
      <DraftSavedStatus status={draftSaveStatus} savedAt={draftSavedAt} />
      <DraftsPicker
        drafts={availableDrafts}
        currentDraftId={currentDraftId}
        onSelect={(id) => void handleOpenDraft(id)}
        onDiscard={handleDiscardDraftFromPicker}
        onSaveDraft={() => void handleSaveDraft()}
        saveDraftBusy={draftSaveStatus === "saving"}
        onStartNew={
          currentDraftId || availableDrafts.length > 0
            ? () => void handleStartNewListing()
            : undefined
        }
        disabled={
          options.loading ||
          options.startNewListingBusy === true ||
          draftSwitching ||
          options.optimizingAny === true ||
          !options.draftHydrated ||
          options.extraDisabled === true
        }
      />
    </>
  ) : null

  return {
    localServerDraftId,
    currentDraftId,
    listingIsDraft,
    showDraftControls,
    draftControls,
    handleSaveDraft,
    persistServerDraftRef,
    clearLocalServerDraft,
  }
}

/** Shared IDB “looks filled” check for surfboard + fin sell forms. */
export function sellFormSnapshotLooksFilled(
  listingType: "board" | "fins",
  snapshot: SellListingDraftFormSnapshot,
): boolean {
  return sellDraftFormLooksFilled(listingType, snapshot)
}
