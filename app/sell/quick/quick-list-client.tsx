"use client"
/**
 * Quick List — one-screen surfboard listing: photo, title, description,
 * price, and local pickup. Publish mirrors the wizard create path.
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
import { useRouter, useSearchParams } from "next/navigation"
import { goBackFromSellForm } from "@/lib/sell-flow/go-back-from-sell-form"
import { logSellForkToFull } from "@/lib/sell-flow/log-sell-funnel-event"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

import {
  SELL_CONTROL_CLASS,
  SELL_FORM_COLUMN_CLASS,
  SELL_PAGE_GROUND_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { BoardSellViewToolbar } from "@/components/features/sell/board-sell-view-toolbar"
import {
  SELL_FORM_SECTION_NAV_ITEMS,
  SellSectionNav,
  SellSectionNavHorizontal,
} from "@/components/features/sell/sell-section-nav"
import { QuickEssentialCard } from "@/components/features/sell/quick/quick-essential-card"
import { QuickPhotoHero } from "@/components/features/sell/quick/quick-photo-hero"
import { QuickPublishBar } from "@/components/features/sell/quick/quick-publish-bar"
import { QuickPublishOverlay } from "@/components/features/sell/quick/quick-publish-overlay"
import { useListingPhotoUpload } from "@/components/features/sell/hooks/use-listing-photo-upload"
import { useSellAccessoryDraftRecovery } from "@/components/features/sell/hooks/use-sell-accessory-draft-recovery"
import {
  sellFormSnapshotLooksFilled,
  useSellServerDraft,
} from "@/components/features/sell/hooks/use-sell-server-draft"
import { usePendingPublishResume } from "@/components/features/sell/hooks/use-pending-publish-resume"
import {
  BOARD_SELL_STEP_BY_SECTION_ID,
  persistBoardSellFlowStep,
} from "@/lib/sell-flow/board-sell-flow-step"
import {
  persistBoardSellViewMode,
  type BoardSellViewMode,
} from "@/lib/sell-flow/board-sell-view-mode"
import { persistListingDraftSnapshot } from "@/lib/sell-flow/persist-listing-draft-snapshot"
import { markPendingPublish } from "@/lib/sell-flow/session-keys"
import type { SellListingDraftFormSnapshot } from "@/lib/sell-listing-draft-idb"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellFacetChipGroup } from "@/components/features/sell/sell-board-facet-fields"
import { SellEarningsBreakdown } from "@/components/features/sell/sell-earnings-breakdown"
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
import { type BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import { listingDimensionsColumnFromSurfboardSellForm } from "@/lib/listing-dimensions-storage"
import {
  boardBrowseFacetFieldsForDb,
  finsSetupFieldForDb,
} from "@/lib/listing-facet-write"
import {
  boardCategoryMap,
  boardTypeFromCategoryId,
  resolveListingBoardTypeFromCategory,
} from "@/lib/utils/board-type-from-category-id"
import { sellerPurchasePriceToDb } from "@/lib/utils/seller-purchase-price"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { applyBoardListingPublishedSideEffectsAction } from "@/lib/actions/boardListingPublishActions"
import { revalidateListingDetailAfterListingMutation } from "@/app/actions/listing-detail-cache"
import { revalidateNavSearchSuggestAfterListingPublished } from "@/app/actions/nav-search-suggest-cache"
import { saveDefaultListingLocationAction } from "@/app/actions/sell-default-location"
import { setJustPublishedListingMarker } from "@/lib/sell-flow/just-published"
import {
  logSellFieldInteracted,
  logSellFunnelEvent,
} from "@/lib/sell-flow/log-sell-funnel-event"
import { resolveSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
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
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import {
  readSellSavedListingLocations,
  rememberSellSavedListingLocation,
} from "@/lib/utils/sell-saved-listing-locations"

const QUICK_LIST_PATH = "/sell/quick"
const QUICK_LIST_MAX_PHOTOS = 12
const DEFAULT_CATEGORY_ID = boardCategoryMap.other
const DEFAULT_BOARD_TYPE = boardTypeFromCategoryId(DEFAULT_CATEGORY_ID) || "other"

function createInitialQuickListFormData() {
  return {
    title: "",
    description: "",
    price: "",
    sellerPurchasePrice: "",
    category: DEFAULT_CATEGORY_ID,
    condition: "",
    brand: "",
    boardFulfillment: "pickup_only" as BoardFulfillmentChoice,
    /** Flat rate keeps Quick List shipping setup to one price field. */
    boardShippingCostMode: "flat" as BoardShippingCostMode,
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
    boardType: DEFAULT_BOARD_TYPE,
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
  const searchParams = useSearchParams()
  const startFresh = searchParams.get("new") === "1"
  const supabase = useMemo(() => createClient(), [])
  const openSignIn = useSignInGate()
  const listingPhotosInputId = useId()
  const formRef = useRef<HTMLFormElement | null>(null)

  const [formData, setFormData] = useState<QuickListFormData>(createInitialQuickListFormData)
  const formDataRef = useRef(formData)
  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  const [publishing, setPublishing] = useState(false)
  const [publishPreview, setPublishPreview] = useState<QuickPublishPreview | null>(null)
  const [validationBanner, setValidationBanner] = useState<string | null>(null)
  const publishInFlightRef = useRef(false)

  const signInReturnPath = useCallback(() => QUICK_LIST_PATH, [])
  const flushDraftNowRef = useRef<() => Promise<void>>(async () => {})

  const photos = useListingPhotoUpload({
    maxPhotos: QUICK_LIST_MAX_PHOTOS,
    signInReturnPath,
    openSignIn,
    supabase,
    funnelListingType: "surfboards",
    persistBeforeSignIn: () => flushDraftNowRef.current(),
    // Keep photos local until Publish — don't interrupt mid-form with auth.
    promptSignInOnUpload: false,
  })
  const {
    images,
    imagesUploadReady,
    uploadingCount,
    setImages,
    handlePhotoTileRetry,
    imagesRef,
    removedImageIds,
  } = photos
  const removedImageIdsRef = useRef(removedImageIds)
  removedImageIdsRef.current = removedImageIds

  const restoreFormFromDraft = useCallback((snapshot: SellListingDraftFormSnapshot) => {
    setFormData((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(prev) as Array<keyof QuickListFormData>) {
        const value = snapshot[key as string]
        if (value === undefined) continue
        if (typeof value === typeof prev[key]) {
          ;(next as Record<string, unknown>)[key as string] = value
        }
      }
      if (!next.category.trim()) {
        next.category = DEFAULT_CATEGORY_ID
        next.boardType = DEFAULT_BOARD_TYPE
      }
      return next
    })
  }, [])

  const { draftHydrated, clearRecoveredDraft, flushDraftNow } =
    useSellAccessoryDraftRecovery({
      listingType: "board",
      editId: null,
      startFresh,
      formSnapshot: formData as SellListingDraftFormSnapshot,
      images,
      onRestoreForm: restoreFormFromDraft,
      setImages,
      retryPhotoSlot: handlePhotoTileRetry,
    })

  flushDraftNowRef.current = () => flushDraftNow({ includeInFlightPhotos: true })

  const buildQuickDraftPayload = useCallback(
    (listingId: string | null) => ({
      section: "surfboards" as const,
      listingId,
      title: formData.title,
      description: formData.description,
      price: formData.price,
      sellerPurchasePrice: formData.sellerPurchasePrice,
      condition: formData.condition,
      category: formData.category,
      brand: formData.brand,
      boardFulfillment: formData.boardFulfillment,
      boardShippingCostMode: formData.boardShippingCostMode,
      boardShippingPrice: formData.boardShippingPrice,
      surfboardShippingTier: formData.surfboardShippingTier,
      surfboardShippingPackBand: formData.surfboardShippingPackBand,
      adminCustomShippingCarton: formData.adminCustomShippingCarton,
      reswellPackageLengthIn: formData.reswellPackageLengthIn,
      reswellPackageWidthIn: formData.reswellPackageWidthIn,
      reswellPackageHeightIn: formData.reswellPackageHeightIn,
      reswellPackageWeightLb: formData.reswellPackageWeightLb,
      reswellPackageWeightOz: formData.reswellPackageWeightOz,
      autoPriceDrop: formData.autoPriceDrop,
      autoPriceDropFloor: formData.autoPriceDropFloor,
      buyerOffers: formData.buyerOffers,
      boardType: formData.boardType,
      boardLength: formData.boardLength,
      boardWidthInches: formData.boardWidthInches,
      boardThicknessInches: formData.boardThicknessInches,
      boardVolumeL: formData.boardVolumeL,
      boardFins: formData.boardFins,
      boardTail: formData.boardTail,
      boardFinSystem: formData.boardFinSystem,
      boardConstruction: formData.boardConstruction,
      boardBrandId: formData.boardBrandId,
      boardBrandModelId: formData.boardBrandModelId,
      boardModelName: formData.boardModelName,
      locationLat: formData.locationLat,
      locationLng: formData.locationLng,
      locationCity: formData.locationCity,
      locationState: formData.locationState,
    }),
    [formData],
  )

  const { draftSaveStatus: serverDraftSaveStatus } = useSellServerDraft({
    section: "surfboards",
    supabase,
    editId: null,
    editListingStatus: "draft",
    editLoading: false,
    draftHydrated,
    loading: publishing,
    formLooksFilled: () =>
      sellFormSnapshotLooksFilled("board", formData as SellListingDraftFormSnapshot),
    buildDraftPayload: buildQuickDraftPayload,
    imagesRef,
    removedImageIdsRef,
    setImages,
    allowUnsigned: true,
    syncEditUrl: false,
    autosaveMs: 800,
    autosaveWatch: { formData, photoCount: images.length },
    hideDraftControls: true,
  })

  const goToFullListing = useCallback(
    async (forkMessage: string, mode: BoardSellViewMode = "guided") => {
      persistBoardSellViewMode(mode)
      await flushDraftNow()
      logSellForkToFull({ message: forkMessage })
      router.push("/sell/boards")
    },
    [flushDraftNow, router],
  )

  const goToGuidedStep = useCallback(
    (sectionId: string) => {
      const step = BOARD_SELL_STEP_BY_SECTION_ID[sectionId]
      if (step) persistBoardSellFlowStep(step)
      void goToFullListing(`step_${step ?? "product"}`, "guided")
    },
    [goToFullListing],
  )

  usePendingPublishResume({
    listingKind: "quick",
    editId: null,
    draftHydrated,
    formRef,
    imagesRef,
  })

  useEffect(() => {
    if (!startFresh) return
    router.replace(QUICK_LIST_PATH, { scroll: false })
  }, [router, startFresh])

  useEffect(() => {
    try {
      if (sessionStorage.getItem("reswell.sell.funnel.started.surfboards") === "1") return
      sessionStorage.setItem("reswell.sell.funnel.started.surfboards", "1")
    } catch {
      /* continue */
    }
    const entryPoint = resolveSellEntryPoint()
    logSellFunnelEvent({
      listingType: "surfboards",
      event: "flow_started",
      message: "quick",
      entryPoint,
    })
  }, [])

  const trackField = useCallback((field: string) => {
    logSellFieldInteracted({ listingType: "surfboards", field })
  }, [])

  useEffect(() => {
    if (!publishing) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [publishing])

  const [locationPrefillSuggested, setLocationPrefillSuggested] =
    useState<LocationPrefillSuggested | null>(null)

  useEffect(() => {
    let cancelled = false
    const localSaved = readSellSavedListingLocations()
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "default_listing_city, default_listing_state, default_listing_lat, default_listing_lng, default_listing_display",
        )
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      const city = (profile?.default_listing_city ?? "").trim()
      if (!city) {
        const first = localSaved[0]
        if (first) {
          setLocationPrefillSuggested({
            city: first.city,
            state: first.state,
            displayLabel: first.displayName,
          })
        }
        return
      }
      const state = (profile?.default_listing_state ?? "").trim()
      const display =
        (profile?.default_listing_display ?? "").trim() ||
        [city, state].filter(Boolean).join(", ")
      setLocationPrefillSuggested({
        city,
        state,
        displayLabel: display,
      })
      const lat =
        typeof profile?.default_listing_lat === "number" &&
        Number.isFinite(profile.default_listing_lat)
          ? profile.default_listing_lat
          : null
      const lng =
        typeof profile?.default_listing_lng === "number" &&
        Number.isFinite(profile.default_listing_lng)
          ? profile.default_listing_lng
          : null
      if (lat != null && lng != null && !(lat === 0 && lng === 0)) {
        rememberSellSavedListingLocation({
          city,
          state,
          lat,
          lng,
          displayName: display,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const priceValid = useMemo(() => {
    const n = Number.parseFloat(formData.price.trim().replace(/,/g, ""))
    return Number.isFinite(n) && n > 0
  }, [formData.price])

  const locationSet = Boolean(
    formData.locationCity.trim() && formData.locationState.trim(),
  )

  // Quick List is pickup-only — coerce any restored draft that had shipping on.
  useEffect(() => {
    if (formData.boardFulfillment === "pickup_only") return
    setFormData((f) =>
      f.boardFulfillment === "pickup_only"
        ? f
        : { ...f, boardFulfillment: "pickup_only" },
    )
  }, [formData.boardFulfillment])

  const missingEssentials = useMemo(() => {
    const items: string[] = []
    if (images.length < LISTING_MIN_PHOTOS) items.push("a photo")
    if (!formData.title.trim()) items.push("a title")
    if (!formData.description.trim()) items.push("a description")
    if (!priceValid) items.push("price")
    if (!isListingSellableCondition(formData.condition)) items.push("condition")
    if (!locationSet) items.push("location")
    return items
  }, [
    images.length,
    formData.title,
    formData.description,
    formData.condition,
    priceValid,
    locationSet,
  ])

  const sellSectionCompletion = useMemo(
    () => ({
      "sell-section-product":
        Boolean(formData.title.trim()) &&
        isListingSellableCondition(formData.condition),
      "sell-section-photos":
        images.length >= LISTING_MIN_PHOTOS && Boolean(formData.description.trim()),
      "sell-section-pricing": priceValid,
      "sell-section-shipping": locationSet,
    }),
    [
      formData.title,
      formData.condition,
      formData.description,
      images.length,
      priceValid,
      locationSet,
    ],
  )

  function showValidationBanner(message: string) {
    setValidationBanner(message)
    requestAnimationFrame(() => {
      document.getElementById("quick-publish-validation-banner")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    })
  }

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
        await persistListingDraftSnapshot({
          listingType: "board",
          formData: formDataRef.current as SellListingDraftFormSnapshot,
          images: photos.imagesRef.current,
          userId: null,
          includeInFlightPhotos: true,
        })
        markPendingPublish("quick")
        toast.message("Listing saved on this device", {
          description: "Create a free account to publish — you’ll pick up right here.",
        })
        openSignIn(QUICK_LIST_PATH, {
          preferSignUp: true,
          skipSessionProbe: true,
        })
        return
      }

      const fd = {
        ...formDataRef.current,
        boardFulfillment: "pickup_only" as BoardFulfillmentChoice,
      }
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
        showValidationBanner(validationMessage)
        return
      }

      setPublishing(true)
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

      // Quick List publishes pickup-only; shipping is configured on the full form.
      const boardLocationLat = fd.locationLat ? fd.locationLat : null
      const boardLocationLng = fd.locationLng ? fd.locationLng : null
      const boardLocationCity = fd.locationCity.trim() || null
      const boardLocationState = fd.locationState.trim() || null
      const dimensionsStored = listingDimensionsColumnFromSurfboardSellForm({
        ...fd,
        boardFulfillment: "pickup_only",
      })
      const packedRow = reswellPackageFieldsToDb({
        ...fd,
        boardFulfillment: "pickup_only",
      })

      const listingFields = {
        title: resolvedListingTitle,
        description: fd.description,
        price: parseFloat(fd.price),
        condition: fd.condition,
        section: "surfboards" as const,
        category_id: fd.category || DEFAULT_CATEGORY_ID,
        board_type: resolveListingBoardTypeFromCategory(
          fd.category || DEFAULT_CATEGORY_ID,
          fd.boardType || DEFAULT_BOARD_TYPE,
        ),
        dimensions: dimensionsStored,
        fins_setup: finsSetupFieldForDb(fd.boardFins),
        tail_shape: fd.boardTail ? fd.boardTail : null,
        ...boardBrowseFacetFieldsForDb(fd),
        latitude: boardLocationLat,
        longitude: boardLocationLng,
        city: boardLocationCity,
        state: boardLocationState,
        shipping_available: false,
        local_pickup: true,
        shipping_price: null,
        board_shipping_cost_mode: null,
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
            "[quick-list] DB rejected legacy listing dimension columns; saved without them.",
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
          lat: boardLocationLat ?? undefined,
          lng: boardLocationLng ?? undefined,
          display: fd.locationDisplay.trim() || undefined,
        })
        if (
          boardLocationLat != null &&
          boardLocationLng != null &&
          !(boardLocationLat === 0 && boardLocationLng === 0)
        ) {
          rememberSellSavedListingLocation({
            city: boardLocationCity,
            state: boardLocationState ?? "",
            lat: boardLocationLat,
            lng: boardLocationLng,
            displayName:
              fd.locationDisplay.trim() ||
              [boardLocationCity, boardLocationState].filter(Boolean).join(", "),
          })
        }
      }
      void revalidateListingDetailAfterListingMutation({
        listingId,
        slug: listingSlug,
      }).catch(() => {})
      void revalidateNavSearchSuggestAfterListingPublished().catch(() => {})

      await clearRecoveredDraft()

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

  return (
    <main className={cn("min-h-screen w-full", SELL_PAGE_GROUND_CLASS)}>
      {publishing && publishPreview ? <QuickPublishOverlay {...publishPreview} /> : null}

      <div className="container relative mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10 lg:max-w-6xl">
        <header className={cn("mb-6 space-y-3 sm:mb-8", SELL_FORM_COLUMN_CLASS, "mx-auto lg:mx-0")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-3">
              <button
                type="button"
                onClick={() => goBackFromSellForm(router)}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back
              </button>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight">
                Quick list a board
              </h1>
            </div>
            {serverDraftSaveStatus === "saving" || serverDraftSaveStatus === "saved" ? (
              <p className="shrink-0 pt-1 text-xs text-muted-foreground" aria-live="polite">
                {serverDraftSaveStatus === "saving" ? "Saving…" : "Draft saved"}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground sm:text-base">
            Photo, title, price — publish in seconds.{" "}
            <Link
              href="/sell/boards"
              onClick={(e) => {
                e.preventDefault()
                void goToFullListing("advanced_link", "advanced")
              }}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Need more detail?
            </Link>
          </p>
        </header>

        <div className="flex w-full flex-col gap-10 lg:flex-row lg:items-stretch lg:gap-12 xl:gap-16">
          <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-64">
            <div className="sticky top-24">
              <SellSectionNav
                items={SELL_FORM_SECTION_NAV_ITEMS}
                sectionCompletion={sellSectionCompletion}
                onSelectSection={goToGuidedStep}
                className="static"
              />
            </div>
          </aside>

          <div className={cn("min-w-0", SELL_FORM_COLUMN_CLASS)}>
            <SellSectionNavHorizontal
              items={SELL_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
              onSelectSection={goToGuidedStep}
              className="mb-8 lg:hidden"
            />

            <form
              ref={formRef}
              onSubmit={(e) => void handleSubmit(e)}
              aria-busy={publishing}
              className="space-y-4 sm:space-y-5"
            >
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
            title="Title"
            complete={
              Boolean(formData.title.trim()) &&
              formData.title.trim().length <= LISTING_TITLE_MAX_LENGTH
            }
          >
            <div className="space-y-2">
              <div className="flex justify-end">
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
                onChange={(e) => {
                  trackField("title")
                  setFormData((f) => ({ ...f, title: e.target.value }))
                }}
                autoComplete="off"
                maxLength={LISTING_TITLE_MAX_LENGTH}
                aria-label="Listing title"
              />
            </div>
          </QuickEssentialCard>

          <QuickEssentialCard
            title="Description"
            complete={Boolean(formData.description.trim())}
          >
            <SellListingDescriptionField
              id="quick-listing-description"
              value={formData.description}
              onChange={(description) => {
                trackField("description")
                setFormData((f) => ({ ...f, description }))
              }}
              placeholder="Condition, wear, why you're selling…"
              maxLength={1000}
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
                onChange={(e) => {
                  trackField("price")
                  setFormData((f) => ({ ...f, price: e.target.value }))
                }}
                onFocus={() => trackField("price")}
              />
            </div>
            <SellEarningsBreakdown listingPrice={formData.price} className="mt-3" />
          </QuickEssentialCard>

          <QuickEssentialCard
            title="Condition"
            complete={isListingSellableCondition(formData.condition)}
          >
            <SellFacetChipGroup
              label={<span className="sr-only">Condition</span>}
              value={formData.condition}
              options={LISTING_CONDITION_SELL_OPTIONS}
              onValueChange={(value) => {
                trackField("condition")
                setFormData((f) => ({ ...f, condition: value }))
              }}
            />
          </QuickEssentialCard>

          <QuickEssentialCard
            title="Location"
            hint="City + state for local pickup."
            complete={locationSet}
          >
            <LocationPicker
              onLocationSelect={(loc) => {
                trackField("location")
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

          <QuickPublishBar
            missing={missingEssentials}
            uploadingPhotos={uploadingCount > 0 || (images.length > 0 && !imagesUploadReady)}
            publishing={publishing}
          />

          {validationBanner ? (
            <div
              id="quick-publish-validation-banner"
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {validationBanner}
            </div>
          ) : null}

              <BoardSellViewToolbar
                viewMode="quick"
                onViewModeChange={(mode) => {
                  void goToFullListing(`mode_${mode}`, mode)
                }}
                onSelectQuickList={() => {
                  /* already on Quick */
                }}
                searchAgainHref="/sell"
                showBack={false}
                showContinue={false}
                onBack={() => {}}
                onContinue={() => {}}
                disabled={publishing}
              />
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
