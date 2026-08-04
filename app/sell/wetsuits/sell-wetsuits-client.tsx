"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { SellShippingCostModeRadios } from "@/components/features/sell/sell-shipping-cost-mode-radios"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellWetsuitsFacetFields } from "@/components/features/sell/sell-wetsuits-facet-fields"
import { SellListingPhotoGrid } from "@/components/features/sell/sell-listing-photo-grid"
import { useListingPhotoUpload } from "@/components/features/sell/hooks/use-listing-photo-upload"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  SELL_WETSUITS_FORM_SECTION_NAV_ITEMS,
} from "@/components/features/sell/sell-section-nav"
import { createClient } from "@/lib/supabase/client"
import { useOwnedListingEditLoad } from "@/components/features/sell/hooks/use-owned-listing-edit-load"
import { SellEditLoadError } from "@/components/features/sell/sell-edit-load-error"
import { SellFlowRouteSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import {
  WETSUIT_LISTING_MAX_PHOTOS,
  WETSUIT_LISTING_TITLE_MAX_LENGTH,
  type CreateWetsuitListingInput,
} from "@/lib/validations/wetsuit-listing"
import {
  createWetsuitListingAction,
  updateWetsuitListingAction,
} from "@/lib/actions/wetsuitListingActions"
import { buildWetsuitListingPersistFields } from "@/lib/wetsuit-listing-persist-fields"
import { computeWetsuitSellSectionCompletion } from "@/lib/wetsuit-sell-section-completion"
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
import {
  SELL_SUBMIT_INTERRUPTED_MESSAGE,
  isSellSubmitAbortError,
  sellActionErrorMessage,
} from "@/lib/sell-flow/sell-submit-error"
import { useSellFunnelStepTracking } from "@/lib/sell-flow/use-sell-funnel-step-tracking"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { SELL_PAGE_GROUND_CLASS } from "@/components/features/sell/sell-form-surface"

function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = Number.parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? String(n) : ""
}

function wetsuitShippingModeFromListing(listing: {
  shipping_available?: boolean | null
  shipping_price?: number | string | null
  board_shipping_cost_mode?: string | null
}): WetsuitFormState["shippingMode"] {
  const stored = listing.board_shipping_cost_mode
  if (stored === "reswell" || stored === "free" || stored === "flat") return stored
  if (listing.shipping_available) {
    const n = Number.parseFloat(String(listing.shipping_price ?? 0).replace(/,/g, ""))
    if (Number.isFinite(n) && n > 0) return "flat"
    return "free"
  }
  return "reswell"
}

type WetsuitFormState = {
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

const INITIAL_STATE: WetsuitFormState = {
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

function scrollWetsuitSellSectionIntoView(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function SellWetsuitsFlow({ editListingId = null }: { editListingId?: string | null }) {
  const router = useRouter()
  const bulkSlotId = useSearchParams().get("bulk")?.trim() || null
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabaseRef = useRef(createClient())
  const editId = editListingId?.trim() || null

  const [form, setForm] = useState<WetsuitFormState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [actorIsAdmin, setActorIsAdmin] = useState<boolean | null>(null)

  const wetsuitSellReturnPath = useCallback(
    () =>
      typeof window === "undefined"
        ? editId
          ? `/sell/wetsuits?edit=${editId}`
          : "/sell/wetsuits"
        : `${window.location.pathname}${window.location.search}`,
    [editId],
  )

  const photoUpload = useListingPhotoUpload({
    maxPhotos: WETSUIT_LISTING_MAX_PHOTOS,
    signInReturnPath: wetsuitSellReturnPath,
    openSignIn: signIn,
    supabase: supabaseRef.current,
    funnelListingType: "wetsuits",
  })

  const {
    removedImageIds,
    photosFileDragActive,
    uploadingCount,
    readyImages,
    images,
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
    hydrateExistingImages,
  } = photoUpload

  const hydrateWetsuitEdit = useCallback(
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

      if ((listing as { section?: string }).section !== "wetsuits") {
        toast.error("Only wetsuit listings can be edited here.")
        router.replace("/sell/wetsuits", { scroll: false })
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
      const shippingMode = wetsuitShippingModeFromListing(
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
        size: (listing as { wetsuit_size?: string | null }).wetsuit_size ?? "",
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        model: (listing as { model?: string | null }).model?.trim() ?? "",
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
        .map(
          (img): ListingPhotoSlot => ({
            clientId: img.id,
            id: img.id,
            previewUrl: proxiedListingImageSrc(img.thumbnail_url?.trim() || img.url) ?? img.url,
            url: img.url,
            thumbnailUrl: img.thumbnail_url?.trim() || img.url,
            optimizePhase: "done",
            uploadPhase: "done",
            progressFull: 100,
            progressThumb: 100,
          }),
        )

      hydrateExistingImages(existingImages)
      return { status: "ready" as const }
    },
    [hydrateExistingImages, router],
  )

  const { editLoading, editLoadError, retryEditLoad } = useOwnedListingEditLoad({
    editId,
    supabase: supabaseRef.current,
    signInReturnPath: editId ? `/sell/wetsuits?edit=${editId}` : "/sell/wetsuits",
    openSignIn: signIn,
    notFoundRedirectHref: "/sell/wetsuits",
    router,
    onHydrate: hydrateWetsuitEdit,
  })

  const setField = useCallback(<K extends keyof WetsuitFormState>(key: K, value: WetsuitFormState[K]) => {
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


  const sellSectionCompletion = useMemo(
    () =>
      computeWetsuitSellSectionCompletion({
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

  useSellFunnelStepTracking({
    listingType: "wetsuits",
    sectionIds: SELL_WETSUITS_FORM_SECTION_NAV_ITEMS.map((item) => item.id),
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
      signIn("/sell/wetsuits")
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
      listingType: "wetsuits",
      event: "publish_attempt",
      message: editId ? "edit" : "create",
    })
    const failValidation = (message: string) => {
      logSellFunnelEvent({ listingType: "wetsuits", event: "validation_failed", message })
      toast.error(message)
    }

    if (readyImages.length === 0) {
      failValidation("Add at least one photo.")
      scrollWetsuitSellSectionIntoView("sell-wetsuits-section-photos-title")
      return
    }
    if (uploadingCount > 0) {
      failValidation("Hang tight — your photos are still uploading.")
      return
    }
    if (!form.title.trim()) {
      failValidation("Add a title.")
      scrollWetsuitSellSectionIntoView("sell-wetsuits-section-photos-title")
      return
    }
    if (!form.condition) {
      failValidation("Choose a condition.")
      scrollWetsuitSellSectionIntoView("sell-wetsuits-section-details")
      return
    }
    if (!form.description.trim()) {
      failValidation("Add a description.")
      scrollWetsuitSellSectionIntoView("sell-wetsuits-section-details")
      return
    }
    if (!form.price.trim() || Number(form.price) <= 0) {
      failValidation("Enter a price.")
      scrollWetsuitSellSectionIntoView("sell-wetsuits-section-publish")
      return
    }
    if (!form.locationCity.trim() || !form.locationState.trim()) {
      failValidation("Confirm where you're shipping from.")
      scrollWetsuitSellSectionIntoView("sell-wetsuits-section-delivery")
      return
    }
    if (normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin) === "reswell") {
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) {
        failValidation("Enter packed box dimensions for Reswell shipping.")
        scrollWetsuitSellSectionIntoView("sell-wetsuits-section-reswell-package")
        return
      }
    }
    if (
      normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin) === "flat" &&
      (form.shippingPrice === "" || Number(form.shippingPrice) < 0)
    ) {
      failValidation("Enter a flat shipping rate.")
      scrollWetsuitSellSectionIntoView("sell-wetsuits-section-delivery")
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      condition: form.condition as CreateWetsuitListingInput["condition"],
      size: form.size || null,
      brand: form.brand,
      model: form.model,
      locationCity: form.locationCity,
      locationState: form.locationState,
      locationLat: form.locationLat ?? undefined,
      locationLng: form.locationLng ?? undefined,
      shippingAvailable: true,
      localPickup: false,
      shippingCostMode: normalizeSellShippingCostMode(form.shippingMode, submitActorIsAdmin),
      shippingPrice:
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
              listing: buildWetsuitListingPersistFields(payload, { allowPrivilegedShippingModes: true }),
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
              listingType: "wetsuits",
              event: "publish_failed",
              message,
              durationMs: Date.now() - publishStartedAt,
            })
            toast.error(message)
            setSubmitting(false)
            return
          }
          logSellFunnelEvent({
            listingType: "wetsuits",
            event: "publish_succeeded",
            listingId: editId ?? undefined,
            durationMs: Date.now() - publishStartedAt,
          })
          toast.success("Listing updated")
          router.replace(
            listingDetailHref({
              id: editId,
              slug: data.slug ?? null,
            }),
          )
          return
        }

        if (!ownerEditsOwnListing) {
          toast.error(
            "This listing belongs to another account. From admin, open the seller and use impersonation for that shop, or sign in as the listing owner.",
          )
          setSubmitting(false)
          return
        }

        const result = await updateWetsuitListingAction({
          ...payload,
          listingId: editId,
          removedImageIds,
        })
        if ("error" in result) {
          const message = sellActionErrorMessage(result.error)
          logSellFunnelEvent({
            listingType: "wetsuits",
            event: "publish_failed",
            message,
            durationMs: Date.now() - publishStartedAt,
          })
          toast.error(message)
          setSubmitting(false)
          return
        }
        logSellFunnelEvent({
          listingType: "wetsuits",
          event: "publish_succeeded",
          listingId: editId,
          durationMs: Date.now() - publishStartedAt,
        })
        toast.success("Listing updated")
        router.replace(
          listingDetailHref({
            id: editId,
            slug: result.slug,
          }),
        )
        return
      }

      await finalizePeerListingCreate({
        listingImpersonation,
        listingFields: buildWetsuitListingPersistFields(
          payload,
          listingImpersonation ? { allowPrivilegedShippingModes: true } : undefined,
        ),
        images: payload.images.map((img) => ({
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
        })),
        title: payload.title,
        section: "wetsuits",
        bulkSlotId,
        router,
        publishStartedAt,
        successToast: "Your wetsuit is live!",
        setSubmitting,
        directCreate: () => createWetsuitListingAction(payload),
      })
    } catch (err) {
      const aborted = isSellSubmitAbortError(err)
      if (!aborted) {
        console.error("wetsuit listing submit failed", err)
      }
      logSellFunnelEvent({
        listingType: "wetsuits",
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
    } finally {
      setSubmitting(false)
    }
  }

  if (editLoadError) {
    return (
      <SellEditLoadError
        message={editLoadError}
        onRetry={retryEditLoad}
        backHref="/sell/wetsuits"
        backLabel="Back to sell wetsuit"
      />
    )
  }

  if (editLoading) {
    return <SellFlowRouteSkeleton />
  }

  return (
    <main className={cn("flex-1 w-full pt-8 pb-16 md:pb-20 lg:pb-24", SELL_PAGE_GROUND_CLASS)}>
      <AdminBulkListingBanner section="wetsuits" bulkSlotId={bulkSlotId} />
      <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
        <h1 className="sr-only">{editId ? "Edit wetsuit listing" : "List your wetsuit"}</h1>

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
                    {editId ? "Edit wetsuit listing" : "List wetsuit"}
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
              items={SELL_WETSUITS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
            />
          </div>

          <div className="min-w-0 w-full max-w-2xl lg:w-auto lg:max-w-3xl lg:shrink-0">
            <SellSectionNavHorizontal
              items={SELL_WETSUITS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
              className="mb-8 hidden md:block lg:hidden"
            />

            <form onSubmit={handleSubmit} className="space-y-10 lg:space-y-12" aria-busy={submitting}>
              <SellFormSection
                sectionId="sell-wetsuits-section-photos-title"
                title="Photos & title"
                description="Start with clear photos of your wetsuit, then add a short title. Buyers see these first."
                complete={sellSectionCompletion["sell-wetsuits-section-photos-title"] === true}
              >
                <div className="space-y-8">
                  <SellListingPhotoGrid
                    images={images}
                    maxPhotos={WETSUIT_LISTING_MAX_PHOTOS}
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
                    photoDescription="Add clear photos. Drag to reorder — the first image is your main photo on browse tiles."
                  />

                  <Separator className="bg-border" />

                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <Label htmlFor="wetsuit-title">Title *</Label>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          form.title.length > WETSUIT_LISTING_TITLE_MAX_LENGTH
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                        aria-live="polite"
                      >
                        {form.title.length}/{WETSUIT_LISTING_TITLE_MAX_LENGTH}
                      </span>
                    </div>
                    <Input
                      id="wetsuit-title"
                      className="h-11 border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground"
                      placeholder="e.g. Rip Curl Flashbomb 3/2 Steamer — Medium"
                      value={form.title}
                      maxLength={WETSUIT_LISTING_TITLE_MAX_LENGTH}
                      onChange={(e) => setField("title", e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-wetsuits-section-details"
                title="Wetsuit details & description"
                description="Condition and details help buyers shop with confidence."
              >
                <div className="space-y-8">
                  <SellWetsuitsFacetFields
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
                    id="wetsuit-description"
                    value={form.description}
                    onChange={(v) => setField("description", v)}
                    placeholder="Thickness, seams, any wear or repairs, why you're selling…"
                  />
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-wetsuits-section-delivery"
                title="Shipping"
                description="Pin where you're shipping from and choose how shipping works. Wetsuit listings ship only — local pickup isn't available."
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
                    <SellShippingCostModeRadios
                      idPrefix="sell-wetsuits"
                      value={form.shippingMode}
                      onChange={(mode) => setField("shippingMode", mode)}
                      allowPrivilegedModes={actorIsAdmin === true}
                      flatRateSlot={
                        <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                          <Label htmlFor="wetsuit-shipping-price" className="text-sm font-semibold text-foreground">
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
                              id="wetsuit-shipping-price"
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
                </div>
              </SellFormSection>

              {form.shippingMode === "reswell" ? (
                <SellFormSection
                  sectionId="sell-wetsuits-section-reswell-package"
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
                sectionId="sell-wetsuits-section-publish"
                title="Price & publish your listing"
              >
                <div className="space-y-6">
                  <SellPriceFields
                    listingPrice={form.price}
                    onListingPriceChange={(value) => setField("price", value)}
                    sellerPurchasePrice={form.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) => setField("sellerPurchasePrice", value)}
                    purchaseAccordionTitle="What you paid for the wetsuit"
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
                              Sell your wetsuit even faster
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              Increase your chances of selling with offers from buyers.
                            </p>
                          </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex gap-4">
                          <Switch
                            id="sell-wetsuits-buyer-offers"
                            checked={form.buyerOffers}
                            onCheckedChange={(v) => setField("buyerOffers", v === true)}
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
                            aria-label="Allow buyers to make offers"
                          />
                          <div className="min-w-0 space-y-1">
                            <Label
                              htmlFor="sell-wetsuits-buyer-offers"
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
