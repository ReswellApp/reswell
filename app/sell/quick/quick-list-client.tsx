"use client"
/**
 * Quick List — photo-first, single-screen surfboard listing (the fast
 * alternative to the /sell wizard). Six essentials, one publish button.
 * The publish path mirrors the wizard's fresh non-admin create branch
 * field-for-field; drafts/IndexedDB persistence intentionally stay with
 * the wizard.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, MapPin } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SmoothCollapse } from "@/components/ui/smooth-collapse"

import {
  SELL_CONTROL_CLASS,
  SELL_PAGE_GROUND_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { QuickEssentialCard } from "@/components/features/sell/quick/quick-essential-card"
import { QuickPhotoHero } from "@/components/features/sell/quick/quick-photo-hero"
import { QuickPublishBar } from "@/components/features/sell/quick/quick-publish-bar"
import { QuickPublishOverlay } from "@/components/features/sell/quick/quick-publish-overlay"
import { useListingPhotoUpload } from "@/components/features/sell/hooks/use-listing-photo-upload"
import { useGeneratedListingDescription } from "@/components/features/sell/hooks/use-generated-listing-description"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellBoardDimensionsPicker } from "@/components/features/sell/sell-board-dimensions-picker"
import {
  SellBoardFacetFields,
  SellFacetChipGroup,
} from "@/components/features/sell/sell-board-facet-fields"
import { SellEarningsBreakdown } from "@/components/features/sell/sell-earnings-breakdown"
import { SellBoardModelField } from "@/components/sell-board-model-field"
import { SurfboardTitleIndexInput } from "@/components/surfboard-title-index-input"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"
import {
  RequestBrandModelDialog,
  type ListingCatalogRequestVariant,
} from "@/components/request-brand-model-dialog"
import { LocationPicker, type LocationPrefillSuggested } from "@/components/location-picker"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"

import {
  LISTING_MIN_PHOTOS,
  LISTING_TITLE_MAX_LENGTH,
  buildResolvedListingTitle,
  validateSellListingForm,
  type BoardShippingCostMode,
} from "@/lib/sell-form-validation"
import {
  LISTING_CONDITION_SELL_OPTIONS,
  isListingSellableCondition,
} from "@/lib/listing-labels"
import type { BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import {
  reswellPackageFieldsToDb,
  resolveListingFulfillmentFlagsForSellSubmit,
} from "@/lib/sell-listing-fulfillment-flags"
import { listingDimensionsColumnFromSurfboardSellForm } from "@/lib/listing-dimensions-storage"
import {
  boardBrowseFacetFieldsForDb,
  finsSetupFieldForDb,
} from "@/lib/listing-facet-write"
import {
  boardTypeFromCategoryId,
  resolveListingBoardTypeFromCategory,
} from "@/lib/utils/board-type-from-category-id"
import {
  orderSurfboardSellCategoryOptions,
  staticSellBoardCategoryOptions,
  type SellCategoryOptionRow,
} from "@/lib/surfboard-sell-categories"
import {
  formatBoardLengthForTitle,
  isBoardLengthEntryComplete,
} from "@/lib/board-measurements"
import type { SurfboardStockSizeOption } from "@/lib/types/board-stock-sizes"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { sellerPurchasePriceToDb } from "@/lib/utils/seller-purchase-price"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { applyBoardListingPublishedSideEffectsAction } from "@/lib/actions/boardListingPublishActions"
import { revalidateListingDetailAfterListingMutation } from "@/app/actions/listing-detail-cache"
import { revalidateNavSearchSuggestAfterListingPublished } from "@/app/actions/nav-search-suggest-cache"
import { saveDefaultListingLocationAction } from "@/app/actions/sell-default-location"
import { setJustPublishedListingMarker } from "@/lib/sell-flow/just-published"
import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import { listingDetailHref } from "@/lib/listing-href"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import {
  SELL_SUBMIT_INTERRUPTED_MESSAGE,
  isSellSubmitAbortError,
  sellSubmitErrorMessage,
} from "@/lib/sell-flow/sell-submit-error"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"

const QUICK_LIST_PATH = "/sell/quick"
const QUICK_LIST_MAX_PHOTOS = 12

/**
 * Same field set as the wizard's `createInitialSellFormData` so the shared
 * validators / persist helpers behave identically. Quick List is
 * pickup-only in v1 — shipping can be added after publish by editing.
 */
function createInitialQuickListFormData() {
  return {
    title: "",
    description: "",
    price: "",
    sellerPurchasePrice: "",
    category: "",
    condition: "",
    brand: "",
    boardFulfillment: "pickup_only" as BoardFulfillmentChoice,
    boardShippingCostMode: "reswell" as BoardShippingCostMode,
    boardShippingPrice: "",
    surfboardShippingTier: "",
    surfboardShippingTierCeilingConfirmed: false,
    surfboardShippingPackBand: "",
    surfboardShippingPackBandCeilingConfirmed: false,
    adminCustomShippingCarton: false,
    reswellPackageLengthIn: "",
    reswellPackageWidthIn: "",
    reswellPackageHeightIn: "",
    reswellPackageWeightLb: "",
    reswellPackageWeightOz: "",
    autoPriceDrop: false,
    autoPriceDropFloor: "",
    buyerOffers: true,
    boardType: "",
    boardLength: "",
    boardWidthInches: "",
    boardThicknessInches: "",
    boardVolumeL: "",
    boardFins: "",
    boardTail: "",
    boardFinSystem: "",
    boardConstruction: "",
    boardBrandId: "",
    boardBrandModelId: "",
    boardIndexBrandSlug: "",
    boardIndexModelSlug: "",
    boardIndexLabel: "",
    boardModelName: "",
    boardLinkedBrandName: "",
    locationLat: 0,
    locationLng: 0,
    locationCity: "",
    locationState: "",
    locationDisplay: "",
  }
}

type QuickListFormData = ReturnType<typeof createInitialQuickListFormData>

/** Mirrors the wizard's `listingSurfboardBrandFieldsForDb` for insert parity. */
function listingSurfboardBrandFieldsForDb(fd: QuickListFormData): {
  brand_model_id: string | null
  model: string | null
} {
  const catalogId = fd.boardBrandModelId.trim()
  const modelText = fd.boardModelName.trim()
  return {
    brand_model_id: catalogId || null,
    model: modelText || null,
  }
}

/** Mirrors the wizard's `boardCatalogSnapshotFromSellForm`. */
function boardCatalogSnapshotFromQuickForm(
  form: QuickListFormData,
): SellFormBoardCatalogSlice {
  return {
    boardLength: form.boardLength,
    boardWidthInches: form.boardWidthInches,
    boardThicknessInches: form.boardThicknessInches,
    boardVolumeL: form.boardVolumeL,
    boardBrandId: form.boardBrandId,
    boardIndexBrandSlug: form.boardIndexBrandSlug,
    boardIndexModelSlug: form.boardIndexModelSlug,
    boardIndexLabel: form.boardIndexLabel,
    boardModelName: form.boardModelName,
    category: form.category,
    condition: form.condition,
    brand: form.brand,
    price: form.price,
    boardFins: form.boardFins,
  }
}

/** Server-side Klaviyo "Listing" metric — same fire-and-forget as the wizard. */
function requestKlaviyoListingCreated(listingId: string): void {
  void fetch("/api/integrations/klaviyo/listing-created", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_id: listingId }),
  })
    .then(async (res) => {
      if (res.ok) return
      const text = await res.text().catch(() => "")
      if (process.env.NODE_ENV === "development") {
        console.warn("[quick-list] klaviyo listing-created API:", res.status, text.slice(0, 300))
      }
    })
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[quick-list] klaviyo listing-created fetch failed:", err)
      }
    })
}

type QuickPublishPreview = {
  title: string
  price: string
  coverUrl: string
}

export default function QuickListClient() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const openSignIn = useSignInGate()
  const listingPhotosInputId = useId()

  const [formData, setFormData] = useState<QuickListFormData>(
    createInitialQuickListFormData,
  )
  const formDataRef = useRef(formData)
  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  const [publishing, setPublishing] = useState(false)
  const [publishPreview, setPublishPreview] = useState<QuickPublishPreview | null>(null)
  const [validationBanner, setValidationBanner] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const publishInFlightRef = useRef(false)

  const signInReturnPath = useCallback(() => QUICK_LIST_PATH, [])
  const photos = useListingPhotoUpload({
    maxPhotos: QUICK_LIST_MAX_PHOTOS,
    signInReturnPath,
    openSignIn,
    supabase,
    funnelListingType: "surfboards",
  })
  const { images, imagesUploadReady, uploadingCount } = photos

  useEffect(() => {
    if (!publishing) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [publishing])

  // Board shape / category options — same source as the wizard (DB rows with
  // static fallback) so category UUIDs always match `public.categories`.
  const [sellCategoryOptions, setSellCategoryOptions] = useState<SellCategoryOptionRow[]>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, board, slug")
        .eq("board", true)
      if (cancelled) return
      if (error) {
        console.warn("[quick-list] categories fetch failed:", error.message)
        setSellCategoryOptions(staticSellBoardCategoryOptions())
        return
      }
      const rows = (data ?? []).map((r) => ({
        value: r.id as string,
        label: (r.name as string | null) ?? "",
        board: true as const,
        slug: (r.slug as string | null) ?? null,
      }))
      setSellCategoryOptions(rows.length > 0 ? rows : staticSellBoardCategoryOptions())
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])
  const boardCategoryOptions = useMemo(() => {
    const ordered = orderSurfboardSellCategoryOptions(
      sellCategoryOptions.filter((c) => c.board === true),
    )
    if (ordered.length > 0) return ordered
    return orderSurfboardSellCategoryOptions(staticSellBoardCategoryOptions())
  }, [sellCategoryOptions])

  // Saved locality from the seller's last publish — pre-fills the location
  // search only; the seller still confirms the pin (same as the wizard).
  const [locationPrefillSuggested, setLocationPrefillSuggested] =
    useState<LocationPrefillSuggested | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_listing_city, default_listing_state")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      const city = (profile?.default_listing_city ?? "").trim()
      if (!city) return
      const state = (profile?.default_listing_state ?? "").trim()
      setLocationPrefillSuggested({
        city,
        state,
        displayLabel: [city, state].filter(Boolean).join(", "),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Catalog model with exactly one stock size and a blank dimensions form:
  // prefill dimensions silently (same rule as the wizard's stock-size effect).
  const stockSizesModelId = formData.boardBrandModelId.trim()
  useEffect(() => {
    if (!stockSizesModelId) return
    const controller = new AbortController()
    void (async () => {
      try {
        const res = await fetch(
          `/api/sell/board-model-stock-sizes?brand_model_id=${encodeURIComponent(stockSizesModelId)}`,
          { signal: controller.signal },
        )
        if (!res.ok) return
        const json = (await res.json().catch(() => null)) as {
          data?: { sizes?: SurfboardStockSizeOption[] }
        } | null
        const sizes = json?.data?.sizes ?? []
        const fd = formDataRef.current
        const hasDims = [fd.boardLength, fd.boardWidthInches, fd.boardThicknessInches].some(
          (v) => v.trim().length > 0,
        )
        if (!hasDims && sizes.length === 1) {
          const only = sizes[0]
          setFormData((f) => ({ ...f, ...only.values }))
        }
      } catch {
        /* aborted or offline — dimensions stay manual */
      }
    })()
    return () => controller.abort()
  }, [stockSizesModelId])

  // Auto-composed title ("6'0 Brand Model") that stays in sync until the
  // seller edits the field — same opt-out rule as the wizard's auto title.
  const [autoTitle, setAutoTitle] = useState<string | null>(null)
  useEffect(() => {
    const brand = formData.brand.trim()
    const model = formData.boardModelName.trim()
    if (!brand && !model) return
    const lengthPart = isBoardLengthEntryComplete(formData.boardLength)
      ? formatBoardLengthForTitle(formData.boardLength)
      : ""
    const suggestion = [lengthPart, brand, model].filter(Boolean).join(" ").trim()
    if (!suggestion || suggestion.length > LISTING_TITLE_MAX_LENGTH) return
    const current = formData.title
    const untouched =
      current === autoTitle || (current.trim() === "" && autoTitle === null)
    if (!untouched || current === suggestion) return
    setAutoTitle(suggestion)
    setFormData((f) => ({ ...f, title: suggestion }))
  }, [
    autoTitle,
    formData.brand,
    formData.boardModelName,
    formData.boardLength,
    formData.title,
  ])
  const titleIsAuto =
    formData.title.trim().length > 0 && formData.title === autoTitle

  const [catalogRequestVariant, setCatalogRequestVariant] =
    useState<ListingCatalogRequestVariant | null>(null)
  const openCatalogRequestFromBrand = useCallback(() => {
    setCatalogRequestVariant("full")
  }, [])
  const openCatalogRequestFromModel = useCallback(() => {
    const bid = formDataRef.current.boardBrandId.trim()
    setCatalogRequestVariant(bid ? { modelOnlyWithDirectoryBrandId: bid } : "full")
  }, [])

  const { generating: descriptionGenerating, generateDescription } =
    useGeneratedListingDescription()
  const handleGenerateDescription = useCallback(() => {
    const fd = formDataRef.current
    void generateDescription(
      {
        title: fd.title,
        brand: fd.brand,
        model: fd.boardModelName,
        category: fd.category,
        boardType: fd.boardType,
        condition: fd.condition,
        length: fd.boardLength,
        width: fd.boardWidthInches,
        thickness: fd.boardThicknessInches,
        volume: fd.boardVolumeL,
        price: fd.price,
        location: [fd.locationCity, fd.locationState].filter(Boolean).join(", "),
      },
      (text) => setFormData((f) => ({ ...f, description: text })),
    )
  }, [generateDescription])

  const boardLengthFormatted = useMemo(
    () => formatBoardLengthForTitle(formData.boardLength),
    [formData.boardLength],
  )

  const priceValid = useMemo(() => {
    const n = Number.parseFloat(formData.price.trim().replace(/,/g, ""))
    return Number.isFinite(n) && n >= 0.01 && n <= 999_999.99
  }, [formData.price])

  const locationSet = Boolean(
    formData.locationCity.trim() && formData.locationState.trim(),
  )

  /** Friendly readout for the sticky bar; `validateSellListingForm` stays the publish gate. */
  const missingEssentials = useMemo(() => {
    const items: string[] = []
    if (images.length < LISTING_MIN_PHOTOS) items.push("a photo")
    if (!isListingSellableCondition(formData.condition)) items.push("condition")
    if (!priceValid) items.push("price")
    if (!locationSet) items.push("location")
    if (!formData.category.trim()) items.push("board shape")
    if (!formData.description.trim()) items.push("a description")
    if (!formData.title.trim()) items.push("a title")
    return items
  }, [
    images.length,
    formData.condition,
    formData.category,
    formData.description,
    formData.title,
    priceValid,
    locationSet,
  ])

  const showValidationBanner = useCallback((message: string) => {
    setValidationBanner(message)
    window.requestAnimationFrame(() => {
      document
        .getElementById("quick-publish-validation-banner")
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [])

  /**
   * Publish — same behavior as the wizard's fresh non-admin create branch
   * (sell-flow-client.tsx `insertPayload` path), minus edit/impersonation/
   * draft branches which do not exist for Quick List.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (publishInFlightRef.current) return
    publishInFlightRef.current = true

    const publishStartedAt = Date.now()
    logSellFunnelEvent({
      listingType: "surfboards",
      event: "publish_attempt",
      message: "quick-list",
    })
    setValidationBanner(null)
    let retainOverlayUntilNavigation = false

    try {
      const session = await resolveClientSessionForMutation(supabase)
      const user = session?.user
      if (!user || !session?.access_token) {
        toast.message("Sign in to publish your listing")
        openSignIn(QUICK_LIST_PATH)
        return
      }

      const fd = formDataRef.current
      const imagesUploadReadyNow = !photos.imagesRef.current.some(
        (im) => im.uploadPhase !== "done" || !im.url?.trim() || !im.thumbnailUrl?.trim(),
      )
      const validationMessage = validateSellListingForm(
        { listingType: "board", ...fd },
        {
          imageCount: photos.imagesRef.current.length,
          imagesUploadReady: imagesUploadReadyNow,
        },
      )
      if (validationMessage) {
        logSellFunnelEvent({
          listingType: "surfboards",
          event: "validation_failed",
          message: validationMessage,
        })
        if (!fd.description.trim()) setDetailsOpen(true)
        showValidationBanner(validationMessage)
        return
      }

      setPublishing(true)
      // Yield one frame so the overlay can paint before slug DB work.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      const slots = photos.imagesRef.current
      const resolvedListingTitle = buildResolvedListingTitle({
        listingType: "board",
        ...fd,
      })
      setPublishPreview({
        title: resolvedListingTitle,
        price: fd.price,
        coverUrl:
          slots[0]?.thumbnailUrl || slots[0]?.url || slots[0]?.previewUrl || "/placeholder.svg",
      })

      // --- Insert payload: field-for-field parity with the wizard ---
      const fulfillmentFlags = resolveListingFulfillmentFlagsForSellSubmit(fd)
      const shippingCostMode = fulfillmentFlags.shipping_available
        ? fd.boardShippingCostMode
        : null
      const shippingPriceForPersist = fulfillmentFlags.shipping_available ? 0 : null
      const boardLocationLat = fd.locationLat ? fd.locationLat : null
      const boardLocationLng = fd.locationLng ? fd.locationLng : null
      const boardLocationCity = fd.locationCity.trim() || null
      const boardLocationState = fd.locationState.trim() || null
      const dimensionsStored = listingDimensionsColumnFromSurfboardSellForm(fd)
      const packedRow = reswellPackageFieldsToDb(fd)

      const listingFields = {
        title: resolvedListingTitle,
        description: fd.description,
        price: parseFloat(fd.price),
        condition: fd.condition,
        section: "surfboards" as const,
        category_id: fd.category,
        board_type: resolveListingBoardTypeFromCategory(fd.category, fd.boardType),
        dimensions: dimensionsStored,
        fins_setup: finsSetupFieldForDb(fd.boardFins),
        tail_shape: fd.boardTail ? fd.boardTail : null,
        ...boardBrowseFacetFieldsForDb(fd),
        latitude: boardLocationLat,
        longitude: boardLocationLng,
        city: boardLocationCity,
        state: boardLocationState,
        shipping_available: fulfillmentFlags.shipping_available,
        local_pickup: fulfillmentFlags.local_pickup,
        shipping_price: shippingPriceForPersist,
        board_shipping_cost_mode: shippingCostMode,
        ...packedRow,
        auto_price_drop_floor: fd.autoPriceDrop
          ? parseFloat(fd.autoPriceDropFloor.trim().replace(/,/g, ""))
          : null,
        buyer_offers_enabled: fd.buyerOffers !== false,
        brand: fd.brand.trim() ? fd.brand.trim() : null,
        brand_id: fd.boardBrandId.trim() || null,
        ...listingSurfboardBrandFieldsForDb(fd),
        seller_purchase_price_usd: sellerPurchasePriceToDb(fd.sellerPurchasePrice),
      }

      const newSlug = await generateUniqueListingSlug(supabase, resolvedListingTitle)
      const insertPayload = {
        user_id: user.id,
        ...listingFields,
        slug: newSlug,
        status: "active" as const,
      }
      let { data: listing, error: listingError } = await supabase
        .from("listings")
        .insert(insertPayload)
        .select()
        .single()

      if (listingError && isListingDimensionDisplaySchemaCacheError(listingError)) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[quick-list] DB rejected legacy listing dimension columns; saved without them. Ensure migrations are applied.",
          )
        }
        const retryPayload = {
          user_id: user.id,
          ...withoutListingDimensionDisplayDbFields(listingFields as Record<string, unknown>),
          slug: newSlug,
          status: "active" as const,
        }
        const retry = await supabase.from("listings").insert(retryPayload).select().single()
        listing = retry.data
        listingError = retry.error
      }

      if (listingError) {
        throw new Error(sellSubmitErrorMessage(listingError, "Failed to create listing"))
      }
      if (!listing) {
        throw new Error("No listing returned")
      }
      const listingId = String(listing.id)
      const listingSlug: string | null = listing.slug ?? newSlug

      void upsertUserListingBoardModelDataFromSellForm(supabase, {
        listingId,
        sellerUserId: user.id,
        form: boardCatalogSnapshotFromQuickForm(fd),
      }).then((r) => {
        if (!r.ok && process.env.NODE_ENV === "development") {
          console.warn("[quick-list] user_listing_board_model_data:", r.error)
        }
      })

      const imageRows = slots.map((im, index) => ({
        listing_id: listingId,
        url: im.url!,
        thumbnail_url: im.thumbnailUrl ?? null,
        is_primary: index === 0,
        sort_order: index,
      }))
      const { error: imagesInsertError } = await supabase
        .from("listing_images")
        .insert(imageRows)
      if (imagesInsertError) {
        // Roll back the just-created listing so a photo failure never leaves
        // an orphaned active listing; the seller can retry cleanly.
        await supabase.from("listings").delete().eq("id", listingId).eq("user_id", user.id)
        throw new Error(sellSubmitErrorMessage(imagesInsertError, "Failed to save listing photos"))
      }

      requestKlaviyoListingCreated(listingId)
      void applyBoardListingPublishedSideEffectsAction(listingId).catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[quick-list] publish side effects:", err)
        }
      })

      if (boardLocationCity) {
        void saveDefaultListingLocationAction({
          city: boardLocationCity,
          state: (boardLocationState ?? "").trim() || undefined,
        })
      }
      void revalidateListingDetailAfterListingMutation({
        listingId,
        slug: listingSlug,
      }).catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[quick-list] listing-detail cache revalidation:", err)
        }
      })
      void revalidateNavSearchSuggestAfterListingPublished().catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[quick-list] nav search suggest cache revalidation:", err)
        }
      })

      logSellFunnelEvent({
        listingType: "surfboards",
        event: "publish_succeeded",
        listingId,
        durationMs: Date.now() - publishStartedAt,
      })
      retainOverlayUntilNavigation = true
      setJustPublishedListingMarker({
        listingId,
        slug: listingSlug,
        section: "surfboards",
      })
      router.push(
        listingDetailHref({ id: listingId, slug: listingSlug, section: "surfboards" }),
      )
    } catch (error: unknown) {
      const aborted = isSellSubmitAbortError(error)
      const msg = sellSubmitErrorMessage(error, "Failed to create listing")
      if (!aborted) {
        console.error("[quick-list] Error creating listing:", msg, error)
      }
      logSellFunnelEvent({
        listingType: "surfboards",
        event: "publish_failed",
        message: aborted ? "aborted" : msg,
        durationMs: Date.now() - publishStartedAt,
      })
      setPublishPreview(null)
      toast.error(aborted ? SELL_SUBMIT_INTERRUPTED_MESSAGE : "Something went wrong. Please try again.", {
        duration: 8000,
        ...(aborted ? {} : { description: msg }),
      })
    } finally {
      publishInFlightRef.current = false
      if (!retainOverlayUntilNavigation) setPublishing(false)
    }
  }

  const boardComplete = Boolean(formData.brand.trim() && formData.category.trim())

  return (
    <main className={cn("min-h-screen w-full", SELL_PAGE_GROUND_CLASS)}>
      {publishing && publishPreview ? <QuickPublishOverlay {...publishPreview} /> : null}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        aria-busy={publishing}
        className="mx-auto w-full max-w-2xl px-4 pb-36 pt-8 sm:pt-10"
      >
        <header className="mb-6 space-y-1.5 sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            List your surfboard
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Photos first, six quick things, and it&rsquo;s live.{" "}
            <Link
              href="/sell?type=surfboard"
              className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Want the full step-by-step form?
            </Link>
          </p>
        </header>

        <div className="space-y-4 sm:space-y-5">
          <QuickPhotoHero
            images={images}
            maxPhotos={QUICK_LIST_MAX_PHOTOS}
            fileInputId={listingPhotosInputId}
            photosFileDragActive={photos.photosFileDragActive}
            onImageInputChange={photos.handleImageInputChange}
            onDragEnter={photos.handlePhotosFileDragEnter}
            onDragLeave={photos.handlePhotosFileDragLeave}
            onDragOver={photos.handlePhotosFileDragOver}
            onDrop={photos.handlePhotosFileDrop}
            onDragEnd={photos.handlePhotosDragEnd}
            onRemove={photos.handlePhotoTileRemove}
            onRetry={photos.handlePhotoTileRetry}
            onRotate180={photos.handlePhotoTileRotate}
            photoDragSensors={photos.photoDragSensors}
            minPhotos={LISTING_MIN_PHOTOS}
          />

          <QuickEssentialCard
            title="Board"
            hint="Pick from the catalog and we'll fill in what we can."
            complete={boardComplete}
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="quick-listing-brand">Brand</Label>
                  <SurfboardTitleIndexInput
                    id="quick-listing-brand"
                    placeholder="e.g., Channel Islands"
                    value={formData.brand}
                    committedDirectoryBrandLabel={
                      formData.boardBrandId
                        ? formData.boardLinkedBrandName.trim() ||
                          formData.brand.trim() ||
                          null
                        : null
                    }
                    onChange={(v) => {
                      setFormData((f) => {
                        const clear =
                          f.boardBrandId &&
                          f.boardLinkedBrandName &&
                          v.trim() !== f.boardLinkedBrandName.trim()
                        if (!clear) return { ...f, brand: v }
                        return {
                          ...f,
                          brand: v,
                          boardBrandId: "",
                          boardBrandModelId: "",
                          boardIndexBrandSlug: "",
                          boardIndexModelSlug: "",
                          boardIndexLabel: "",
                          boardModelName: "",
                          boardLinkedBrandName: "",
                        }
                      })
                    }}
                    boardLength={boardLengthFormatted}
                    onSelectModel={(opt: IndexBoardModelSelection) => {
                      const modelFromCatalog =
                        opt.modelName.trim() ||
                        (opt.modelSlug.trim() ? opt.label.trim() : "")
                      setFormData((f) => ({
                        ...f,
                        boardBrandId: opt.brandId,
                        boardBrandModelId: "",
                        boardIndexBrandSlug: opt.brandSlug,
                        boardIndexModelSlug: opt.modelSlug,
                        boardIndexLabel: opt.label,
                        boardModelName: modelFromCatalog,
                        brand: opt.brandName,
                        boardLinkedBrandName: opt.brandName,
                      }))
                    }}
                    onRequestBrand={openCatalogRequestFromBrand}
                  />
                </div>
                <div className="min-w-0">
                  <SellBoardModelField
                    directoryBrandId={formData.boardBrandId}
                    linkedBrandDisplayName={
                      formData.boardLinkedBrandName.trim() || formData.brand.trim()
                    }
                    modelName={formData.boardModelName}
                    modelCatalogSlug={formData.boardIndexModelSlug}
                    boardIndexBrandSlug={formData.boardIndexBrandSlug}
                    onCatalogModelChange={(patch) =>
                      setFormData((f) => ({ ...f, ...patch }))
                    }
                    onRequestCatalogAdd={openCatalogRequestFromModel}
                  />
                </div>
              </div>

              <SellFacetChipGroup
                label="Board shape"
                value={formData.category}
                options={boardCategoryOptions}
                onValueChange={(value) => {
                  if (!value) {
                    setFormData((f) => ({ ...f, category: "", boardType: "" }))
                    return
                  }
                  setFormData((f) => ({
                    ...f,
                    category: value,
                    boardType: boardTypeFromCategoryId(value),
                  }))
                }}
              />
            </div>

            <RequestBrandModelDialog
              open={catalogRequestVariant !== null}
              onOpenChange={(next) => {
                if (!next) setCatalogRequestVariant(null)
              }}
              variant={catalogRequestVariant ?? "full"}
              defaultBrandName={
                formData.boardLinkedBrandName.trim() || formData.brand.trim()
              }
              defaultModelName={formData.boardModelName.trim()}
              onBrandSubmitted={(brandName) => {
                setFormData((f) => ({
                  ...f,
                  brand: brandName,
                  boardBrandId: "",
                  boardBrandModelId: "",
                  boardIndexBrandSlug: "",
                  boardIndexModelSlug: "",
                  boardIndexLabel: "",
                  boardModelName: "",
                  boardLinkedBrandName: "",
                }))
              }}
            />
          </QuickEssentialCard>

          <QuickEssentialCard
            title="Condition"
            complete={isListingSellableCondition(formData.condition)}
          >
            <SellFacetChipGroup
              label={<span className="sr-only">Condition</span>}
              value={formData.condition}
              options={LISTING_CONDITION_SELL_OPTIONS}
              onValueChange={(value) =>
                setFormData((f) => ({ ...f, condition: value }))
              }
            />
          </QuickEssentialCard>

          <QuickEssentialCard title="Price" complete={priceValid}>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                aria-hidden
              >
                $
              </span>
              <Input
                id="quick-listing-price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                aria-label="Listing price in dollars"
                className={cn(SELL_CONTROL_CLASS, "pl-7 text-base")}
                value={formData.price}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, price: e.target.value }))
                }
              />
            </div>
            <SellEarningsBreakdown listingPrice={formData.price} className="mt-3" />
          </QuickEssentialCard>

          <QuickEssentialCard
            title="Location"
            hint="Where the board is — pickup area, shown as city + state."
            complete={locationSet}
          >
            <LocationPicker
              onLocationSelect={(loc) => {
                setFormData((f) => ({
                  ...f,
                  locationLat: loc.lat,
                  locationLng: loc.lng,
                  locationCity: loc.city,
                  locationState: loc.state,
                  locationDisplay: loc.displayName,
                }))
              }}
              onLocationClear={() => {
                setFormData((f) => ({
                  ...f,
                  locationLat: 0,
                  locationLng: 0,
                  locationCity: "",
                  locationState: "",
                  locationDisplay: "",
                }))
              }}
              prefillSuggested={locationPrefillSuggested}
              initialLat={formData.locationLat || undefined}
              initialLng={formData.locationLng || undefined}
              initialCity={formData.locationCity}
              initialState={formData.locationState}
              initialDisplay={formData.locationDisplay}
            />
          </QuickEssentialCard>

          <QuickEssentialCard title="Delivery" complete>
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-listingHeart" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">Local pickup</p>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Quick List publishes as pickup-only. Want to offer Reswell shipping
                  too? Add it any time after publishing by editing your listing.
                </p>
              </div>
            </div>
          </QuickEssentialCard>

          <QuickEssentialCard
            title="Title"
            complete={
              Boolean(formData.title.trim()) &&
              formData.title.trim().length <= LISTING_TITLE_MAX_LENGTH
            }
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                {titleIsAuto ? (
                  <span className="inline-flex items-center rounded-full bg-listingHeart/10 px-2 py-0.5 text-[11px] font-medium text-listingHeart ring-1 ring-inset ring-listingHeart/25">
                    Auto — edit anytime
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    formData.title.length > LISTING_TITLE_MAX_LENGTH
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                  aria-live="polite"
                >
                  {formData.title.length}/{LISTING_TITLE_MAX_LENGTH}
                </span>
              </div>
              <Input
                id="quick-listing-title"
                className={SELL_CONTROL_CLASS}
                placeholder={`e.g., 6'0 CI Rookie`}
                value={formData.title}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, title: e.target.value }))
                }
                autoComplete="off"
                maxLength={LISTING_TITLE_MAX_LENGTH}
                aria-label="Listing title"
              />
            </div>
          </QuickEssentialCard>

          <div>
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5 text-left shadow-surface transition-colors sm:p-6",
                "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart focus-visible:ring-offset-2",
              )}
            >
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Add more details
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Description, dimensions, and fin setup — buyers love specifics.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  detailsOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <SmoothCollapse open={detailsOpen}>
              <div className="mt-3 space-y-6 rounded-2xl border border-border bg-white p-5 shadow-surface sm:p-6">
                <SellListingDescriptionField
                  id="quick-listing-description"
                  value={formData.description}
                  onChange={(description) =>
                    setFormData((f) => ({ ...f, description }))
                  }
                  placeholder="Describe your board — condition, wear, why you're selling…"
                  maxLength={1000}
                  onGenerate={handleGenerateDescription}
                  generating={descriptionGenerating}
                />
                <SellBoardDimensionsPicker
                  values={{
                    boardLength: formData.boardLength,
                    boardWidthInches: formData.boardWidthInches,
                    boardThicknessInches: formData.boardThicknessInches,
                    boardVolumeL: formData.boardVolumeL,
                  }}
                  onChange={(patch) => setFormData((f) => ({ ...f, ...patch }))}
                  dimensionsRequired={false}
                />
                <SellBoardFacetFields
                  boardFins={formData.boardFins}
                  boardFinSystem={formData.boardFinSystem}
                  boardConstruction={formData.boardConstruction}
                  onBoardFinsChange={(value) =>
                    setFormData((f) => ({ ...f, boardFins: value }))
                  }
                  onBoardFinSystemChange={(value) =>
                    setFormData((f) => ({ ...f, boardFinSystem: value }))
                  }
                  onBoardConstructionChange={(value) =>
                    setFormData((f) => ({ ...f, boardConstruction: value }))
                  }
                />
              </div>
            </SmoothCollapse>
          </div>

          {validationBanner ? (
            <div
              id="quick-publish-validation-banner"
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {validationBanner}
            </div>
          ) : null}
        </div>

        <QuickPublishBar
          missing={missingEssentials}
          uploadingPhotos={uploadingCount > 0 || (images.length > 0 && !imagesUploadReady)}
          publishing={publishing}
        />
      </form>
    </main>
  )
}
