"use client"

import { useEffect, useRef, useState } from "react"
import { updateListingQuickEditAction } from "@/lib/actions/listingQuickEdit"
import type { ListingQuickEditSaved } from "@/lib/services/listingQuickEdit"
import {
  isListingSellableCondition,
  type ListingSellableCondition,
} from "@/lib/listing-labels"
import { canQuickEditListing } from "@/lib/listing-quick-edit-access"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import {
  inferShopPackageSizeId,
  isShopPackageSizeId,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import {
  listingDeskCartonFromSize,
  listingDeskInferredPackageSizeId,
  listingDeskSpecFromRow,
  listingDeskSpecsEqual,
  type ListingDeskSpec,
} from "@/lib/listings-desk-fields"
import { LISTING_QUICK_EDIT_DESCRIPTION_MAX } from "@/lib/validations/listing-quick-edit"

export type ListingQuickDraft = {
  title: string
  description: string
  condition: string
  priceInput: string
  packageSizeId: string
  spec: ListingDeskSpec
}

export type ListingQuickDraftSource = {
  id: string
  title: string
  price: number
  status: string
  section: string
  condition: string | null
  description: string | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
  brand: string | null
  model: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  board_shipping_cost_mode: string | null
  shipping_price: number | null
  dropoff_location_id: string | null
  dimensions: string | null
  length_total_inches: number | null
  volume_liters: number | null
  fins_setup: string | null
  fin_system: string | null
  construction: string | null
  fins_included: boolean | null
  tail_shape: string | null
  fin_size: string | null
  wetsuit_size: string | null
  apparel_kind: string | null
  traction_size: string | null
}

export function draftFromListing(listing: ListingQuickDraftSource): ListingQuickDraft {
  const price = Number(listing.price)
  const inferred = inferShopPackageSizeId(listing)
  return {
    title: listing.title ?? "",
    description: (listing.description ?? "").trim(),
    condition: isListingSellableCondition(listing.condition) ? listing.condition : "",
    priceInput: Number.isFinite(price) ? String(Math.round(price * 100) / 100) : "",
    packageSizeId: inferred ?? "",
    spec: listingDeskSpecFromRow(listing),
  }
}

function draftsEqual(a: ListingQuickDraft, b: ListingQuickDraft): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    a.description.trim() === b.description.trim() &&
    a.condition === b.condition &&
    a.priceInput.trim() === b.priceInput.trim() &&
    a.packageSizeId === b.packageSizeId &&
    listingDeskSpecsEqual(a.spec, b.spec)
  )
}

function cartonFieldChanged(spec: Partial<ListingDeskSpec>): boolean {
  return (
    spec.packageLengthIn !== undefined ||
    spec.packageWidthIn !== undefined ||
    spec.packageHeightIn !== undefined ||
    spec.packageWeightLb !== undefined ||
    spec.packageWeightOz !== undefined ||
    spec.dropoffLocationId !== undefined
  )
}

export type ListingQuickDraftStatus = "idle" | "saving" | "saved" | "error"

export function useListingQuickDraft({
  listing,
  appliedPackageSizeId = null,
  packageSyncNonce = 0,
  onSaved,
}: {
  listing: ListingQuickDraftSource
  appliedPackageSizeId?: ShopPackageSizeId | null
  packageSyncNonce?: number
  onSaved: (listingId: string, saved: ListingQuickEditSaved) => void
}) {
  const editable = canQuickEditListing(listing.status)
  const [draft, setDraft] = useState(() => draftFromListing(listing))
  const [status, setStatus] = useState<ListingQuickDraftStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const savedRef = useRef(draft)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!appliedPackageSizeId || packageSyncNonce === 0) return
    const carton = listingDeskCartonFromSize(listing.section, appliedPackageSizeId)
    setDraft((current) => ({
      ...current,
      packageSizeId: appliedPackageSizeId,
      spec: carton ? { ...current.spec, ...carton } : current.spec,
    }))
    savedRef.current = {
      ...savedRef.current,
      packageSizeId: appliedPackageSizeId,
      spec: carton ? { ...savedRef.current.spec, ...carton } : savedRef.current.spec,
    }
  }, [appliedPackageSizeId, packageSyncNonce, listing.section])

  useEffect(() => {
    if (!editable) return
    if (draftsEqual(draft, savedRef.current)) return
    const snapshot = draft
    const handle = window.setTimeout(() => {
      void persist(snapshot)
    }, 700)
    return () => window.clearTimeout(handle)
    // persist closes over latest listing/onSaved via refs below
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on draft only
  }, [draft, editable, listing.id])

  async function persist(snapshot: ListingQuickDraft) {
    const saved = savedRef.current
    if (draftsEqual(snapshot, saved)) return

    const payload: {
      listingId: string
      title?: string
      description?: string
      condition?: ListingSellableCondition
      priceUsd?: number
      packageSizeId?: ShopPackageSizeId
      specs?: ListingDeskSpec
    } = { listingId: listing.id }
    const title = snapshot.title.trim()
    if (title !== saved.title.trim()) {
      if (!title) {
        setStatus("error")
        setError("Add a title.")
        return
      }
      if (title.length > LISTING_TITLE_MAX_LENGTH) {
        setStatus("error")
        setError(`Title must be ${LISTING_TITLE_MAX_LENGTH} characters or fewer.`)
        return
      }
      payload.title = title
    }
    const description = snapshot.description.trim()
    if (description !== saved.description.trim()) {
      if (description.length > LISTING_QUICK_EDIT_DESCRIPTION_MAX) {
        setStatus("error")
        setError("Description is too long.")
        return
      }
      payload.description = description
    }
    if (
      snapshot.condition &&
      snapshot.condition !== saved.condition &&
      isListingSellableCondition(snapshot.condition)
    ) {
      payload.condition = snapshot.condition
    }
    if (snapshot.priceInput.trim() !== saved.priceInput.trim()) {
      const price = Number(snapshot.priceInput)
      if (!Number.isFinite(price) || price < 0.01 || price > 999_999.99) {
        setStatus("error")
        setError("Enter a price between $0.01 and $999,999.99.")
        return
      }
      payload.priceUsd = Math.round(price * 100) / 100
    }
    if (
      snapshot.packageSizeId &&
      snapshot.packageSizeId !== "custom" &&
      snapshot.packageSizeId !== saved.packageSizeId &&
      isShopPackageSizeId(snapshot.packageSizeId)
    ) {
      payload.packageSizeId = snapshot.packageSizeId
    }
    if (!listingDeskSpecsEqual(snapshot.spec, saved.spec)) {
      payload.specs = snapshot.spec
    }
    if (Object.keys(payload).length === 1) return

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setStatus("saving")
    setError(null)
    try {
      const result = await updateListingQuickEditAction(payload)
      if (requestId !== requestRef.current) return
      if ("error" in result) {
        setStatus("error")
        setError(sellActionErrorMessage(result.error))
        return
      }
      savedRef.current = {
        ...snapshot,
        title: result.listing.title,
        description: result.listing.description,
        condition: result.listing.condition ?? snapshot.condition,
        priceInput: String(result.listing.priceUsd),
        packageSizeId: result.listing.packageSizeId ?? snapshot.packageSizeId,
      }
      setDraft((current) => (draftsEqual(current, snapshot) ? savedRef.current : current))
      setStatus("saved")
      onSaved(listing.id, result.listing)
    } catch {
      if (requestId !== requestRef.current) return
      setStatus("error")
      setError("Could not save this listing.")
    }
  }

  function updateDraft(
    patch: Partial<Omit<ListingQuickDraft, "spec">> & { spec?: Partial<ListingDeskSpec> },
  ) {
    setStatus("idle")
    setDraft((current) => {
      let spec = patch.spec ? { ...current.spec, ...patch.spec } : current.spec
      let packageSizeId = patch.packageSizeId ?? current.packageSizeId
      if (patch.packageSizeId && isShopPackageSizeId(patch.packageSizeId)) {
        const carton = listingDeskCartonFromSize(listing.section, patch.packageSizeId)
        if (carton) {
          spec = {
            ...spec,
            ...carton,
            shippingAvailable: true,
            shippingCostMode: "reswell",
            dropoffLocationId: "",
          }
        }
      } else if (patch.spec && cartonFieldChanged(patch.spec)) {
        packageSizeId = listingDeskInferredPackageSizeId(listing.section, spec)
      }
      return { ...current, ...patch, spec, packageSizeId }
    })
  }

  return {
    editable,
    draft,
    status,
    error,
    updateDraft,
  }
}
