"use client"

import { useCallback, useId, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { setJustPublishedListingMarker } from "@/lib/sell-flow/just-published"
import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import {
  SELL_SUBMIT_INTERRUPTED_MESSAGE,
  isSellSubmitAbortError,
  sellActionErrorMessage,
} from "@/lib/sell-flow/sell-submit-error"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { LocationPicker } from "@/components/location-picker"
import { AdminBulkListingBanner } from "@/components/features/sell/admin-bulk-listing-banner"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellListingPhotoGrid } from "@/components/features/sell/sell-listing-photo-grid"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import { SELL_PAGE_GROUND_CLASS, SELL_CONTROL_CLASS } from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"
import { normalizeTapeStyleInchesInput } from "@/lib/board-measurements"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
  validateReswellPackedWeightRequired,
} from "@/lib/reswell-parcel-fields"
import { reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import { useListingPhotoUpload } from "@/components/features/sell/hooks/use-listing-photo-upload"
import { useListingVideoUpload } from "@/components/features/sell/hooks/use-listing-video-upload"
import { createEmptyListingVideoSlot } from "@/lib/sell-flow/listing-video-slot"
import { useSellAccessoryDraftRecovery } from "@/components/features/sell/hooks/use-sell-accessory-draft-recovery"
import { usePendingPublishResume } from "@/components/features/sell/hooks/use-pending-publish-resume"
import { beginGuestListingPublishAuth } from "@/lib/sell-flow/guest-publish-auth"
import type { SellListingDraftFormSnapshot } from "@/lib/sell-listing-draft-idb"
import { useOwnedListingEditLoad } from "@/components/features/sell/hooks/use-owned-listing-edit-load"
import { SellEditLoadError } from "@/components/features/sell/sell-edit-load-error"
import { SellFlowRouteSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"
import { createClient } from "@/lib/supabase/client"
import { MAGAZINES_SECTION } from "@/lib/magazine-listing-config"
import {
  createMagazineListingAction,
  updateMagazineListingAction,
} from "@/lib/actions/magazineListingActions"
import {
  MAGAZINE_LISTING_MAX_PHOTOS,
  MAGAZINE_LISTING_TITLE_MAX_LENGTH,
} from "@/lib/validations/magazine-listing"
import { LISTING_CONDITION_SELL_OPTIONS, sellFormConditionValue } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { navigateAfterListingSave } from "@/lib/sell-flow/navigate-after-listing-save"
import { resolveAdminBulkListingAfterCreate } from "@/lib/utils/admin-bulk-listing-navigation"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"

type MagazineFormState = {
  title: string
  description: string
  price: string
  condition: string
  brand: string
  year: string
  locationCity: string
  locationState: string
  locationLat: number | null
  locationLng: number | null
  locationDisplay: string
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
}

const INITIAL_STATE: MagazineFormState = {
  title: "",
  description: "",
  price: "",
  condition: "",
  brand: "",
  year: "",
  locationCity: "",
  locationState: "",
  locationLat: null,
  locationLng: null,
  locationDisplay: "",
  reswellPackageLengthIn: "",
  reswellPackageWidthIn: "",
  reswellPackageHeightIn: "",
  reswellPackageWeightLb: "",
  reswellPackageWeightOz: "",
}

/** Type-safe merge of an IndexedDB draft snapshot onto the magazine form state. */
function magazineFormFromDraftSnapshot(snapshot: SellListingDraftFormSnapshot): MagazineFormState {
  const next: MagazineFormState = { ...INITIAL_STATE }
  for (const key of Object.keys(INITIAL_STATE) as Array<keyof MagazineFormState>) {
    const value = snapshot[key]
    if (value === undefined) continue
    const initial = INITIAL_STATE[key]
    if (key === "locationLat" || key === "locationLng") {
      if (value === null || typeof value === "number") {
        next[key] = value as MagazineFormState["locationLat"]
      }
      continue
    }
    if (typeof value === typeof initial) {
      next[key] = value as never
    }
  }
  return next
}

const CONDITION_UNSELECTED = "__magazine_condition_unselected__"

export default function SellMagazinesFlow({
  editListingId = null,
}: {
  editListingId?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bulkSlotId = searchParams.get("bulk")?.trim() || null
  const startFresh = searchParams.get("new") === "1"
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabaseRef = useRef(createClient())
  const formRef = useRef<HTMLFormElement | null>(null)
  const editId = editListingId?.trim() || null
  const [form, setForm] = useState<MagazineFormState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)

  const magazineSellReturnPath = useCallback(
    () =>
      typeof window === "undefined"
        ? editId
          ? `/sell/magazines?edit=${editId}`
          : "/sell/magazines"
        : `${window.location.pathname}${window.location.search}`,
    [editId],
  )

  const photoUpload = useListingPhotoUpload({
    maxPhotos: MAGAZINE_LISTING_MAX_PHOTOS,
    signInReturnPath: magazineSellReturnPath,
    openSignIn: signIn,
    supabase: supabaseRef.current,
    funnelListingType: "magazines",
    promptSignInOnUpload: false,
  })

  const {
    images,
    setImages,
    removedImageIds,
    photosFileDragActive,
    uploadingCount,
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
    hydrateExistingImages,
    imagesRef,
  } = photoUpload

  const videoUpload = useListingVideoUpload({
    signInReturnPath: magazineSellReturnPath,
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

  const restoreMagazineDraftForm = useCallback((snapshot: SellListingDraftFormSnapshot) => {
    setForm(magazineFormFromDraftSnapshot(snapshot))
  }, [])

  const { clearRecoveredDraft, flushDraftNow, draftHydrated } = useSellAccessoryDraftRecovery({
    listingType: "magazines",
    editId,
    startFresh,
    formSnapshot: form,
    images,
    onRestoreForm: restoreMagazineDraftForm,
    setImages,
    retryPhotoSlot: photoUpload.handlePhotoTileRetry,
  })

  const setField = useCallback(<K extends keyof MagazineFormState>(key: K, value: MagazineFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const hydrateMagazineEdit = useCallback(
    (listing: OwnedListingForEditRow) => {
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

      if ((listing as { section?: string }).section !== MAGAZINES_SECTION) {
        toast.error("This listing is not a magazine.")
        router.replace("/sell/magazines", { scroll: false })
        return { status: "handled" as const }
      }

      const loadedReswellPackage = reswellPackageFormFromDbRow(
        listing as {
          shipping_packed_length_in?: number | string | null
          shipping_packed_width_in?: number | string | null
          shipping_packed_height_in?: number | string | null
          shipping_packed_weight_oz?: number | string | null
        },
      )

      setForm({
        title: listing.title?.trim() ?? "",
        description: listing.description?.trim() ?? "",
        price: listing.price != null ? String(listing.price) : "",
        condition: sellFormConditionValue(listing.condition),
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        year:
          (listing as { magazine_year?: number | string | null }).magazine_year != null &&
          Number.isFinite(
            Number((listing as { magazine_year?: number | string | null }).magazine_year),
          )
            ? String((listing as { magazine_year?: number | string | null }).magazine_year)
            : "",
        locationCity: listing.city ?? "",
        locationState: listing.state ?? "",
        locationLat: listing.latitude != null ? Number(listing.latitude) : null,
        locationLng: listing.longitude != null ? Number(listing.longitude) : null,
        locationDisplay: [listing.city, listing.state].filter(Boolean).join(", "),
        ...loadedReswellPackage,
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

      hydrateExistingImages(existingImages)
      return { status: "ready" as const }
    },
    [hydrateExistingImages, hydrateExistingVideo, router],
  )

  const { editLoading, editLoadError, retryEditLoad } = useOwnedListingEditLoad({
    editId,
    supabase: supabaseRef.current,
    signInReturnPath: editId ? `/sell/magazines?edit=${editId}` : "/sell/magazines",
    openSignIn: signIn,
    notFoundRedirectHref: "/sell/magazines",
    router,
    onHydrate: hydrateMagazineEdit,
  })

  usePendingPublishResume({
    listingKind: "magazines",
    draftHydrated,
    formRef,
    imagesRef,
    editLoading,
  })

  const buildPayload = () => ({
    title: form.title,
    description: form.description,
    price: form.price,
    condition: form.condition,
    brand: form.brand,
    year: form.year,
    locationCity: form.locationCity,
    locationState: form.locationState,
    locationLat: form.locationLat ?? undefined,
    locationLng: form.locationLng ?? undefined,
    shippingCostMode: "reswell" as const,
    reswellPackageLengthIn: form.reswellPackageLengthIn,
    reswellPackageWidthIn: form.reswellPackageWidthIn,
    reswellPackageHeightIn: form.reswellPackageHeightIn,
    reswellPackageWeightLb: form.reswellPackageWeightLb,
    reswellPackageWeightOz: form.reswellPackageWeightOz,
    images: readyImages.map((photo, index) => ({
      id: photo.id,
      url: photo.url!,
      thumbnailUrl: photo.thumbnailUrl ?? null,
      isPrimary: index === 0,
      sortOrder: index,
    })),
    videos: readyVideo ? [readyVideo] : [],
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const session = await resolveClientSessionForMutation(supabaseRef.current)
    if (!session?.user || !session.access_token) {
      await beginGuestListingPublishAuth({
        kind: "magazines",
        returnPath: magazineSellReturnPath(),
        openSignIn: signIn,
        persistDraft: () => flushDraftNow({ includeInFlightPhotos: true }),
      })
      return
    }

    const publishStartedAt = Date.now()
    logSellFunnelEvent({
      listingType: "magazines",
      event: "publish_attempt",
      message: editId ? "edit" : "create",
    })
    const failValidation = (message: string) => {
      logSellFunnelEvent({ listingType: "magazines", event: "validation_failed", message })
      toast.error(message)
    }

    if (readyImages.length === 0) {
      failValidation("Add at least one photo.")
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
    if (!form.locationCity.trim() || !form.locationState.trim()) {
      failValidation("Confirm where you're listing from.")
      return
    }
    const packedLength = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
    const packedWidth = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
    const packedHeight = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
    if (
      packedLength == null ||
      packedLength <= 0 ||
      packedWidth == null ||
      packedWidth <= 0 ||
      packedHeight == null ||
      packedHeight <= 0
    ) {
      failValidation("Enter packed box dimensions for Reswell shipping.")
      return
    }
    const packedWeightError = validateReswellPackedWeightRequired(
      form.reswellPackageWeightLb,
      form.reswellPackageWeightOz,
    )
    if (packedWeightError) {
      failValidation(packedWeightError)
      return
    }

    setSubmitting(true)
    try {
      const payload = buildPayload()

      if (editId) {
        const result = await updateMagazineListingAction({
          ...payload,
          listingId: editId,
          removedImageIds,
          removedVideoIds,
        })
        if ("error" in result) {
          const message = sellActionErrorMessage(result.error)
          logSellFunnelEvent({
            listingType: "magazines",
            event: "publish_failed",
            message,
            durationMs: Date.now() - publishStartedAt,
          })
          toast.error(message)
          return
        }
        logSellFunnelEvent({
          listingType: "magazines",
          event: "publish_succeeded",
          listingId: editId,
          durationMs: Date.now() - publishStartedAt,
        })
        toast.success("Magazine listing updated.")
        navigateAfterListingSave(listingDetailHref({ id: editId, slug: result.slug }))
        return
      }

      const result = await createMagazineListingAction(payload)
      if ("error" in result) {
        const message = sellActionErrorMessage(result.error)
        logSellFunnelEvent({
          listingType: "magazines",
          event: "publish_failed",
          message,
          durationMs: Date.now() - publishStartedAt,
        })
        toast.error(message)
        return
      }

      await clearRecoveredDraft()

      logSellFunnelEvent({
        listingType: "magazines",
        event: "publish_succeeded",
        listingId: result.listingId,
        durationMs: Date.now() - publishStartedAt,
      })
      toast.success("Magazine listing published.")
      if (
        resolveAdminBulkListingAfterCreate(router, {
          bulkSlotId,
          listingId: result.listingId,
          slug: result.slug,
          title: form.title.trim(),
          section: "magazines",
          defaultDetailPath: listingDetailHref({ id: result.listingId, slug: result.slug }),
          successMessage: "Magazine listing published.",
        })
      ) {
        return
      }

      setJustPublishedListingMarker({
        listingId: result.listingId,
        slug: result.slug,
        section: "magazines",
      })
      navigateAfterListingSave(listingDetailHref({ id: result.listingId, slug: result.slug }))
    } catch (err) {
      const aborted = isSellSubmitAbortError(err)
      if (!aborted) {
        console.error("magazine listing submit failed", err)
      }
      logSellFunnelEvent({
        listingType: "magazines",
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
        backHref="/sell/magazines"
        backLabel="Back to sell magazine"
      />
    )
  }

  if (editLoading) {
    return <SellFlowRouteSkeleton />
  }

  return (
    <main className={cn("flex-1 w-full", SELL_PAGE_GROUND_CLASS)}>
      <AdminBulkListingBanner section="magazines" bulkSlotId={bulkSlotId} />
      <div className="container mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Magazine listings
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {editId ? "Edit magazine listing" : "List a magazine"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Start with cover photos, then details. Shipping rates are calculated from where you
          list — Reswell shipping only, no local pickup.
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
        <SellListingPhotoGrid
          images={images}
          maxPhotos={MAGAZINE_LISTING_MAX_PHOTOS}
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
          photoDescription="Add cover and interior shots. Drag to reorder — the first photo is the main image on browse tiles. Optional: add one short video."
          video={video}
          videoFileInputId={videoFileInputId}
          onVideoInputChange={handleVideoInputChange}
          onVideoRemove={handleVideoRemove}
          onVideoRetry={handleVideoRetry}
        />

        <div className="space-y-2">
          <Label htmlFor="magazine-title">Title *</Label>
          <Input
            id="magazine-title"
            value={form.title}
            maxLength={MAGAZINE_LISTING_TITLE_MAX_LENGTH}
            placeholder="e.g. Surfer's Journal Vol. 12 No. 3"
            className={SELL_CONTROL_CLASS}
            onChange={(e) => setField("title", e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="magazine-condition">Condition *</Label>
            <Select
              value={form.condition.trim() ? form.condition : CONDITION_UNSELECTED}
              onValueChange={(value) =>
                setField("condition", value === CONDITION_UNSELECTED ? "" : value)
              }
            >
              <SelectTrigger id="magazine-condition" className={SELL_CONTROL_CLASS}>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CONDITION_UNSELECTED} disabled>
                  Select condition
                </SelectItem>
                {LISTING_CONDITION_SELL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="magazine-year">Year *</Label>
            <Input
              id="magazine-year"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.year}
              placeholder="e.g. 1998"
              className={SELL_CONTROL_CLASS}
              onChange={(e) => setField("year", e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="magazine-brand">Brand / publisher *</Label>
          <Input
            id="magazine-brand"
            value={form.brand}
            placeholder="e.g. Surfer, Surfing World, Tracks"
            className={SELL_CONTROL_CLASS}
            onChange={(e) => setField("brand", e.target.value)}
            required
          />
        </div>

        <SellListingDescriptionField
          id="magazine-description"
          value={form.description}
          onChange={(value) => setField("description", value)}
          placeholder="Describe the issue, cover features, and condition details…"
        />

        <div className="space-y-2">
          <Label htmlFor="magazine-price">Price *</Label>
          <div className="relative max-w-xs">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
              aria-hidden
            >
              $
            </span>
            <Input
              id="magazine-price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={cn(SELL_CONTROL_CLASS, "pl-8 tabular-nums")}
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">Shipping</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pin where you&apos;re listing from, then enter the outer box you&apos;ll ship the
              magazine or book in. Checkout rates use your location and package size.
            </p>
          </div>

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

          <ReswellPackageDimensionsCard
            lengthIn={form.reswellPackageLengthIn}
            widthIn={form.reswellPackageWidthIn}
            heightIn={form.reswellPackageHeightIn}
            weightLb={form.reswellPackageWeightLb}
            weightOz={form.reswellPackageWeightOz}
            onLengthInChange={(value) =>
              setField("reswellPackageLengthIn", normalizeTapeStyleInchesInput(value))
            }
            onWidthInChange={(value) =>
              setField("reswellPackageWidthIn", normalizeTapeStyleInchesInput(value))
            }
            onHeightInChange={(value) =>
              setField("reswellPackageHeightIn", normalizeTapeStyleInchesInput(value))
            }
            onWeightLbChange={(value) => setField("reswellPackageWeightLb", value)}
            onWeightOzChange={(value) => setField("reswellPackageWeightOz", value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={submitting || uploadingCount > 0 || videoUploading}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : editId ? (
              "Save changes"
            ) : (
              "Publish listing"
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/magazines">View magazines</Link>
          </Button>
        </div>
      </form>
    </div>
    </main>
  )
}
