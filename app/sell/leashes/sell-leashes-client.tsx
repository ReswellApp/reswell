"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, Upload, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
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
import { SellListingPhotoEmptyDropzone } from "@/components/features/sell/sell-listing-photo-empty-dropzone"
import { SellSimplePhotoTile } from "@/components/features/sell/sell-simple-photo-tile"
import { useSimpleListingPhotoRotate } from "@/components/features/sell/hooks/use-simple-listing-photo-rotate"
import { SellShippingCostModeRadios } from "@/components/features/sell/sell-shipping-cost-mode-radios"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import {
  SellListingVideoAddTile,
  SellListingVideoFilledTile,
} from "@/components/features/sell/sell-listing-photo-grid"
import { useListingVideoUpload } from "@/components/features/sell/hooks/use-listing-video-upload"
import { createEmptyListingVideoSlot } from "@/lib/sell-flow/listing-video-slot"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellLeashesFacetFields } from "@/components/features/sell/sell-leashes-facet-fields"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  buildSellSectionNavItems,
} from "@/components/features/sell/sell-section-nav"
import { createClient } from "@/lib/supabase/client"
import { useOwnedListingEditLoad } from "@/components/features/sell/hooks/use-owned-listing-edit-load"
import { SellEditLoadError } from "@/components/features/sell/sell-edit-load-error"
import { SellFlowRouteSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { useSellAccessoryDraftRecovery } from "@/components/features/sell/hooks/use-sell-accessory-draft-recovery"
import type { SellListingDraftFormSnapshot } from "@/lib/sell-listing-draft-idb"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import { listingPhotoPreviewFromPrepared } from "@/lib/sell-flow/simple-listing-photo-rotate"
import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import {
  assertListingOriginalSize,
  prepareListingImagePairFromFile,
} from "@/lib/listing-image-pipeline"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import { friendlyListingPhotoErrorMessage } from "@/lib/utils/friendly-listing-photo-error"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import {
  LEASH_LISTING_MAX_PHOTOS,
  LEASH_LISTING_TITLE_MAX_LENGTH,
  type CreateLeashListingInput,
} from "@/lib/validations/leash-listing"
import {
  createLeashListingAction,
  updateLeashListingAction,
} from "@/lib/actions/leashListingActions"
import { buildLeashListingPersistFields } from "@/lib/leash-listing-persist-fields"
import { computeLeashSellSectionCompletion } from "@/lib/leash-sell-section-completion"
import { sellFormConditionValue } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { navigateAfterListingSave } from "@/lib/sell-flow/navigate-after-listing-save"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import {
  clearImpersonation,
  clearImpersonationStorageIfCookieMissing,
  getImpersonation,
} from "@/lib/impersonation"
import {
  ensureImpersonationForListingOwner,
  syncClientImpersonationForListingOwner,
} from "@/lib/utils/admin-impersonation-for-listing"
import { reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import {
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
} from "@/lib/board-measurements"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"
import { cn } from "@/lib/utils"
import { AdminBulkListingBanner } from "@/components/features/sell/admin-bulk-listing-banner"
import { finalizePeerListingCreate } from "@/lib/utils/admin-peer-listing-create-navigation"
import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import {
  SELL_SUBMIT_INTERRUPTED_MESSAGE,
  isSellSubmitAbortError,
  sellActionErrorMessage,
} from "@/lib/sell-flow/sell-submit-error"
import { useSellFunnelStepTracking } from "@/lib/sell-flow/use-sell-funnel-step-tracking"
import { SELL_PAGE_GROUND_CLASS } from "@/components/features/sell/sell-form-surface"

const SELL_LEASHES_FORM_SECTION_NAV_ITEMS = buildSellSectionNavItems("leashes", "Leash details")

type PhotoPhase = "optimizing" | "uploading" | "done" | "error"

type PhotoSlot = {
  clientId: string
  previewUrl: string
  file?: File
  imageId?: string
  url?: string
  thumbnailUrl?: string
  phase: PhotoPhase
  progress: number
  userRotate180?: boolean
}

function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = Number.parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? String(n) : ""
}

function leashShippingModeFromListing(listing: {
  shipping_available?: boolean | null
  shipping_price?: number | string | null
  board_shipping_cost_mode?: string | null
}): LeashFormState["shippingMode"] {
  const stored = listing.board_shipping_cost_mode
  if (stored === "reswell" || stored === "free" || stored === "flat") return stored
  if (listing.shipping_available) {
    const n = Number.parseFloat(String(listing.shipping_price ?? 0).replace(/,/g, ""))
    if (Number.isFinite(n) && n > 0) return "flat"
    return "free"
  }
  return "reswell"
}

type LeashFormState = {
  title: string
  description: string
  price: string
  sellerPurchasePrice: string
  condition: string
  size: string
  brand: string
  model: string
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

const INITIAL_STATE: LeashFormState = {
  title: "",
  description: "",
  price: "",
  sellerPurchasePrice: "",
  condition: "",
  size: "",
  brand: "",
  model: "",
  locationCity: "",
  locationState: "",
  locationLat: null,
  locationLng: null,
  locationDisplay: "",
  shippingAvailable: false,
  localPickup: true,
  shippingMode: "reswell",
  shippingPrice: "",
  reswellPackageLengthIn: "",
  reswellPackageWidthIn: "",
  reswellPackageHeightIn: "",
  reswellPackageWeightLb: "",
  reswellPackageWeightOz: "",
  buyerOffers: true,
}

/** Type-safe merge of an IndexedDB draft snapshot onto the leash form state. */
function leashFormFromDraftSnapshot(snapshot: SellListingDraftFormSnapshot): LeashFormState {
  const next: LeashFormState = { ...INITIAL_STATE }
  for (const key of Object.keys(INITIAL_STATE) as Array<keyof LeashFormState>) {
    const value = snapshot[key]
    if (value === undefined) continue
    const initial = INITIAL_STATE[key]
    if (key === "locationLat" || key === "locationLng") {
      if (value === null || typeof value === "number") {
        next[key] = value as LeashFormState["locationLat"]
      }
      continue
    }
    if (key === "shippingMode") {
      if (value === "reswell" || value === "free" || value === "flat") next.shippingMode = value
      continue
    }
    if (typeof value === typeof initial) {
      next[key] = value as never
    }
  }
  return next
}

/** This flow's photo pipeline predates the shared upload hook — draft recovery covers the form only. */
const NO_DRAFT_PHOTO_SLOTS: ListingPhotoSlot[] = []
const noopSetDraftImages = () => {}
const noopRetryDraftPhotoSlot = () => {}

function newClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function scrollLeashSellSectionIntoView(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function SellLeashesFlow({ editListingId = null }: { editListingId?: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bulkSlotId = searchParams.get("bulk")?.trim() || null
  const startFresh = searchParams.get("new") === "1"
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabaseRef = useRef(createClient())
  const editId = editListingId?.trim() || null

  const [form, setForm] = useState<LeashFormState>(INITIAL_STATE)
  const [photos, setPhotos] = useState<PhotoSlot[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [actorIsAdmin, setActorIsAdmin] = useState<boolean | null>(null)
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])

  const sellVideoReturnPath = useCallback(
    () =>
      typeof window === "undefined"
        ? editId
          ? `/sell/leashes?edit=${editId}`
          : "/sell/leashes"
        : `${window.location.pathname}${window.location.search}`,
    [editId],
  )
  const videoUpload = useListingVideoUpload({
    signInReturnPath: sellVideoReturnPath,
    openSignIn: signIn,
    supabase: supabaseRef.current,
    promptSignInOnUpload: false,
  })
  const {
    video,
    removedVideoIds,
    videoUploadReady,
    videoUploading,
    readyVideo,
    handleVideoInputChange,
    handleVideoRemove,
    handleVideoRetry,
    hydrateExistingVideo,
  } = videoUpload
  const videoFileInputId = useId()


  const photosRef = useRef<PhotoSlot[]>([])
  photosRef.current = photos

  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        if (p.file) URL.revokeObjectURL(p.previewUrl)
      }
    }
  }, [])

  const restoreLeashDraftForm = useCallback((snapshot: SellListingDraftFormSnapshot) => {
    setForm(leashFormFromDraftSnapshot(snapshot))
  }, [])

  const { clearRecoveredDraft, flushDraftNow } = useSellAccessoryDraftRecovery({
    listingType: "leashes",
    editId,
    startFresh,
    formSnapshot: form,
    images: NO_DRAFT_PHOTO_SLOTS,
    onRestoreForm: restoreLeashDraftForm,
    setImages: noopSetDraftImages,
    retryPhotoSlot: noopRetryDraftPhotoSlot,
  })

  const hydrateLeashEdit = useCallback(
    async (listing: OwnedListingForEditRow) => {

      if ((listing as { status?: string }).status === "sold") {
        toast.message("This listing has sold — it can't be edited.")
        router.replace(
          listingDetailHref({
            id: String(listing.id),
            slug: (listing as { slug?: string | null }).slug ?? null,
          }),
        )
        return { status: "handled" as const }
      }

      if ((listing as { section?: string }).section !== "leashes") {
        toast.error("Only leash listings can be edited here.")
        router.replace("/sell/leashes", { scroll: false })
        return { status: "handled" as const }
      }

      setEditListingOwnerId(listing.user_id as string)
      await syncClientImpersonationForListingOwner(String(listing.user_id ?? ""))

      const loadedReswellPackage = reswellPackageFormFromDbRow(
        listing as {
          shipping_packed_length_in?: number | string | null
          shipping_packed_width_in?: number | string | null
          shipping_packed_height_in?: number | string | null
          shipping_packed_weight_oz?: number | string | null
        },
      )
      const shippingMode = leashShippingModeFromListing(
        listing as {
          shipping_available?: boolean | null
          shipping_price?: number | string | null
          board_shipping_cost_mode?: string | null
        },
      )

      setForm({
        title: listing.title ?? "",
        description: listing.description ?? "",
        price: String(listing.price ?? ""),
        sellerPurchasePrice: (() => {
          const v = (listing as { seller_purchase_price_usd?: number | string | null })
            .seller_purchase_price_usd
          if (v == null || v === "") return ""
          return String(v)
        })(),
        condition: sellFormConditionValue(listing.condition),
        size: (listing as { leash_size?: string | null }).leash_size ?? "",
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        model: (listing as { model?: string | null }).model?.trim() ?? "",
        locationCity: listing.city ?? "",
        locationState: listing.state ?? "",
        locationLat: listing.latitude != null ? Number(listing.latitude) : null,
        locationLng: listing.longitude != null ? Number(listing.longitude) : null,
        locationDisplay: [listing.city, listing.state].filter(Boolean).join(", "),
        shippingAvailable: Boolean(listing.shipping_available),
        localPickup: listing.local_pickup !== false,
        shippingMode,
        shippingPrice: shippingPriceToFormValue(listing.shipping_price),
        ...loadedReswellPackage,
        buyerOffers:
          (listing as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false,
      })

      const existingImages = ((listing.listing_images as Array<{
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
            imageId: img.id,
            previewUrl: proxiedListingImageSrc(thumb) ?? thumb,
            url,
            thumbnailUrl: thumb,
            phase: "done" as const,
            progress: 100,
          }
        })


      const existingVideos = (
        (listing.listing_videos as Array<{
          id: string
          url: string
          thumbnail_url?: string | null
          content_type?: string | null
          duration_seconds?: number | null
          byte_size?: number | null
          sort_order?: number | null
        }> | null) ?? []
      )
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const firstVideo = existingVideos[0]
      if (firstVideo?.url?.trim()) {
        const thumb = firstVideo.thumbnail_url?.trim() || null
        hydrateExistingVideo(
          createEmptyListingVideoSlot({
            id: firstVideo.id,
            status: "ready",
            url: firstVideo.url,
            thumbnailUrl: thumb,
            previewUrl: thumb || firstVideo.url,
            contentType: firstVideo.content_type ?? null,
            durationSeconds: firstVideo.duration_seconds ?? null,
            byteSize: firstVideo.byte_size ?? null,
          }),
        )
      } else {
        hydrateExistingVideo(null)
      }

      setPhotos(existingImages)
      setRemovedImageIds([])
      return { status: "ready" as const }
    },
    [hydrateExistingVideo, router],
  )

  const { editLoading, editLoadError, retryEditLoad } = useOwnedListingEditLoad({
    editId,
    supabase: supabaseRef.current,
    signInReturnPath: editId ? `/sell/leashes?edit=${editId}` : "/sell/leashes",
    openSignIn: signIn,
    notFoundRedirectHref: "/sell/leashes",
    router,
    onHydrate: hydrateLeashEdit,
  })

  const setField = useCallback(<K extends keyof LeashFormState>(key: K, value: LeashFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = supabaseRef.current
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setActorIsAdmin(null)
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      if (!cancelled) setActorIsAdmin(profile?.is_admin === true)
    })()
    return () => {
      cancelled = true
    }
  }, [])



  const updateSlot = useCallback((clientId: string, patch: Partial<PhotoSlot>) => {
    setPhotos((prev) => prev.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)))
  }, [])

  const uploadSlot = useCallback(
    async (slot: PhotoSlot) => {
      if (!slot.file) return
      try {
        const decodable = await ensureBrowserDecodableImageFile(slot.file)
        const prepared = await prepareListingImagePairFromFile(decodable, {
          rotate180: Boolean(slot.userRotate180),
        })
        const nextPreviewUrl = listingPhotoPreviewFromPrepared(slot.previewUrl, prepared.thumb)
        updateSlot(slot.clientId, { phase: "uploading", progress: 5, previewUrl: nextPreviewUrl })

        const supabase = supabaseRef.current
        const session = await resolveClientSessionForMutation(supabase)
        const user = session?.user
        if (!session?.access_token || !user) {
          updateSlot(slot.clientId, { phase: "error" })
          signIn("/sell/leashes")
          return
        }

        const { fullUrl, thumbUrl } = await uploadListingImagePairToSupabase({
          supabase,
          userId: user.id,
          clientId: slot.clientId,
          prepared,
          onProgressFull: (loaded, total) =>
            updateSlot(slot.clientId, {
              progress: total > 0 ? Math.round((loaded / total) * 100) : 50,
            }),
        })

        updateSlot(slot.clientId, {
          phase: "done",
          progress: 100,
          url: fullUrl,
          thumbnailUrl: thumbUrl,
        })
      } catch (err) {
        console.error("leash photo upload failed", err)
        logSellFunnelEvent({
          listingType: "leashes",
          event: "upload_failed",
          message: friendlyListingPhotoErrorMessage(err, "upload"),
        })
        updateSlot(slot.clientId, { phase: "error" })
        toast.error(friendlyListingPhotoErrorMessage(err, "upload"))
      }
    },
    [signIn, updateSlot],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"))
      if (list.length === 0) return

      const remaining = LEASH_LISTING_MAX_PHOTOS - photosRef.current.length
      if (remaining <= 0) {
        toast.error(`You can add up to ${LEASH_LISTING_MAX_PHOTOS} photos.`)
        return
      }

      const accepted: PhotoSlot[] = []
      for (const file of list.slice(0, remaining)) {
        try {
          assertListingOriginalSize(file)
        } catch (e) {
          toast.error(friendlyListingPhotoErrorMessage(e))
          continue
        }
        accepted.push({
          clientId: newClientId(),
          previewUrl: URL.createObjectURL(file),
          file,
          phase: "optimizing",
          progress: 0,
        })
      }
      if (accepted.length === 0) return
      setPhotos((prev) => [...prev, ...accepted])
      for (const slot of accepted) void uploadSlot(slot)
    },
    [uploadSlot],
  )

  const removePhoto = useCallback((clientId: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.clientId === clientId)
      if (target?.imageId) {
        setRemovedImageIds((ids) =>
          ids.includes(target.imageId!) ? ids : [...ids, target.imageId!],
        )
      }
      if (target?.file) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.clientId !== clientId)
    })
  }, [])

  const makePrimary = useCallback((clientId: string) => {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.clientId === clientId)
      if (idx <= 0) return prev
      const next = [...prev]
      const [picked] = next.splice(idx, 1)
      next.unshift(picked)
      return next
    })
  }, [])

  const rotatePhoto180 = useSimpleListingPhotoRotate({
    photosRef,
    setPhotos,
    uploadSlot,
  })

  const uploadingCount = photos.filter((p) => p.phase !== "done" && p.phase !== "error").length
  const readyPhotos = photos.filter((p) => p.phase === "done" && p.url)

  const sellSectionCompletion = useMemo(
    () =>
      computeLeashSellSectionCompletion({
        title: form.title,
        readyPhotoCount: readyPhotos.length,
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
    [form, readyPhotos.length],
  )

  useSellFunnelStepTracking({
    listingType: "leashes",
    sectionIds: SELL_LEASHES_FORM_SECTION_NAV_ITEMS.map((item) => item.id),
    sectionCompletion: sellSectionCompletion,
    enabled: !editLoading,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const supabase = supabaseRef.current
    const session = await resolveClientSessionForMutation(supabase)
    const user = session?.user
    if (!user || !session?.access_token) {
      toast.message("Listing saved on this device", {
        description: "Create a free account to publish — you’ll pick up right here.",
      })
      signIn("/sell/leashes", { preferSignUp: true, skipSessionProbe: true })
      void flushDraftNow({ includeInFlightPhotos: true })
      return
    }

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    const submitActorIsAdmin = actorProfile?.is_admin === true
    setActorIsAdmin(submitActorIsAdmin)

    const publishStartedAt = Date.now()
    logSellFunnelEvent({
      listingType: "leashes",
      event: "publish_attempt",
      message: editId ? "edit" : "create",
    })
    const failValidation = (message: string) => {
      logSellFunnelEvent({ listingType: "leashes", event: "validation_failed", message })
      toast.error(message)
    }

    if (readyPhotos.length === 0) {
      failValidation("Add at least one photo.")
      scrollLeashSellSectionIntoView("sell-leashes-section-photos-title")
      return
    }
    if (uploadingCount > 0) {
      failValidation("Hang tight — your photos are still uploading.")
      return
    }
    if (!videoUploadReady || videoUploading) {
      failValidation("Hang tight — your video is still uploading.")
      return
    }
    if (!form.title.trim()) {
      failValidation("Add a title.")
      scrollLeashSellSectionIntoView("sell-leashes-section-photos-title")
      return
    }
    if (!form.condition) {
      failValidation("Choose a condition.")
      scrollLeashSellSectionIntoView("sell-leashes-section-details")
      return
    }
    if (!form.description.trim()) {
      failValidation("Add a description.")
      scrollLeashSellSectionIntoView("sell-leashes-section-details")
      return
    }
    if (!form.price.trim() || Number(form.price) <= 0) {
      failValidation("Enter a price.")
      scrollLeashSellSectionIntoView("sell-leashes-section-publish")
      return
    }
    if (!form.locationCity.trim() || !form.locationState.trim()) {
      failValidation("Confirm where you're listing from.")
      scrollLeashSellSectionIntoView("sell-leashes-section-delivery")
      return
    }
    if (!form.shippingAvailable && !form.localPickup) {
      failValidation("Choose shipping, local pickup, or both.")
      scrollLeashSellSectionIntoView("sell-leashes-section-delivery")
      return
    }
    if (form.shippingAvailable && normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin) === "reswell") {
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) {
        failValidation("Enter packed box dimensions for Reswell shipping.")
        scrollLeashSellSectionIntoView("sell-leashes-section-reswell-package")
        return
      }
    }
    if (
      form.shippingAvailable &&
      normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin) === "flat" &&
      (form.shippingPrice === "" || Number(form.shippingPrice) < 0)
    ) {
      failValidation("Enter a flat shipping rate.")
      scrollLeashSellSectionIntoView("sell-leashes-section-delivery")
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      condition: form.condition as CreateLeashListingInput["condition"],
      size: form.size || null,
      brand: form.brand,
      model: form.model,
      locationCity: form.locationCity,
      locationState: form.locationState,
      locationLat: form.locationLat ?? undefined,
      locationLng: form.locationLng ?? undefined,
      shippingAvailable: form.shippingAvailable,
      localPickup: form.localPickup,
      shippingCostMode: form.shippingAvailable
        ? normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin)
        : null,
      shippingPrice:
        form.shippingAvailable &&
        normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin) === "flat"
          ? Number(form.shippingPrice || 0)
          : null,
      reswellPackageLengthIn: form.reswellPackageLengthIn,
      reswellPackageWidthIn: form.reswellPackageWidthIn,
      reswellPackageHeightIn: form.reswellPackageHeightIn,
      reswellPackageWeightLb: form.reswellPackageWeightLb,
      reswellPackageWeightOz: form.reswellPackageWeightOz,
      buyerOffers: form.buyerOffers,
      sellerPurchasePrice: form.sellerPurchasePrice ? Number(form.sellerPurchasePrice) : null,
      images: readyPhotos.map((p, index) => ({
        id: p.imageId,
        url: p.url!,
        thumbnailUrl: p.thumbnailUrl ?? null,
        isPrimary: index === 0,
        sortOrder: index,
      })),
      videos: readyVideo ? [readyVideo] : [],
    }

    setSubmitting(true)
    try {
      clearImpersonationStorageIfCookieMissing()

      let storedImpersonation = getImpersonation()
      if (storedImpersonation && !submitActorIsAdmin) {
        clearImpersonation()
        storedImpersonation = null
      }

      const editingOwnListing =
        Boolean(editId) &&
        Boolean(editListingOwnerId) &&
        user.id === editListingOwnerId
      if (editingOwnListing && storedImpersonation) {
        clearImpersonation()
        storedImpersonation = null
      }

      const listingImpersonation =
        submitActorIsAdmin && storedImpersonation ? storedImpersonation : null

      const adminImpersonatesListingOwner = Boolean(
        editId &&
          editListingOwnerId &&
          submitActorIsAdmin &&
          user.id !== editListingOwnerId,
      )

      if (editId) {
        const ownerEditsOwnListing = user.id === editListingOwnerId
        if (adminImpersonatesListingOwner) {
          if (editListingOwnerId) {
            await ensureImpersonationForListingOwner(editListingOwnerId)
          }
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
              listing: buildLeashListingPersistFields(payload, { allowPrivilegedShippingModes: true }),
              removedImageIds,
              images: imageOps,
              removedVideoIds,
              videos: payload.videos,
            }),
          })
          const data = (await res.json().catch(() => ({}))) as { error?: string; slug?: string }
          if (!res.ok) {
            const message = sellActionErrorMessage(
              typeof data.error === "string" ? data.error : "Failed to update listing",
            )
            logSellFunnelEvent({
              listingType: "leashes",
              event: "publish_failed",
              message,
              durationMs: Date.now() - publishStartedAt,
            })
            toast.error(message)
            setSubmitting(false)
            return
          }
          logSellFunnelEvent({
            listingType: "leashes",
            event: "publish_succeeded",
            listingId: editId ?? undefined,
            durationMs: Date.now() - publishStartedAt,
          })
          toast.success("Listing updated")
          navigateAfterListingSave(`/l/${data.slug ?? editId}`)
          return
        }

        if (!ownerEditsOwnListing) {
          toast.error(
            "This listing belongs to another account. From admin, open the seller and use impersonation for that shop, or sign in as the listing owner.",
          )
          setSubmitting(false)
          return
        }

        const result = await updateLeashListingAction({
          ...payload,
          listingId: editId,
          removedImageIds,
          removedVideoIds,
        })
        if ("error" in result) {
          const message = sellActionErrorMessage(result.error)
          logSellFunnelEvent({
            listingType: "leashes",
            event: "publish_failed",
            message,
            durationMs: Date.now() - publishStartedAt,
          })
          toast.error(message)
          setSubmitting(false)
          return
        }
        logSellFunnelEvent({
          listingType: "leashes",
          event: "publish_succeeded",
          listingId: editId,
          durationMs: Date.now() - publishStartedAt,
        })
        toast.success("Listing updated")
        navigateAfterListingSave(`/l/${result.slug}`)
        return
      }

      await finalizePeerListingCreate({
        listingImpersonation,
        listingFields: buildLeashListingPersistFields(
          payload,
          listingImpersonation ? { allowPrivilegedShippingModes: true } : undefined,
        ),
        images: payload.images.map((img) => ({
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
        })),
        videos: payload.videos,
        title: payload.title,
        section: "leashes",
        bulkSlotId,
        router,
        publishStartedAt,
        successToast: "Your leash is live!",
        setSubmitting,
        directCreate: () => createLeashListingAction(payload),
        onCreateSuccess: () => clearRecoveredDraft(),
      })
    } catch (err) {
      const aborted = isSellSubmitAbortError(err)
      if (!aborted) {
        console.error("leash listing submit failed", err)
      }
      logSellFunnelEvent({
        listingType: "leashes",
        event: "publish_failed",
        message: aborted
          ? "aborted"
          : err instanceof Error
            ? err.message
            : "Unexpected submit error",
        durationMs: Date.now() - publishStartedAt,
      })
      toast.error(
        aborted
          ? SELL_SUBMIT_INTERRUPTED_MESSAGE
          : editId
            ? "Something went wrong saving your listing."
            : "Something went wrong publishing your listing.",
      )
      setSubmitting(false)
    }
  }

  if (editLoadError) {
    return (
      <SellEditLoadError
        message={editLoadError}
        onRetry={retryEditLoad}
        backHref="/sell/leashes"
        backLabel="Back to sell leash"
      />
    )
  }

  if (editLoading) {
    return <SellFlowRouteSkeleton />
  }

  return (
    <main className={cn("flex-1 w-full pt-8 pb-16 md:pb-20 lg:pb-24", SELL_PAGE_GROUND_CLASS)}>
      <AdminBulkListingBanner section="leashes" bulkSlotId={bulkSlotId} />
      <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
        <h1 className="sr-only">{editId ? "Edit leash listing" : "List your leash"}</h1>

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
                    <Link href="/sell">Sell</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-normal text-[#5c6b89]">
                    {editId ? "Edit leash listing" : "List leash"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button type="button" variant="ghost" size="icon" aria-label="Exit listing form" asChild>
              <Link href="/sell">
                <X className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-8 lg:mx-auto lg:w-max lg:max-w-full lg:flex-row lg:items-start lg:gap-10 xl:gap-14">
          <div className="hidden shrink-0 lg:block lg:w-52 xl:w-56">
            <SellSectionNav
              items={SELL_LEASHES_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
            />
          </div>

          <div className="min-w-0 w-full max-w-2xl lg:w-auto lg:max-w-3xl lg:shrink-0">
            <SellSectionNavHorizontal
              items={SELL_LEASHES_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
              className="mb-8 hidden md:block lg:hidden"
            />

            <form onSubmit={handleSubmit} className="space-y-10 lg:space-y-12" aria-busy={submitting}>
              <SellFormSection
                sectionId="sell-leashes-section-photos-title"
                title="Photos & title"
                description="Start with clear photos, then add a short title. Buyers see these first."
                complete={sellSectionCompletion["sell-leashes-section-photos-title"] === true}
              >
                <div className="space-y-8">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">Photos & video</h3>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          Add clear photos. The first image is your main photo — tap the star on any
                          other photo to make it the cover. Tap rotate if a photo is upside down.
                          Optional: add one short video.
                        </p>
                      </div>
                      <div className="shrink-0 pt-0.5" aria-live="polite">
                        {photos.length >= 1 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-listingHeart/10 px-2.5 py-1 text-xs font-medium text-listingHeart ring-1 ring-inset ring-listingHeart/25">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-slate-200/80">
                            Add at least 1
                          </span>
                        )}
                      </div>
                    </div>
                    <Label className="sr-only">Listing photos</Label>
                    {photos.length === 0 ? (
                      <div className="space-y-3">
                        <SellListingPhotoEmptyDropzone
                          fileInputId={fileInputId}
                          onFilesSelected={addFiles}
                        />
                        {video ? (
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                            <SellListingVideoFilledTile
                              video={video}
                              fileInputId={videoFileInputId}
                              onInputChange={handleVideoInputChange}
                              onRemove={handleVideoRemove}
                              onRetry={handleVideoRetry}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {photos.map((photo, index) => (
                        <SellSimplePhotoTile
                          key={photo.clientId}
                          photo={photo}
                          index={index}
                          onRotate180={rotatePhoto180}
                          onMakePrimary={makePrimary}
                          onRemove={removePhoto}
                        />
                      ))}
                      {video ? (
                        <SellListingVideoFilledTile
                          video={video}
                          fileInputId={videoFileInputId}
                          onInputChange={handleVideoInputChange}
                          onRemove={handleVideoRemove}
                          onRetry={handleVideoRetry}
                        />
                      ) : (
                        <SellListingVideoAddTile
                          fileInputId={videoFileInputId}
                          onInputChange={handleVideoInputChange}
                        />
                      )}
                      {photos.length < LEASH_LISTING_MAX_PHOTOS ? (
                        <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/50">
                          <label
                            htmlFor={fileInputId}
                            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center"
                          >
                            <span className="sr-only">Add listing photos</span>
                            <Upload
                              className="pointer-events-none h-6 w-6 text-muted-foreground"
                              aria-hidden
                            />
                            <span
                              className="pointer-events-none mt-1 text-xs text-muted-foreground"
                              aria-hidden
                            >
                              Add
                            </span>
                          </label>
                          <input
                            id={fileInputId}
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                              if (e.target.files) addFiles(e.target.files)
                              e.target.value = ""
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    )}
                  </div>

                  <Separator className="bg-border" />

                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <Label htmlFor="leash-title">Title *</Label>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          form.title.length > LEASH_LISTING_TITLE_MAX_LENGTH
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                        aria-live="polite"
                      >
                        {form.title.length}/{LEASH_LISTING_TITLE_MAX_LENGTH}
                      </span>
                    </div>
                    <Input
                      id="leash-title"
                      className="h-11 border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground"
                      placeholder="e.g. Rip Curl Flashbomb 3/2 Steamer — Medium"
                      value={form.title}
                      maxLength={LEASH_LISTING_TITLE_MAX_LENGTH}
                      onChange={(e) => setField("title", e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>

                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-leashes-section-details"
                title="Leash details & description"
                description="Condition and details help buyers shop with confidence."
              >
                <div className="space-y-8">
                  <SellLeashesFacetFields
                    condition={form.condition}
                    size={form.size}
                    brand={form.brand}
                    model={form.model}
                    onConditionChange={(v) => setField("condition", v)}
                    onSizeChange={(v) => setField("size", v)}
                    onBrandChange={(v) => setField("brand", v)}
                    onModelChange={(v) => setField("model", v)}
                  />

                  <Separator className="bg-border" />

                  <SellListingDescriptionField
                    id="leash-description"
                    value={form.description}
                    onChange={(v) => setField("description", v)}
                    placeholder="Thickness, seams, any wear or repairs, why you're selling…"
                  />
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-leashes-section-delivery"
                title="Pickup & shipping"
                description="Pin where the leash is and choose delivery options."
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
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Delivery options{" "}
                        <span className="text-destructive" aria-hidden>
                          *
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">You can select both options.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="sell-leashes-delivery-shipping"
                          checked={form.shippingAvailable}
                          onCheckedChange={(v) => {
                            const want = v === true
                            setForm((prev) => ({
                              ...prev,
                              shippingAvailable: want,
                              localPickup: want || prev.localPickup ? prev.localPickup : true,
                              ...(want
                                ? {}
                                : {
                                    shippingMode: "reswell" as const,
                                    shippingPrice: "",
                                    reswellPackageLengthIn: "",
                                    reswellPackageWidthIn: "",
                                    reswellPackageHeightIn: "",
                                    reswellPackageWeightLb: "",
                                    reswellPackageWeightOz: "",
                                  }),
                            }))
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <Label
                            htmlFor="sell-leashes-delivery-shipping"
                            className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium leading-snug"
                          >
                            Shipping
                            <Badge
                              variant="default"
                              className="h-auto border-0 bg-listingHeart px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170]"
                            >
                              Items sell faster
                            </Badge>
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="sell-leashes-delivery-pickup"
                          checked={form.localPickup}
                          onCheckedChange={(v) => {
                            const want = v === true
                            setForm((prev) => ({
                              ...prev,
                              localPickup: want,
                              shippingAvailable:
                                want || prev.shippingAvailable ? prev.shippingAvailable : true,
                            }))
                          }}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor="sell-leashes-delivery-pickup"
                          className="cursor-pointer pt-0.5 text-sm font-medium leading-snug"
                        >
                          Local pickup
                        </Label>
                      </div>
                    </div>
                  </div>

                  {form.shippingAvailable ? (
                    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                      <h3 className="text-sm font-semibold text-foreground">
                        Shipping cost in the Continental U.S.{" "}
                        <span className="text-destructive" aria-hidden>
                          *
                        </span>
                      </h3>
                      <SellShippingCostModeRadios
                        idPrefix="sell-leashes"
                        value={form.shippingMode}
                        onChange={(mode) => setField("shippingMode", mode)}
                        flatRateSlot={
                        <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                          <Label htmlFor="leash-shipping-price" className="text-sm font-semibold text-foreground">
                            Shipping rate{" "}
                            <span className="text-destructive" aria-hidden>
                              *
                            </span>
                          </Label>
                          <div className="relative max-w-md">
                            <span
                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground"
                              aria-hidden
                            >
                              $
                            </span>
                            <Input
                              id="leash-shipping-price"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={form.shippingPrice}
                              onChange={(e) => setField("shippingPrice", e.target.value)}
                              className="h-11 border-foreground/20 bg-card pl-8 tabular-nums shadow-sm placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </SellFormSection>

              {form.shippingAvailable && form.shippingMode === "reswell" ? (
                <SellFormSection
                  sectionId="sell-leashes-section-reswell-package"
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
                sectionId="sell-leashes-section-publish"
                title="Price & publish your listing"
              >
                <div className="space-y-6">
                  <SellPriceFields
                    listingPrice={form.price}
                    onListingPriceChange={(value) => setField("price", value)}
                    sellerPurchasePrice={form.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) => setField("sellerPurchasePrice", value)}
                    purchaseAccordionTitle="What you paid for the leash"
                    purchaseAccordionDescription="Keep track of what you paid versus what it sells for. This info is for your benefit only."
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
                              Sell your leash even faster
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              Increase your chances of selling with offers from buyers.
                            </p>
                          </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex gap-4">
                          <Switch
                            id="sell-leashes-buyer-offers"
                            checked={form.buyerOffers}
                            onCheckedChange={(v) => setField("buyerOffers", v === true)}
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
                            aria-label="Allow buyers to make offers"
                          />
                          <div className="min-w-0 space-y-1">
                            <Label
                              htmlFor="sell-leashes-buyer-offers"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              Allow buyers to make offers
                            </Label>
                            <p className="text-sm leading-relaxed text-muted-foreground">
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
                      "Save changes"
                    ) : (
                      "Create Listing"
                    )}
                  </Button>
                  {uploadingCount > 0 ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {uploadingCount} photo{uploadingCount > 1 ? "s" : ""} still uploading…
                    </p>
                  ) : null}
                  {videoUploading ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Video still uploading…
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
