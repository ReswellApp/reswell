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
import { claimGuestListingDraftsClient } from "@/lib/sell-flow/claim-guest-listing-drafts"

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
  /**
   * Open a draft without a Next.js navigation. Prefer this on `/sell` so changing
   * `?edit=` does not flash `loading.tsx` / the route Suspense skeleton.
   */
  onOpenDraft?: (draftId: string) => void
  /** Allow httpOnly guest-token drafts when unsigned (Quick / Phase 0.2). */
  allowUnsigned?: boolean
  /** Write `?edit=` into the URL after create. Off for Quick (no draft URL yet). */
  syncEditUrl?: boolean
  /** Debounced background autosave (ms). Omit / 0 = manual + pagehide only. */
  autosaveMs?: number
  /**
   * Any value that changes when the form/photos change — required for autosave
   * to observe updates (refs alone do not re-render).
   */
  autosaveWatch?: unknown
  /** Hide Drafts picker UI (Quick still persists via autosave). */
  hideDraftControls?: boolean
}

export type UseSellServerDraftResult = {
  localServerDraftId: string | null
  currentDraftId: string | null
  listingIsDraft: boolean
  showDraftControls: boolean
  /** Server autosave status — lets callers avoid stacking a second "saved" indicator. */
  draftSaveStatus: DraftSaveStatusKind
  draftControls: React.ReactNode
  handleSaveDraft: () => Promise<void>
  persistServerDraftRef: React.MutableRefObject<
    (opts?: { keepalive?: boolean }) => Promise<{ ok: false } | { ok: true; listingId: string }>
  >
  clearLocalServerDraft: () => void
}

function blankListingHref(section: SellDraftSection): string {
  return section === "fins" ? "/sell/fins?new=1" : "/sell/boards?new=1"
}

export function useSellServerDraft(options: UseSellServerDraftOptions): UseSellServerDraftResult {
  const router = useRouter()
  const listingIsDraft = options.editListingStatus === "draft"
  const [localServerDraftId, setLocalServerDraftId] = useState<string | null>(null)
  const [availableDrafts, setAvailableDrafts] = useState<SellDraftItem[]>([])
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatusKind>("idle")
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)

  const localServerDraftIdRef = useRef<string | null>(null)
  useEffect(() => {
    localServerDraftIdRef.current = localServerDraftId
  }, [localServerDraftId])

  const onOpenDraftRef = useRef(options.onOpenDraft)
  onOpenDraftRef.current = options.onOpenDraft

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
      if (res.status === 401) {
        setAvailableDrafts([])
        return
      }
      if (!res.ok) {
        // Keep the previous list on transient failures so the header does not flicker.
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
      // Keep prior drafts on network blips — empty only on auth / impersonation.
    }
  }, [options.section])

  // Load the drafts list once the form is hydrated — including while editing a draft.
  // Skipping on `editId` left the picker empty after soft URL updates / deep links.
  useEffect(() => {
    if (!options.draftHydrated) return
    void reloadDrafts()
  }, [options.draftHydrated, reloadDrafts])

  const currentDraftId = useMemo(() => {
    if (options.editId && listingIsDraft) return options.editId
    if (!options.editId && localServerDraftId) return localServerDraftId
    return null
  }, [listingIsDraft, localServerDraftId, options.editId])

  type PersistDraftResult = { ok: false } | { ok: true; listingId: string }

  const allowUnsigned = options.allowUnsigned === true
  const syncEditUrl = options.syncEditUrl !== false

  const persistServerDraft = useCallback(
    async (opts?: { keepalive?: boolean }): Promise<PersistDraftResult> => {
      if (!options.draftHydrated) return { ok: false }
      if (options.editLoading) return { ok: false }
      if (getImpersonation()) return { ok: false }
      const session = await resolveClientSessionForMutation(options.supabase)
      const signedIn = Boolean(session?.user && session.access_token)
      if (!signedIn && !allowUnsigned) {
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
      if (!options.editId && syncEditUrl) {
        replaceSellDraftEditUrl(options.section, resolvedId)
      }
      setDraftSaveStatus("saved")
      setDraftSavedAt(Date.now())
      if (wasNewDraft) void reloadDrafts()
      return { ok: true, listingId: resolvedId }
    },
    [
      allowUnsigned,
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
      syncEditUrl,
    ],
  )

  const persistServerDraftRef = useRef(persistServerDraft)
  persistServerDraftRef.current = persistServerDraft

  const syncDraftImages = useCallback(
    async (listingId: string) => {
      // Guest draft rows have null user_id — listing_images RLS blocks client inserts.
      const session = await resolveClientSessionForMutation(options.supabase)
      if (!session?.user) return
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

  // Claim guest server drafts on sign-in (separate rows — never merge).
  useEffect(() => {
    const {
      data: { subscription },
    } = options.supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) return
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return
      void (async () => {
        const claimed = await claimGuestListingDraftsClient()
        if (claimed.length > 0) void reloadDrafts()
      })()
    })
    return () => subscription.unsubscribe()
  }, [options.supabase, reloadDrafts])

  // Optional debounced autosave (Quick). Driven by `autosaveWatch`.
  useEffect(() => {
    const ms = options.autosaveMs
    if (!ms || ms <= 0) return
    if (!options.draftHydrated || options.editLoading || options.loading) return
    if (getImpersonation()) return
    const t = window.setTimeout(() => {
      void persistServerDraftRef.current()
    }, ms)
    return () => window.clearTimeout(t)
  }, [
    options.autosaveMs,
    options.autosaveWatch,
    options.draftHydrated,
    options.editLoading,
    options.loading,
  ])

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

  const navigateToDraft = useCallback(
    (draftId: string) => {
      setSellServerDraftListingId(options.section, draftId)
      setLocalServerDraftId(draftId)
      const softOpen = onOpenDraftRef.current
      if (softOpen) {
        softOpen(draftId)
        return
      }
      // Fallback: soft replace (still an App Router navigation, but no history spam).
      router.replace(peerListingEditHref(options.section, draftId), { scroll: false })
    },
    [options.section, router],
  )

  /**
   * Best-effort save of the draft being switched away from. The payload, image
   * slots, and target listing id are snapshotted synchronously — before the
   * switch mutates any form state — so the background request can never write
   * the newly opened draft's data onto the outgoing one. Intentionally does not
   * touch `draftSaveStatus` (it describes the draft on screen) or `setImages`.
   */
  const persistOutgoingDraftInBackground = useCallback(() => {
    if (!options.draftHydrated || options.editLoading) return
    if (getImpersonation()) return
    if (options.editId && !listingIsDraft) return
    const outgoingId = options.editId ?? localServerDraftIdRef.current
    const slots = [...options.imagesRef.current]
    const removedIds = [...options.removedImageIdsRef.current]
    if (slots.length === 0 && !options.formLooksFilled()) return
    const body = options.buildDraftPayload(outgoingId)

    void (async () => {
      try {
        const session = await resolveClientSessionForMutation(options.supabase)
        const signedIn = Boolean(session?.user && session.access_token)
        if (!signedIn && !allowUnsigned) return
        const res = await fetch("/api/listings/draft", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) return
        const json = (await res.json()) as { data?: { id?: string } }
        const savedId =
          typeof json?.data?.id === "string" && json.data.id ? json.data.id : outgoingId
        if (signedIn && savedId && listingPhotosReadyForDraftSync(slots)) {
          await syncListingDraftImagesClient(options.supabase, savedId, slots, removedIds)
        }
        void reloadDrafts()
      } catch {
        /* best-effort — the switched-to draft is already open */
      }
    })()
  }, [
    allowUnsigned,
    listingIsDraft,
    options.buildDraftPayload,
    options.draftHydrated,
    options.editId,
    options.editLoading,
    options.formLooksFilled,
    options.imagesRef,
    options.removedImageIdsRef,
    options.supabase,
    reloadDrafts,
  ])

  const handleOpenDraft = useCallback(
    (draftId: string) => {
      if (!draftId) return
      if (draftId === currentDraftId) {
        if (!options.editId) {
          navigateToDraft(draftId)
        }
        return
      }
      // Snapshot + fire the outgoing save first, then switch immediately — no
      // network round trip between the click and the draft opening.
      if (currentDraftId) persistOutgoingDraftInBackground()
      navigateToDraft(draftId)
    },
    [
      currentDraftId,
      navigateToDraft,
      options.editId,
      persistOutgoingDraftInBackground,
    ],
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
          // Stay on the board sell flow — bare `/sell?new=1` is the catalog search hub.
          router.replace(blankListingHref(options.section), { scroll: false })
        } else {
          await options.onStartNewListing?.()
        }
      }
    },
    [currentDraftId, options, router],
  )

  const handleStartNewListing = useCallback(async () => {
    clearSellServerDraftListingId(options.section)
    setLocalServerDraftId(null)
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

  // Keep the Drafts control mounted across soft switches / edit loads when we
  // already know a server draft id — avoids the header jumping as editLoading flips.
  const showDraftControls =
    options.hideDraftControls !== true &&
    !options.loading &&
    !getImpersonation() &&
    (Boolean(localServerDraftId) ||
      (!options.editLoading && (!options.editId || listingIsDraft)))

  const draftControls = showDraftControls ? (
    <div className="flex items-center gap-1">
      <DraftsPicker
        appearance="toolbar"
        drafts={availableDrafts}
        currentDraftId={currentDraftId}
        onSelect={handleOpenDraft}
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
          options.optimizingAny === true ||
          !options.draftHydrated ||
          options.extraDisabled === true
        }
      />
      <DraftSavedStatus status={draftSaveStatus} savedAt={draftSavedAt} />
    </div>
  ) : null

  return {
    localServerDraftId,
    currentDraftId,
    listingIsDraft,
    showDraftControls,
    draftSaveStatus,
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
