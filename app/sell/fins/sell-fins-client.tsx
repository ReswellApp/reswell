"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { LocationPicker } from "@/components/location-picker"
import { SellFormSection } from "@/components/features/sell/sell-form-section"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellFinsFacetFields } from "@/components/features/sell/sell-fins-facet-fields"
import { SellFinsCatalogSearch } from "@/components/features/sell/sell-fins-catalog-search"
import type { FinCatalogSearchSelection } from "@/lib/types/fin-catalog-search"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  SELL_FINS_FORM_SECTION_NAV_ITEMS,
} from "@/components/features/sell/sell-section-nav"
import { SellFlowFormColumnSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"
import { SellListingPhotoGrid } from "@/components/features/sell/sell-listing-photo-grid"
import { SellPublishValidationBanner } from "@/components/features/sell/sell-publish-validation-banner"
import { useListingPhotoUpload } from "@/components/features/sell/hooks/use-listing-photo-upload"
import { useSellListingDraftPersistence } from "@/components/features/sell/hooks/use-sell-listing-draft-persistence"
import {
  sellFormSnapshotLooksFilled,
  useSellServerDraft,
} from "@/components/features/sell/hooks/use-sell-server-draft"
import { usePendingPublishResume } from "@/components/features/sell/hooks/use-pending-publish-resume"
import { createClient } from "@/lib/supabase/client"
import { resolveSellEditUser } from "@/lib/sell-flow/resolve-sell-edit-user"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import {
  FIN_LISTING_MAX_PHOTOS,
  FIN_LISTING_TITLE_MAX_LENGTH,
} from "@/lib/validations/fin-listing"
import {
  createFinListingAction,
  updateFinListingAction,
} from "@/lib/actions/finListingActions"
import { buildFinListingPersistFields } from "@/lib/fin-listing-persist-fields"
import { computeFinSellSectionCompletion } from "@/lib/fin-sell-section-completion"
import { sellFormConditionValue } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { singleFinSetupSlugForForm } from "@/lib/listing-fin-setup-tags"
import {
  clearImpersonation,
  clearImpersonationStorageIfCookieMissing,
  getImpersonation,
} from "@/lib/impersonation"
import { reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import {
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
} from "@/lib/board-measurements"
import { shippingPriceToFormValue } from "@/lib/sell-flow/shipping-price-to-form-value"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import { scrollPublishValidationBannerIntoView } from "@/lib/sell-flow/scroll-section-into-view"
import { validateFinListingForm } from "@/lib/sell-flow/validate-fin-listing-form"
import { persistListingDraftSnapshot } from "@/lib/sell-flow/persist-listing-draft-snapshot"
import {
  clearPendingPublish,
  markPendingPublish,
  sellFlowStepSessionKey,
  SELL_SUPPRESS_IDB_RESTORE_KEY,
} from "@/lib/sell-flow/session-keys"
import {
  clearSellListingDraft,
  type SellListingDraftFormSnapshot,
} from "@/lib/sell-listing-draft-idb"
import {
  clearSellServerDraftListingId,
  getSellServerDraftListingId,
  replaceSellDraftEditUrl,
  setSellServerDraftListingId,
} from "@/lib/sell-draft-local-meta"
import { cn } from "@/lib/utils"
import { AdminBulkListingBanner } from "@/components/features/sell/admin-bulk-listing-banner"
import { finalizePeerListingCreate } from "@/lib/utils/admin-peer-listing-create-navigation"

function finShippingModeFromListing(listing: {
  shipping_available?: boolean | null
  shipping_price?: number | string | null
  board_shipping_cost_mode?: string | null
}): FinFormState["shippingMode"] {
  const stored = listing.board_shipping_cost_mode
  if (stored === "reswell" || stored === "free" || stored === "flat") return stored
  if (listing.shipping_available) {
    const n = Number.parseFloat(String(listing.shipping_price ?? 0).replace(/,/g, ""))
    if (Number.isFinite(n) && n > 0) return "flat"
    return "free"
  }
  return "reswell"
}

type FinFormState = {
  title: string
  description: string
  price: string
  sellerPurchasePrice: string
  condition: string
  size: string
  finSetup: string
  finSystem: string
  brand: string
  brandId: string | null
  model: string
  brandModelId: string | null
  locationCity: string
  locationState: string
  locationLat: number | null
  locationLng: number | null
  locationDisplay: string
  shippingAvailable: boolean
  localPickup: boolean
  shippingMode: "reswell" | "free" | "flat"
  shippingPrice: string
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
  buyerOffers: boolean
}

const INITIAL_STATE: FinFormState = {
  title: "",
  description: "",
  price: "",
  sellerPurchasePrice: "",
  condition: "",
  size: "",
  finSetup: "",
  finSystem: "",
  brand: "",
  brandId: null,
  model: "",
  brandModelId: null,
  locationCity: "",
  locationState: "",
  locationLat: null,
  locationLng: null,
  locationDisplay: "",
  shippingAvailable: true,
  localPickup: false,
  shippingMode: "reswell",
  shippingPrice: "",
  reswellPackageLengthIn: "",
  reswellPackageWidthIn: "",
  reswellPackageHeightIn: "",
  reswellPackageWeightLb: "",
  reswellPackageWeightOz: "",
  buyerOffers: true,
}

const FIN_FLOW_STEP_KEY = sellFlowStepSessionKey("fins") ?? "reswell.sell.fins.flowStep"

function readStoredFinSellFlowStep(): "search" | "form" | null {
  if (typeof window === "undefined") return null
  try {
    const value = sessionStorage.getItem(FIN_FLOW_STEP_KEY)
    if (value === "form" || value === "search") return value
  } catch {
    /* quota / private mode */
  }
  return null
}

function persistFinSellFlowStep(step: "search" | "form"): void {
  try {
    sessionStorage.setItem(FIN_FLOW_STEP_KEY, step)
  } catch {
    /* quota / private mode */
  }
}

function clearPersistedFinSellFlowStep(): void {
  try {
    sessionStorage.removeItem(FIN_FLOW_STEP_KEY)
  } catch {
    /* quota / private mode */
  }
}

export default function SellFinsFlow({
  editListingId = null,
  startAtSearch = false,
  startFresh = false,
}: {
  editListingId?: string | null
  startAtSearch?: boolean
  startFresh?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bulkSlotId = searchParams.get("bulk")?.trim() || null
  const wantsBlankListing = startFresh || searchParams.get("new") === "1"
  const signIn = useSignInGate()
  const fileInputId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const supabaseRef = useRef(createClient())
  const editId = editListingId?.trim() || null
  const draftPhotosPendingRef = useRef<ListingPhotoSlot[] | null>(null)
  const removedImageIdsRef = useRef<string[]>([])

  const [flowStep, setFlowStep] = useState<"search" | "form">(() => {
    if (editId) return "form"
    if (startAtSearch) return "search"
    return readStoredFinSellFlowStep() ?? "search"
  })
  const [form, setForm] = useState<FinFormState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [editLoading, setEditLoading] = useState(
    () =>
      Boolean(editId) ||
      (!startFresh &&
        searchParams.get("new") !== "1" &&
        Boolean(getSellServerDraftListingId("fins"))),
  )
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [editListingStatus, setEditListingStatus] = useState<string | null>(null)
  const [draftHydrated, setDraftHydrated] = useState(Boolean(editId))
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null)
  const [publishValidationBanner, setPublishValidationBanner] = useState<string | null>(null)
  const [startNewListingBusy, setStartNewListingBusy] = useState(false)

  const sellListingsHubHref = signedInUserId ? "/dashboard/listings" : "/boards"
  const finSellReturnPath = useCallback(
    () =>
      typeof window === "undefined"
        ? "/sell/fins"
        : `${window.location.pathname}${window.location.search}`,
    [],
  )

  const photoUpload = useListingPhotoUpload({
    maxPhotos: FIN_LISTING_MAX_PHOTOS,
    signInReturnPath: finSellReturnPath,
    openSignIn: signIn,
    supabase: supabaseRef.current,
  })

  const {
    images,
    setImages,
    imagesRef,
    removedImageIds,
    photosFileDragActive,
    uploadingCount,
    imagesUploadReady,
    readyImages,
    handleImageInputChange,
    handlePhotosFileDragEnter,
    handlePhotosFileDragLeave,
    handlePhotosFileDragOver,
    handlePhotosFileDrop,
    photoDragSensors,
    handlePhotosDragEnd,
    handlePhotoTileRemove,
    handlePhotoTileRetry,
    handlePhotoTileRotate,
    idbRestoreOptimizeQueueRef,
    hydrateExistingImages,
  } = photoUpload

  useEffect(() => {
    removedImageIdsRef.current = removedImageIds
  }, [removedImageIds])

  const restoreFormFromDraft = useCallback((snapshot: SellListingDraftFormSnapshot) => {
    setForm((prev) => ({
      ...prev,
      ...(snapshot as Partial<FinFormState>),
      brandId:
        typeof snapshot.brandId === "string" ? snapshot.brandId : prev.brandId,
      brandModelId:
        typeof snapshot.brandModelId === "string" ? snapshot.brandModelId : prev.brandModelId,
      locationLat:
        typeof snapshot.locationLat === "number" ? snapshot.locationLat : prev.locationLat,
      locationLng:
        typeof snapshot.locationLng === "number" ? snapshot.locationLng : prev.locationLng,
    }))
    const storedStep = snapshot.finFlowStep
    if (storedStep === "form" || storedStep === "search") {
      setFlowStep(storedStep)
      persistFinSellFlowStep(storedStep)
    }
  }, [])

  useSellListingDraftPersistence({
    listingType: "fins",
    editId,
    startFresh,
    draftHydrated,
    setDraftHydrated,
    formSnapshot: { ...form, finFlowStep: flowStep } as SellListingDraftFormSnapshot,
    images,
    onRestoreForm: restoreFormFromDraft,
    idbRestoreOptimizeQueueRef,
    draftPhotosPendingRef,
  })

  usePendingPublishResume({
    listingKind: "fins",
    editId,
    draftHydrated,
    formRef,
    imagesRef,
  })

  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    if (startFresh) {
      try {
        sessionStorage.setItem(SELL_SUPPRESS_IDB_RESTORE_KEY, "1")
      } catch {
        /* quota / private mode */
      }
      clearSellServerDraftListingId("fins")
      router.replace("/sell/fins", { scroll: false })
    }
  }, [router, startFresh])

  const handleStartNewListing = useCallback(async () => {
    setStartNewListingBusy(true)
    try {
      for (const im of imagesRef.current) {
        if (im.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(im.previewUrl)
      }
      draftPhotosPendingRef.current = null
      clearPersistedFinSellFlowStep()
      setFlowStep("search")
      setForm(INITIAL_STATE)
      setImages([])
      setPublishValidationBanner(null)
      clearSellServerDraftListingId("fins")
      const {
        data: { user },
      } = await supabaseRef.current.auth.getUser()
      if (user) await clearSellListingDraft(user.id, "fins")
      toast.message("Starting a new listing — saved drafts stay in your dashboard.")
    } finally {
      setStartNewListingBusy(false)
    }
  }, [])

  const buildFinDraftPayload = useCallback(
    (listingId: string | null) => ({
      section: "fins" as const,
      listingId,
      title: form.title,
      description: form.description,
      price: form.price,
      sellerPurchasePrice: form.sellerPurchasePrice,
      condition: form.condition,
      size: form.size || null,
      finSetup: form.finSetup || null,
      finSystem: form.finSystem || null,
      brand: form.brand,
      brandId: form.brandId,
      model: form.model,
      brandModelId: form.brandModelId,
      locationLat: form.locationLat,
      locationLng: form.locationLng,
      locationCity: form.locationCity,
      locationState: form.locationState,
      shippingCostMode: form.shippingMode,
      shippingPrice: form.shippingPrice,
      reswellPackageLengthIn: form.reswellPackageLengthIn,
      reswellPackageWidthIn: form.reswellPackageWidthIn,
      reswellPackageHeightIn: form.reswellPackageHeightIn,
      reswellPackageWeightLb: form.reswellPackageWeightLb,
      reswellPackageWeightOz: form.reswellPackageWeightOz,
      buyerOffers: form.buyerOffers,
    }),
    [form],
  )

  const serverDraft = useSellServerDraft({
    section: "fins",
    supabase: supabaseRef.current,
    editId,
    editListingStatus,
    editLoading,
    draftHydrated,
    loading: submitting,
    formLooksFilled: () =>
      sellFormSnapshotLooksFilled("fins", {
        ...form,
        finFlowStep: flowStep,
      } as SellListingDraftFormSnapshot),
    buildDraftPayload: buildFinDraftPayload,
    imagesRef: imagesRef,
    removedImageIdsRef: removedImageIdsRef,
    setImages,
    onStartNewListing: handleStartNewListing,
    startNewListingBusy,
    optimizingAny: uploadingCount > 0,
  })

  const { localServerDraftId, listingIsDraft, draftControls: finDraftControls } = serverDraft

  const resumeDraftId = editId ?? (wantsBlankListing ? null : localServerDraftId)

  useEffect(() => {
    void supabaseRef.current.auth.getUser().then(({ data: { user } }) => {
      setSignedInUserId(user?.id ?? null)
    })
    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      setSignedInUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!draftHydrated || editId) return
    const pending = draftPhotosPendingRef.current
    if (!pending?.length) return
    draftPhotosPendingRef.current = null
  }, [draftHydrated, editId])

  useEffect(() => {
    if (!startAtSearch || editId) return
    setFlowStep("search")
    persistFinSellFlowStep("search")
  }, [startAtSearch, editId])

  useEffect(() => {
    if (!resumeDraftId) {
      setEditLoading(false)
      return
    }

    let mounted = true
    setEditLoading(true)

    void (async () => {
      const supabase = supabaseRef.current
      const user = await resolveSellEditUser(supabase)
      if (!user) {
        if (mounted) {
          signIn(`/sell/fins?edit=${resumeDraftId}`)
        }
        return
      }

      const imp = getImpersonation()
      let query = supabase
        .from("listings")
        .select(
          `
          *,
          listing_images (id, url, thumbnail_url, is_primary, sort_order)
        `,
        )
        .eq("id", resumeDraftId)
      if (!imp) {
        query = query.eq("user_id", user.id)
      }

      const { data: listing, error } = await query.single()
      if (!mounted) return

      if (error || !listing) {
        toast.error("Listing not found or cannot be edited")
        if (!editId && localServerDraftId === resumeDraftId) {
          clearSellServerDraftListingId("fins")
        }
        router.replace("/sell/fins", { scroll: false })
        setEditLoading(false)
        return
      }

      if ((listing as { status?: string }).status === "sold") {
        toast.message("This listing has sold — it can't be edited.")
        router.replace(
          listingDetailHref({
            id: String(listing.id),
            slug: (listing as { slug?: string | null }).slug ?? null,
          }),
        )
        setEditLoading(false)
        return
      }

      if ((listing as { section?: string }).section !== "fins") {
        toast.error("Only fin listings can be edited here.")
        router.replace("/sell/fins", { scroll: false })
        setEditLoading(false)
        return
      }

      setEditListingOwnerId(listing.user_id as string)
      const st = (listing as { status?: string }).status
      setEditListingStatus(typeof st === "string" ? st : null)
      if (st === "draft") {
        setSellServerDraftListingId("fins", String(listing.id))
        if (!editId) {
          replaceSellDraftEditUrl("fins", String(listing.id))
        }
      }
      if (imp && imp.userId !== listing.user_id) {
        clearImpersonation()
      }

      const loadedReswellPackage = reswellPackageFormFromDbRow(
        listing as {
          shipping_packed_length_in?: number | string | null
          shipping_packed_width_in?: number | string | null
          shipping_packed_height_in?: number | string | null
          shipping_packed_weight_oz?: number | string | null
        },
      )
      const shippingMode = finShippingModeFromListing(
        listing as {
          shipping_available?: boolean | null
          shipping_price?: number | string | null
          board_shipping_cost_mode?: string | null
        },
      )

      setForm({
        title: listing.title ?? "",
        description: (listing.description ?? "").trim() === "" ? "" : (listing.description ?? ""),
        price: String(listing.price ?? ""),
        sellerPurchasePrice: (() => {
          const v = (listing as { seller_purchase_price_usd?: number | string | null })
            .seller_purchase_price_usd
          if (v == null || v === "") return ""
          return String(v)
        })(),
        condition: sellFormConditionValue(listing.condition),
        size: (listing as { fin_size?: string | null }).fin_size ?? "",
        finSetup: singleFinSetupSlugForForm((listing as { fins_setup?: string | null }).fins_setup),
        finSystem: (listing as { fin_system?: string | null }).fin_system ?? "",
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        brandId: (listing as { brand_id?: string | null }).brand_id?.trim() || null,
        model: (listing as { model?: string | null }).model?.trim() ?? "",
        brandModelId: (listing as { brand_model_id?: string | null }).brand_model_id?.trim() || null,
        locationCity: listing.city ?? "",
        locationState: listing.state ?? "",
        locationLat: listing.latitude != null ? Number(listing.latitude) : null,
        locationLng: listing.longitude != null ? Number(listing.longitude) : null,
        locationDisplay: [listing.city, listing.state].filter(Boolean).join(", "),
        shippingAvailable: true,
        localPickup: false,
        shippingMode,
        shippingPrice: shippingPriceToFormValue(listing.shipping_price),
        ...loadedReswellPackage,
        buyerOffers:
          (listing as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false,
      })

      const existingImages: ListingPhotoSlot[] = ((listing.listing_images as Array<{
        id: string
        url: string
        thumbnail_url: string | null
        is_primary: boolean | null
        sort_order: number | null
      }> | null) ?? [])
        .slice()
        .sort(
          (a, b) =>
            (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
        .map((img) => {
          const url = img.url
          const thumb = img.thumbnail_url?.trim() || url
          return {
            clientId: img.id,
            id: img.id,
            previewUrl: proxiedListingImageSrc(thumb) ?? thumb,
            url,
            thumbnailUrl: thumb,
            optimizePhase: "done" as const,
            uploadPhase: "done" as const,
            progressFull: 100,
            progressThumb: 100,
            dropSourceFileAfterUpload: true,
          }
        })

      setFlowStep("form")
      persistFinSellFlowStep("form")
      hydrateExistingImages(existingImages)
      setEditLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [
    editId,
    hydrateExistingImages,
    localServerDraftId,
    resumeDraftId,
    router,
    signIn,
    signedInUserId,
  ])

  const setField = useCallback(<K extends keyof FinFormState>(key: K, value: FinFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const enterFormStep = useCallback(() => {
    setFlowStep("form")
    persistFinSellFlowStep("form")
  }, [])

  const enterSearchStep = useCallback(() => {
    setFlowStep("search")
    persistFinSellFlowStep("search")
  }, [])

  const exitSellFlow = useCallback(() => {
    clearPersistedFinSellFlowStep()
  }, [])

  const applyCatalogSelection = useCallback((selection: FinCatalogSearchSelection) => {
    setForm((prev) => {
      const next: FinFormState = {
        ...prev,
        brand: selection.brandName,
        brandId: selection.brandId,
        title: selection.suggestedTitle || prev.title,
      }
      if (selection.suggestedDescription) {
        next.description = selection.suggestedDescription
      }
      if (selection.kind === "model" || selection.kind === "variant") {
        next.model = selection.modelName
        next.brandModelId = selection.brandModelId
      } else {
        next.model = ""
        next.brandModelId = null
      }
      if (selection.kind === "variant") {
        next.finSetup = selection.finSetup || prev.finSetup
        next.finSystem = selection.finSystem || prev.finSystem
        next.size = selection.finSize || prev.size
      }
      return next
    })
    enterFormStep()
  }, [enterFormStep])

  const sellSectionCompletion = useMemo(
    () =>
      computeFinSellSectionCompletion({
        title: form.title,
        readyPhotoCount: readyImages.length,
        condition: form.condition,
        description: form.description,
        locationCity: form.locationCity,
        locationState: form.locationState,
        shippingAvailable: form.shippingAvailable,
        localPickup: form.localPickup,
        shippingMode: form.shippingMode,
        shippingPrice: form.shippingPrice,
        reswellPackageLengthIn: form.reswellPackageLengthIn,
        reswellPackageWidthIn: form.reswellPackageWidthIn,
        reswellPackageHeightIn: form.reswellPackageHeightIn,
        reswellPackageWeightLb: form.reswellPackageWeightLb,
        reswellPackageWeightOz: form.reswellPackageWeightOz,
        price: form.price,
      }),
    [form, readyImages.length],
  )

  const firstIncompleteSellSectionId = useMemo(() => {
    for (const item of SELL_FINS_FORM_SECTION_NAV_ITEMS) {
      if (sellSectionCompletion[item.id] !== true) return item.id
    }
    return null
  }, [sellSectionCompletion])

  const firstIncompleteSellSectionLabel = useMemo(() => {
    if (!firstIncompleteSellSectionId) return null
    return (
      SELL_FINS_FORM_SECTION_NAV_ITEMS.find((i) => i.id === firstIncompleteSellSectionId)?.label ??
      null
    )
  }, [firstIncompleteSellSectionId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setPublishValidationBanner(null)

    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const persistDraftForSignIn = async () => {
      await persistListingDraftSnapshot({
        listingType: "fins",
        formData: { ...form, finFlowStep: flowStep } as SellListingDraftFormSnapshot,
        images,
        userId: null,
      })
      markPendingPublish("fins")
      toast.message("Sign in to publish your listing")
      signIn(finSellReturnPath())
    }

    if (!user) {
      await persistDraftForSignIn()
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      await persistDraftForSignIn()
      return
    }

    const validationMessage = validateFinListingForm(form, {
      imageCount: images.length,
      imagesUploadReady,
    })
    if (validationMessage) {
      setPublishValidationBanner(validationMessage)
      scrollPublishValidationBannerIntoView()
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      price: form.price,
      condition: form.condition,
      size: form.size || null,
      finSetup: form.finSetup || null,
      finSystem: form.finSystem || null,
      brand: form.brand,
      brandId: form.brandId,
      model: form.model,
      brandModelId: form.brandModelId,
      locationCity: form.locationCity,
      locationState: form.locationState,
      locationLat: form.locationLat ?? undefined,
      locationLng: form.locationLng ?? undefined,
      shippingAvailable: true,
      localPickup: false,
      shippingCostMode: form.shippingMode,
      shippingPrice:
        form.shippingMode === "flat"
          ? Number(form.shippingPrice || 0)
          : null,
      reswellPackageLengthIn: form.reswellPackageLengthIn,
      reswellPackageWidthIn: form.reswellPackageWidthIn,
      reswellPackageHeightIn: form.reswellPackageHeightIn,
      reswellPackageWeightLb: form.reswellPackageWeightLb,
      reswellPackageWeightOz: form.reswellPackageWeightOz,
      buyerOffers: form.buyerOffers,
      sellerPurchasePrice: form.sellerPurchasePrice ? Number(form.sellerPurchasePrice) : null,
      images: readyImages.map((p, index) => ({
        id: p.id,
        url: p.url!,
        thumbnailUrl: p.thumbnailUrl ?? null,
        isPrimary: index === 0,
        sortOrder: index,
      })),
    }

    setSubmitting(true)
    try {
      clearImpersonationStorageIfCookieMissing()

      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      const actorIsAdmin = actorProfile?.is_admin === true

      let storedImpersonation = getImpersonation()
      if (storedImpersonation && !actorIsAdmin) {
        clearImpersonation()
        storedImpersonation = null
      }
      const listingImpersonation =
        actorIsAdmin && storedImpersonation ? storedImpersonation : null

      const effectiveEditId = editId ?? localServerDraftId
      const isLocalOnlyServerDraftSubmit = Boolean(localServerDraftId && !editId)

      const adminImpersonatesListingOwner = Boolean(
        editId &&
          editListingOwnerId &&
          listingImpersonation &&
          listingImpersonation.userId === editListingOwnerId &&
          user.id !== editListingOwnerId,
      )

      if (effectiveEditId) {
        if (!isLocalOnlyServerDraftSubmit && editId && !editListingOwnerId) {
          toast.error("Listing is still loading. Try again in a moment.")
          setSubmitting(false)
          return
        }

        const ownerEditsOwnListing =
          isLocalOnlyServerDraftSubmit || user.id === editListingOwnerId

        if (adminImpersonatesListingOwner) {
          const imageOps = payload.images.map((img, index) => ({
            id: img.id,
            url: img.url,
            thumbnail_url: img.thumbnailUrl,
            is_primary: index === 0,
            sort_order: index,
          }))
          const res = await fetch("/api/admin/impersonate/update-listing", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              listingId: editId,
              listing: buildFinListingPersistFields(payload),
              removedImageIds,
              images: imageOps,
            }),
          })
          const data = (await res.json().catch(() => ({}))) as { error?: string; slug?: string }
          if (!res.ok) {
            toast.error(typeof data.error === "string" ? data.error : "Failed to update listing")
            setSubmitting(false)
            return
          }
          clearPersistedFinSellFlowStep()
          clearPendingPublish("fins")
          if (user.id) await clearSellListingDraft(user.id, "fins")
          toast.success("Listing updated")
          router.push(`/l/${data.slug ?? editId}`)
          return
        }

        if (!ownerEditsOwnListing) {
          toast.error(
            "This listing belongs to another account. From admin, open the seller and use impersonation for that shop, or sign in as the listing owner.",
          )
          setSubmitting(false)
          return
        }

        const result = await updateFinListingAction({
          ...payload,
          listingId: effectiveEditId,
          removedImageIds,
        })
        if ("error" in result) {
          toast.error(result.error)
          setSubmitting(false)
          return
        }
        clearPersistedFinSellFlowStep()
        clearPendingPublish("fins")
        clearSellServerDraftListingId("fins")
        if (user.id) await clearSellListingDraft(user.id, "fins")
        toast.success(
          listingIsDraft || isLocalOnlyServerDraftSubmit ? "Your fin is live!" : "Listing updated",
        )
        router.push(`/l/${result.slug}`)
        return
      }

      clearPersistedFinSellFlowStep()
      await finalizePeerListingCreate({
        listingImpersonation,
        listingFields: buildFinListingPersistFields(payload),
        images: payload.images.map((img) => ({
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
        })),
        title: payload.title,
        section: "fins",
        bulkSlotId,
        router,
        successToast: "Your fin is live!",
        setSubmitting,
        directCreate: async () => {
          const result = await createFinListingAction(payload)
          if (!("error" in result)) {
            clearPendingPublish("fins")
            clearSellServerDraftListingId("fins")
            if (user.id) await clearSellListingDraft(user.id, "fins")
          }
          return result
        },
      })
    } catch (err) {
      console.error("fin listing submit failed", err)
      toast.error(
        editId ? "Something went wrong saving your listing." : "Something went wrong publishing your listing.",
      )
      setSubmitting(false)
    }
  }

  if (editLoading) {
    return (
      <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
        <div className="container relative mx-auto max-w-2xl lg:max-w-6xl">
          <div
            role="status"
            aria-label="Loading listing editor"
            className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
          >
            <SellFlowFormColumnSkeleton />
          </div>
        </div>
      </main>
    )
  }

  if (flowStep === "search") {
    return (
      <SellFinsCatalogSearch
        onSelect={applyCatalogSelection}
        onSkip={enterFormStep}
        onExit={exitSellFlow}
      />
    )
  }

  return (
    <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
      <AdminBulkListingBanner section="fins" bulkSlotId={bulkSlotId} />
      <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
        <h1 className="sr-only">{editId ? "Edit fin listing" : "List your fins"}</h1>

        <div className="mb-6 border-t border-neutral-200 pt-4 pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Breadcrumb>
              <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href={sellListingsHubHref}>Listings</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                {!editId ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                        <button type="button" onClick={enterSearchStep}>
                          Catalog search
                        </button>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  </>
                ) : null}
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-normal text-[#5c6b89]">
                    {editId ? "Edit fin listing" : "List fins"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 shrink-0">
              {!editLoading && (!editId || listingIsDraft) && !getImpersonation() ? (
                <div className="flex items-center gap-3">
                  {finDraftControls}
                  <Button type="button" variant="ghost" size="icon" aria-label="Exit listing form" asChild>
                    <Link href={sellListingsHubHref} onClick={exitSellFlow}>
                      <X className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="icon" aria-label="Exit listing form" asChild>
                  <Link href={sellListingsHubHref} onClick={exitSellFlow}>
                    <X className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {!editLoading && publishValidationBanner ? (
          <SellPublishValidationBanner
            message={publishValidationBanner}
            firstIncompleteSectionId={firstIncompleteSellSectionId}
            firstIncompleteSectionLabel={firstIncompleteSellSectionLabel}
            onDismiss={() => setPublishValidationBanner(null)}
          />
        ) : null}

        <div className="flex w-full flex-col gap-8 lg:mx-auto lg:w-max lg:max-w-full lg:flex-row lg:items-start lg:gap-10 xl:gap-14">
          <div className="hidden shrink-0 lg:block lg:w-52 xl:w-56">
            <SellSectionNav
              items={SELL_FINS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
            />
          </div>

          <div className="min-w-0 w-full max-w-2xl lg:w-auto lg:max-w-3xl lg:shrink-0">
            <SellSectionNavHorizontal
              items={SELL_FINS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
              className="mb-8 hidden md:block lg:hidden"
            />

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="space-y-10 lg:space-y-12"
              aria-busy={submitting}
            >
              <SellFormSection
                sectionId="sell-fins-section-photos-title"
                title="Title & photos"
                description="Write a title in your own words. It's what buyers see first. Add clear photos of your fins."
              >
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <Label htmlFor="fin-title">Title *</Label>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          form.title.length > FIN_LISTING_TITLE_MAX_LENGTH
                            ? "font-medium text-destructive"
                            : "text-muted-foreground/45",
                        )}
                        aria-live="polite"
                      >
                        {form.title.length}/{FIN_LISTING_TITLE_MAX_LENGTH}
                      </span>
                    </div>
                    <Input
                      id="fin-title"
                      className="placeholder:text-muted-foreground/45"
                      placeholder="e.g. FCS II Performer Tri Fins — Medium"
                      value={form.title}
                      maxLength={FIN_LISTING_TITLE_MAX_LENGTH}
                      onChange={(e) => setField("title", e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>

                  <Separator className="bg-border" />

                  <SellListingPhotoGrid
                    images={images}
                    maxPhotos={FIN_LISTING_MAX_PHOTOS}
                    fileInputId={fileInputId}
                    photosFileDragActive={photosFileDragActive}
                    onImageInputChange={handleImageInputChange}
                    onDragEnter={handlePhotosFileDragEnter}
                    onDragLeave={handlePhotosFileDragLeave}
                    onDragOver={handlePhotosFileDragOver}
                    onDrop={handlePhotosFileDrop}
                    onDragEnd={handlePhotosDragEnd}
                    onRemove={handlePhotoTileRemove}
                    onRetry={handlePhotoTileRetry}
                    onRotate180={handlePhotoTileRotate}
                    photoDragSensors={photoDragSensors}
                  />
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-fins-section-details"
                title="Fin details & description"
                description="Setup, system, and size help buyers find the right set."
              >
                <div className="space-y-8">
                  <SellFinsFacetFields
                    condition={form.condition}
                    finSetup={form.finSetup}
                    finSystem={form.finSystem}
                    size={form.size}
                    brand={form.brand}
                    brandId={form.brandId}
                    model={form.model}
                    onConditionChange={(v) => setField("condition", v)}
                    onFinSetupChange={(v) => setField("finSetup", v)}
                    onFinSystemChange={(v) => setField("finSystem", v)}
                    onSizeChange={(v) => setField("size", v)}
                    onBrandChange={(v) => {
                      setForm((prev) => {
                        const clear =
                          prev.brandId &&
                          prev.brand.trim() &&
                          v.trim() !== prev.brand.trim()
                        if (!clear) return { ...prev, brand: v }
                        return {
                          ...prev,
                          brand: v,
                          brandId: null,
                          brandModelId: null,
                          model: "",
                        }
                      })
                    }}
                    onBrandSelect={(opt) => {
                      setForm((prev) => ({
                        ...prev,
                        brandId: opt.brandId,
                        brand: opt.brandName,
                        brandModelId: null,
                        model: "",
                      }))
                    }}
                    onModelChange={(v) => setField("model", v)}
                  />

                  <Separator className="bg-border" />

                  <SellListingDescriptionField
                    id="fin-description"
                    value={form.description}
                    onChange={(v) => setField("description", v)}
                    placeholder="Material, ride feel, any wear or repairs, why you're selling…"
                  />
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-fins-section-delivery"
                title="Shipping"
                description="Pin where you're shipping from and choose how shipping works. Fin listings ship only — local pickup isn't available."
              >
                <div className="space-y-8">
                  <LocationPicker
                    initialLat={form.locationLat ?? undefined}
                    initialLng={form.locationLng ?? undefined}
                    initialCity={form.locationCity}
                    initialState={form.locationState}
                    initialDisplay={form.locationDisplay}
                    onLocationSelect={(loc) => {
                      setForm((prev) => ({
                        ...prev,
                        locationLat: loc.lat,
                        locationLng: loc.lng,
                        locationCity: loc.city,
                        locationState: loc.state,
                        locationDisplay: loc.displayName,
                      }))
                    }}
                    onLocationClear={() => {
                      setForm((prev) => ({
                        ...prev,
                        locationLat: null,
                        locationLng: null,
                        locationCity: "",
                        locationState: "",
                        locationDisplay: "",
                      }))
                    }}
                  />

                  <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <h3 className="text-sm font-semibold text-foreground">
                      Shipping cost in the Continental U.S.{" "}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </h3>
                    <RadioGroup
                      value={form.shippingMode}
                      onValueChange={(value) =>
                        setField("shippingMode", value as "reswell" | "free" | "flat")
                      }
                      className="space-y-3"
                    >
                        <label
                          htmlFor="sell-fins-ship-mode-reswell"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "reswell"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem
                            value="reswell"
                            id="sell-fins-ship-mode-reswell"
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium leading-snug text-foreground">
                                Let Reswell determine the shipping cost for you
                              </span>
                              <Badge
                                variant="default"
                                className="h-auto shrink-0 border-0 bg-listingHeart px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170]"
                              >
                                Recommended
                              </Badge>
                            </div>
                            {form.shippingMode === "reswell" ? (
                              <p className="text-sm leading-relaxed text-muted-foreground/45">
                                We&apos;ll calculate shipping from your packed dimensions and add it
                                to the buyer&apos;s total at checkout. When an order is placed,
                                we&apos;ll email you the shipping label.{" "}
                                <Link
                                  href="/terms"
                                  className="text-foreground underline underline-offset-2 hover:text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View terms
                                </Link>
                              </p>
                            ) : null}
                          </div>
                        </label>
                        <label
                          htmlFor="sell-fins-ship-mode-free"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "free"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem value="free" id="sell-fins-ship-mode-free" className="mt-0.5" />
                          <div className="min-w-0 flex-1 flex-col gap-1.5">
                            <span className="text-sm font-medium leading-snug text-foreground">
                              Offer free shipping
                            </span>
                            {form.shippingMode === "free" ? (
                              <p className="text-sm leading-relaxed text-muted-foreground/45">
                                Attract more buyers by covering shipping — you can adjust your list
                                price to account for the cost.
                              </p>
                            ) : null}
                          </div>
                        </label>
                        <label
                          htmlFor="sell-fins-ship-mode-flat"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "flat"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem value="flat" id="sell-fins-ship-mode-flat" className="mt-0.5" />
                          <div className="min-w-0 flex-1 flex-col gap-1.5">
                            <span className="text-sm font-medium leading-snug text-foreground">
                              Set a flat shipping rate
                            </span>
                            {form.shippingMode === "flat" ? (
                              <p className="text-sm leading-relaxed text-muted-foreground/45">
                                One cost that all buyers in the Continental U.S. will pay at checkout.
                              </p>
                            ) : null}
                          </div>
                        </label>
                      </RadioGroup>
                      {form.shippingMode === "flat" ? (
                        <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                          <Label htmlFor="fin-shipping-price" className="text-sm font-semibold text-foreground">
                            Shipping rate{" "}
                            <span className="text-destructive" aria-hidden>
                              *
                            </span>
                          </Label>
                          <div className="relative max-w-md">
                            <span
                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground/45"
                              aria-hidden
                            >
                              $
                            </span>
                            <Input
                              id="fin-shipping-price"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={form.shippingPrice}
                              onChange={(e) => setField("shippingPrice", e.target.value)}
                              className="pl-8 tabular-nums placeholder:text-muted-foreground/45"
                            />
                          </div>
                        </div>
                      ) : null}
                  </div>
                </div>
              </SellFormSection>

              {form.shippingMode === "reswell" ? (
                <SellFormSection
                  sectionId="sell-fins-section-reswell-package"
                  title="Reswell shipping: packed size & weight"
                >
                  <ReswellPackageDimensionsCard
                    showHeading={false}
                    className="rounded-none border-0 bg-transparent p-0 shadow-none"
                    lengthIn={form.reswellPackageLengthIn}
                    widthIn={form.reswellPackageWidthIn}
                    heightIn={form.reswellPackageHeightIn}
                    weightLb={form.reswellPackageWeightLb}
                    weightOz={form.reswellPackageWeightOz}
                    onLengthInChange={(v) =>
                      setField("reswellPackageLengthIn", normalizeBoardLengthInput(v))
                    }
                    onWidthInChange={(v) =>
                      setField("reswellPackageWidthIn", normalizeTapeStyleInchesInput(v))
                    }
                    onHeightInChange={(v) =>
                      setField("reswellPackageHeightIn", normalizeTapeStyleInchesInput(v))
                    }
                    onWeightLbChange={(v) => setField("reswellPackageWeightLb", v)}
                    onWeightOzChange={(v) => setField("reswellPackageWeightOz", v)}
                  />
                </SellFormSection>
              ) : null}

              <SellFormSection
                sectionId="sell-fins-section-publish"
                title="Price & publish your listing"
              >
                <div className="space-y-6">
                  <SellPriceFields
                    listingPrice={form.price}
                    onListingPriceChange={(value) => setField("price", value)}
                    sellerPurchasePrice={form.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) => setField("sellerPurchasePrice", value)}
                    purchaseAccordionTitle="What you paid for the fins"
                    purchaseAccordionDescription="Keep track of what you paid versus what they sell for. This info is for your benefit only."
                    afterListingPrice={
                      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                        <div className="flex gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
                            aria-hidden
                          >
                            <Zap className="h-4 w-4" strokeWidth={2.5} />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-semibold text-foreground">
                              Sell your fins even faster
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground/45">
                              Increase your chances of selling with offers from buyers.
                            </p>
                          </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex gap-4">
                          <Switch
                            id="sell-fins-buyer-offers"
                            checked={form.buyerOffers}
                            onCheckedChange={(v) => setField("buyerOffers", v === true)}
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
                            aria-label="Allow buyers to make offers"
                          />
                          <div className="min-w-0 space-y-1">
                            <Label
                              htmlFor="sell-fins-buyer-offers"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              Allow buyers to make offers
                            </Label>
                            <p className="text-sm leading-relaxed text-muted-foreground/45">
                              Lets you negotiate a final price with buyers before checkout.
                            </p>
                          </div>
                        </div>
                      </div>
                    }
                  />
                  <Separator />
                  <Button
                    type="submit"
                    size="lg"
                    className="relative w-full transition-shadow"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editId ? "Saving…" : "Publishing…"}
                      </>
                    ) : editId ? (
                      listingIsDraft ? "Publish listing" : "Save changes"
                    ) : (
                      "Create Listing"
                    )}
                  </Button>
                  {uploadingCount > 0 ? (
                    <p className="text-center text-xs text-muted-foreground/45">
                      {uploadingCount} photo{uploadingCount > 1 ? "s" : ""} still uploading…
                    </p>
                  ) : null}
                </div>
              </SellFormSection>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
