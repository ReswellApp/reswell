"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Heart, Loader2, Upload, X, Zap } from "lucide-react"
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
import { SellShippingCostModeRadios } from "@/components/features/sell/sell-shipping-cost-mode-radios"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellApparelFacetFields } from "@/components/features/sell/sell-apparel-facet-fields"
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
import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import {
  assertListingOriginalSize,
  prepareListingImagePairFromFile,
} from "@/lib/listing-image-pipeline"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import { friendlyListingPhotoErrorMessage } from "@/lib/utils/friendly-listing-photo-error"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import {
  APPAREL_LISTING_MAX_PHOTOS,
  APPAREL_LISTING_TITLE_MAX_LENGTH,
  type CreateApparelListingInput,
} from "@/lib/validations/apparel-listing"
import {
  createApparelListingAction,
  updateApparelListingAction,
} from "@/lib/actions/apparelListingActions"
import { buildApparelListingPersistFields } from "@/lib/apparel-listing-persist-fields"
import { computeApparelSellSectionCompletion } from "@/lib/apparel-sell-section-completion"
import { sellFormConditionValue } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
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

const SELL_APPAREL_FORM_SECTION_NAV_ITEMS = buildSellSectionNavItems("apparel", "Apparel details")

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
}

function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = Number.parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? String(n) : ""
}

function apparelShippingModeFromListing(listing: {
  shipping_available?: boolean | null
  shipping_price?: number | string | null
  board_shipping_cost_mode?: string | null
}): ApparelFormState["shippingMode"] {
  const stored = listing.board_shipping_cost_mode
  if (stored === "reswell" || stored === "free" || stored === "flat") return stored
  if (listing.shipping_available) {
    const n = Number.parseFloat(String(listing.shipping_price ?? 0).replace(/,/g, ""))
    if (Number.isFinite(n) && n > 0) return "flat"
    return "free"
  }
  return "reswell"
}

type ApparelFormState = {
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

const INITIAL_STATE: ApparelFormState = {
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

function newClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function scrollApparelSellSectionIntoView(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function SellApparelFlow({ editListingId = null }: { editListingId?: string | null }) {
  const router = useRouter()
  const bulkSlotId = useSearchParams().get("bulk")?.trim() || null
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabaseRef = useRef(createClient())
  const editId = editListingId?.trim() || null

  const [form, setForm] = useState<ApparelFormState>(INITIAL_STATE)
  const [photos, setPhotos] = useState<PhotoSlot[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [actorIsAdmin, setActorIsAdmin] = useState<boolean | null>(null)
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])

  const photosRef = useRef<PhotoSlot[]>([])
  photosRef.current = photos

  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        if (p.file) URL.revokeObjectURL(p.previewUrl)
      }
    }
  }, [])

  const hydrateApparelEdit = useCallback(
    (listing: OwnedListingForEditRow) => {
      const imp = getImpersonation()

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

      if ((listing as { section?: string }).section !== "apparel") {
        toast.error("Only apparel listings can be edited here.")
        router.replace("/sell/apparel", { scroll: false })
        return { status: "handled" as const }
      }

      setEditListingOwnerId(listing.user_id as string)
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
      const shippingMode = apparelShippingModeFromListing(
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
        size: (listing as { apparel_size?: string | null }).apparel_size ?? "",
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

      setPhotos(existingImages)
      setRemovedImageIds([])
      return { status: "ready" as const }
    },
    [router],
  )

  const { editLoading, editLoadError, retryEditLoad } = useOwnedListingEditLoad({
    editId,
    supabase: supabaseRef.current,
    signInReturnPath: editId ? `/sell/apparel?edit=${editId}` : "/sell/apparel",
    openSignIn: signIn,
    notFoundRedirectHref: "/sell/apparel",
    router,
    onHydrate: hydrateApparelEdit,
  })

  const setField = useCallback(<K extends keyof ApparelFormState>(key: K, value: ApparelFormState[K]) => {
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

  useEffect(() => {
    if (actorIsAdmin !== false) return
    if (form.shippingMode !== "free" && form.shippingMode !== "flat") return
    setField("shippingMode", "reswell")
  }, [actorIsAdmin, form.shippingMode, setField])


  const updateSlot = useCallback((clientId: string, patch: Partial<PhotoSlot>) => {
    setPhotos((prev) => prev.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)))
  }, [])

  const uploadSlot = useCallback(
    async (slot: PhotoSlot) => {
      if (!slot.file) return
      try {
        const decodable = await ensureBrowserDecodableImageFile(slot.file)
        const prepared = await prepareListingImagePairFromFile(decodable)
        updateSlot(slot.clientId, { phase: "uploading", progress: 5 })

        const supabase = supabaseRef.current
        const session = await resolveClientSessionForMutation(supabase)
        const user = session?.user
        if (!session?.access_token || !user) {
          updateSlot(slot.clientId, { phase: "error" })
          signIn("/sell/apparel")
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
        console.error("apparel photo upload failed", err)
        logSellFunnelEvent({
          listingType: "apparel",
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

      const remaining = APPAREL_LISTING_MAX_PHOTOS - photosRef.current.length
      if (remaining <= 0) {
        toast.error(`You can add up to ${APPAREL_LISTING_MAX_PHOTOS} photos.`)
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

  const uploadingCount = photos.filter((p) => p.phase !== "done" && p.phase !== "error").length
  const readyPhotos = photos.filter((p) => p.phase === "done" && p.url)

  const sellSectionCompletion = useMemo(
    () =>
      computeApparelSellSectionCompletion({
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
    listingType: "apparel",
    sectionIds: SELL_APPAREL_FORM_SECTION_NAV_ITEMS.map((item) => item.id),
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
      signIn("/sell/apparel")
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
      listingType: "apparel",
      event: "publish_attempt",
      message: editId ? "edit" : "create",
    })
    const failValidation = (message: string) => {
      logSellFunnelEvent({ listingType: "apparel", event: "validation_failed", message })
      toast.error(message)
    }

    if (readyPhotos.length === 0) {
      failValidation("Add at least one photo.")
      scrollApparelSellSectionIntoView("sell-apparel-section-photos-title")
      return
    }
    if (uploadingCount > 0) {
      failValidation("Hang tight — your photos are still uploading.")
      return
    }
    if (!form.title.trim()) {
      failValidation("Add a title.")
      scrollApparelSellSectionIntoView("sell-apparel-section-photos-title")
      return
    }
    if (!form.condition) {
      failValidation("Choose a condition.")
      scrollApparelSellSectionIntoView("sell-apparel-section-details")
      return
    }
    if (!form.description.trim()) {
      failValidation("Add a description.")
      scrollApparelSellSectionIntoView("sell-apparel-section-details")
      return
    }
    if (!form.price.trim() || Number(form.price) <= 0) {
      failValidation("Enter a price.")
      scrollApparelSellSectionIntoView("sell-apparel-section-publish")
      return
    }
    if (!form.locationCity.trim() || !form.locationState.trim()) {
      failValidation("Confirm where you're listing from.")
      scrollApparelSellSectionIntoView("sell-apparel-section-delivery")
      return
    }
    if (!form.shippingAvailable && !form.localPickup) {
      failValidation("Choose shipping, local pickup, or both.")
      scrollApparelSellSectionIntoView("sell-apparel-section-delivery")
      return
    }
    if (form.shippingAvailable && normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin) === "reswell") {
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) {
        failValidation("Enter packed box dimensions for Reswell shipping.")
        scrollApparelSellSectionIntoView("sell-apparel-section-reswell-package")
        return
      }
    }
    if (
      form.shippingAvailable &&
      normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin) === "flat" &&
      (form.shippingPrice === "" || Number(form.shippingPrice) < 0)
    ) {
      failValidation("Enter a flat shipping rate.")
      scrollApparelSellSectionIntoView("sell-apparel-section-delivery")
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      condition: form.condition as CreateApparelListingInput["condition"],
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
          listingImpersonation &&
          listingImpersonation.userId === editListingOwnerId &&
          user.id !== editListingOwnerId,
      )

      if (editId) {
        const ownerEditsOwnListing = user.id === editListingOwnerId
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
              listing: buildApparelListingPersistFields(payload, { allowPrivilegedShippingModes: true }),
              removedImageIds,
              images: imageOps,
            }),
          })
          const data = (await res.json().catch(() => ({}))) as { error?: string; slug?: string }
          if (!res.ok) {
            const message = sellActionErrorMessage(
              typeof data.error === "string" ? data.error : "Failed to update listing",
            )
            logSellFunnelEvent({
              listingType: "apparel",
              event: "publish_failed",
              message,
              durationMs: Date.now() - publishStartedAt,
            })
            toast.error(message)
            setSubmitting(false)
            return
          }
          logSellFunnelEvent({
            listingType: "apparel",
            event: "publish_succeeded",
            listingId: editId ?? undefined,
            durationMs: Date.now() - publishStartedAt,
          })
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

        const result = await updateApparelListingAction({
          ...payload,
          listingId: editId,
          removedImageIds,
        })
        if ("error" in result) {
          const message = sellActionErrorMessage(result.error)
          logSellFunnelEvent({
            listingType: "apparel",
            event: "publish_failed",
            message,
            durationMs: Date.now() - publishStartedAt,
          })
          toast.error(message)
          setSubmitting(false)
          return
        }
        logSellFunnelEvent({
          listingType: "apparel",
          event: "publish_succeeded",
          listingId: editId,
          durationMs: Date.now() - publishStartedAt,
        })
        toast.success("Listing updated")
        router.push(`/l/${result.slug}`)
        return
      }

      await finalizePeerListingCreate({
        listingImpersonation,
        listingFields: buildApparelListingPersistFields(
          payload,
          listingImpersonation ? { allowPrivilegedShippingModes: true } : undefined,
        ),
        images: payload.images.map((img) => ({
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
        })),
        title: payload.title,
        section: "apparel",
        bulkSlotId,
        router,
        publishStartedAt,
        successToast: "Your apparel is live!",
        setSubmitting,
        directCreate: () => createApparelListingAction(payload),
      })
    } catch (err) {
      const aborted = isSellSubmitAbortError(err)
      if (!aborted) {
        console.error("apparel listing submit failed", err)
      }
      logSellFunnelEvent({
        listingType: "apparel",
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
        backHref="/sell/apparel"
        backLabel="Back to sell apparel"
      />
    )
  }

  if (editLoading) {
    return <SellFlowRouteSkeleton />
  }

  return (
    <main className="flex-1 w-full bg-slate-100 pt-8 pb-16 md:pb-20 lg:pb-24">
      <AdminBulkListingBanner section="apparel" bulkSlotId={bulkSlotId} />
      <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
        <h1 className="sr-only">{editId ? "Edit apparel listing" : "List your apparel"}</h1>

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
                    {editId ? "Edit apparel listing" : "List apparel"}
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
              items={SELL_APPAREL_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
            />
          </div>

          <div className="min-w-0 w-full max-w-2xl lg:w-auto lg:max-w-3xl lg:shrink-0">
            <SellSectionNavHorizontal
              items={SELL_APPAREL_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
              className="mb-8 hidden md:block lg:hidden"
            />

            <form onSubmit={handleSubmit} className="space-y-10 lg:space-y-12" aria-busy={submitting}>
              <SellFormSection
                sectionId="sell-apparel-section-photos-title"
                title="Photos & title"
                description="Start with clear photos, then add a short title. Buyers see these first."
                complete={sellSectionCompletion["sell-apparel-section-photos-title"] === true}
              >
                <div className="space-y-8">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">Photos</h3>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          Add clear photos. The first image is your main photo — tap the star on any
                          other photo to make it the cover.
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
                      <SellListingPhotoEmptyDropzone
                        fileInputId={fileInputId}
                        onFilesSelected={addFiles}
                      />
                    ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {photos.map((photo, index) => (
                        <div
                          key={photo.clientId}
                          className="relative aspect-square overflow-hidden rounded-lg border border-transparent bg-muted"
                        >
                          <Image
                            src={photo.previewUrl}
                            alt={`Photo ${index + 1}`}
                            fill
                            sizes="120px"
                            className="object-cover object-center"
                            unoptimized
                          />
                          {photo.phase !== "done" ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 text-xs text-muted-foreground">
                              {photo.phase === "error" ? (
                                <span className="text-destructive">Failed</span>
                              ) : (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {photo.progress > 0 ? `${photo.progress}%` : null}
                                </>
                              )}
                            </div>
                          ) : null}
                          {index === 0 ? (
                            <span className="absolute left-1.5 top-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                              Main
                            </span>
                          ) : null}
                          <div className="absolute right-1 top-1 flex gap-1">
                            {index !== 0 && photo.phase === "done" ? (
                              <button
                                type="button"
                                onClick={() => makePrimary(photo.clientId)}
                                className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
                                title="Make main photo"
                                aria-label="Make main photo"
                              >
                                ★
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removePhoto(photo.clientId)}
                              className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
                              title="Remove photo"
                              aria-label="Remove photo"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {photos.length < APPAREL_LISTING_MAX_PHOTOS ? (
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
                    <p className="space-y-1 text-xs text-muted-foreground">
                      <span className="block">Thank you for listing on Reswell.</span>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span>Made with</span>
                        <Heart
                          className="h-4 w-4 shrink-0 fill-listingHeart text-listingHeart"
                          aria-hidden
                        />
                        <span>in Santa Barbara.</span>
                      </span>
                    </p>
                  </div>

                  <Separator className="bg-border" />

                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <Label htmlFor="apparel-title">Title *</Label>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          form.title.length > APPAREL_LISTING_TITLE_MAX_LENGTH
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                        aria-live="polite"
                      >
                        {form.title.length}/{APPAREL_LISTING_TITLE_MAX_LENGTH}
                      </span>
                    </div>
                    <Input
                      id="apparel-title"
                      className="h-11 border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground"
                      placeholder="e.g. Rip Curl Flashbomb 3/2 Steamer — Medium"
                      value={form.title}
                      maxLength={APPAREL_LISTING_TITLE_MAX_LENGTH}
                      onChange={(e) => setField("title", e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>

                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-apparel-section-details"
                title="Apparel details & description"
                description="Condition and details help buyers shop with confidence."
              >
                <div className="space-y-8">
                  <SellApparelFacetFields
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
                    id="apparel-description"
                    value={form.description}
                    onChange={(v) => setField("description", v)}
                    placeholder="Thickness, seams, any wear or repairs, why you're selling…"
                  />
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-apparel-section-delivery"
                title="Pickup & shipping"
                description="Pin where the apparel is and choose delivery options."
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
                          id="sell-apparel-delivery-shipping"
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
                            htmlFor="sell-apparel-delivery-shipping"
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
                          id="sell-apparel-delivery-pickup"
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
                          htmlFor="sell-apparel-delivery-pickup"
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
                        idPrefix="sell-apparel"
                        value={form.shippingMode}
                        onChange={(mode) => setField("shippingMode", mode)}
                        allowPrivilegedModes={actorIsAdmin === true}
                        flatRateSlot={
                        <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                          <Label htmlFor="apparel-shipping-price" className="text-sm font-semibold text-foreground">
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
                              id="apparel-shipping-price"
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
                  sectionId="sell-apparel-section-reswell-package"
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
                sectionId="sell-apparel-section-publish"
                title="Price & publish your listing"
              >
                <div className="space-y-6">
                  <SellPriceFields
                    listingPrice={form.price}
                    onListingPriceChange={(value) => setField("price", value)}
                    sellerPurchasePrice={form.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) => setField("sellerPurchasePrice", value)}
                    purchaseAccordionTitle="What you paid for the apparel"
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
                              Sell your apparel even faster
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              Increase your chances of selling with offers from buyers.
                            </p>
                          </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex gap-4">
                          <Switch
                            id="sell-apparel-buyer-offers"
                            checked={form.buyerOffers}
                            onCheckedChange={(v) => setField("buyerOffers", v === true)}
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
                            aria-label="Allow buyers to make offers"
                          />
                          <div className="min-w-0 space-y-1">
                            <Label
                              htmlFor="sell-apparel-buyer-offers"
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
                </div>
              </SellFormSection>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
