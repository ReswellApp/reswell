"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
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
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellListingPhotoGrid } from "@/components/features/sell/sell-listing-photo-grid"
import { useListingPhotoUpload } from "@/components/features/sell/hooks/use-listing-photo-upload"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
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
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"

type MagazineFormState = {
  title: string
  description: string
  price: string
  condition: string
  brand: string
  year: string
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
  reswellPackageLengthIn: "",
  reswellPackageWidthIn: "",
  reswellPackageHeightIn: "",
  reswellPackageWeightLb: "",
  reswellPackageWeightOz: "",
}

const CONDITION_UNSELECTED = "__magazine_condition_unselected__"

export default function SellMagazinesFlow({
  editListingId = null,
}: {
  editListingId?: string | null
}) {
  const router = useRouter()
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabaseRef = useRef(createClient())
  const editId = editListingId?.trim() || null
  const [form, setForm] = useState<MagazineFormState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [editLoading, setEditLoading] = useState(Boolean(editId))

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
  })

  const {
    images,
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
  } = photoUpload

  const setField = useCallback(<K extends keyof MagazineFormState>(key: K, value: MagazineFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    ;(async () => {
      setEditLoading(true)
      const supabase = supabaseRef.current
      const { data: listing, error } = await supabase
        .from("listings")
        .select(
          `
          id,
          section,
          title,
          description,
          price,
          condition,
          brand,
          magazine_year,
          board_shipping_cost_mode,
          shipping_packed_length_in,
          shipping_packed_width_in,
          shipping_packed_height_in,
          shipping_packed_weight_oz,
          listing_images (id, url, thumbnail_url, is_primary, sort_order)
        `,
        )
        .eq("id", editId)
        .maybeSingle()

      if (cancelled) return
      if (error || !listing) {
        toast.error("Could not load this listing.")
        setEditLoading(false)
        return
      }
      if (listing.section !== MAGAZINES_SECTION) {
        toast.error("This listing is not a magazine.")
        setEditLoading(false)
        return
      }

      const pkg = reswellPackageFormFromDbRow(listing)
      setForm({
        title: listing.title?.trim() ?? "",
        description: listing.description?.trim() ?? "",
        price: listing.price != null ? String(listing.price) : "",
        condition: sellFormConditionValue(listing.condition),
        brand: listing.brand?.trim() ?? "",
        year:
          listing.magazine_year != null && Number.isFinite(Number(listing.magazine_year))
            ? String(listing.magazine_year)
            : "",
        reswellPackageLengthIn: pkg.reswellPackageLengthIn,
        reswellPackageWidthIn: pkg.reswellPackageWidthIn,
        reswellPackageHeightIn: pkg.reswellPackageHeightIn,
        reswellPackageWeightLb: pkg.reswellPackageWeightLb,
        reswellPackageWeightOz: pkg.reswellPackageWeightOz,
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
      setEditLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [editId, hydrateExistingImages])

  const buildPayload = () => ({
    title: form.title,
    description: form.description,
    price: form.price,
    condition: form.condition,
    brand: form.brand,
    year: form.year,
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
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (readyImages.length === 0) {
      toast.error("Add at least one photo.")
      return
    }
    if (uploadingCount > 0) {
      toast.error("Hang tight — your photos are still uploading.")
      return
    }

    setSubmitting(true)
    try {
      const payload = buildPayload()
      const result = editId
        ? await updateMagazineListingAction({ ...payload, listingId: editId, removedImageIds })
        : await createMagazineListingAction(payload)

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success(editId ? "Magazine listing updated." : "Magazine listing published.")
      router.push(listingDetailHref({ id: editId ?? result.slug, slug: result.slug }))
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (editLoading) {
    return (
      <div className="container mx-auto flex min-h-[40vh] items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading listing…</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Magazine listings
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {editId ? "Edit magazine listing" : "List a magazine"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Listings appear on the marketplace under the magazine seller profile. Shipping only — no local pickup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
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
          photoDescription="Add cover and interior shots. Drag to reorder — the first photo is the main image on browse tiles."
        />

        <div className="space-y-2">
          <Label htmlFor="magazine-title">Title *</Label>
          <Input
            id="magazine-title"
            value={form.title}
            maxLength={MAGAZINE_LISTING_TITLE_MAX_LENGTH}
            placeholder="e.g. Surfer's Journal Vol. 12 No. 3"
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
              <SelectTrigger id="magazine-condition">
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
              className="pl-8 tabular-nums"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 p-4 sm:p-5">
          <div>
            <h2 className="text-base font-semibold">Shipping</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Magazines ship via Reswell — enter packed dimensions for the rate at checkout.
            </p>
          </div>
          <ReswellPackageDimensionsCard
            showHeading={false}
            lengthIn={form.reswellPackageLengthIn}
            widthIn={form.reswellPackageWidthIn}
            heightIn={form.reswellPackageHeightIn}
            weightLb={form.reswellPackageWeightLb}
            weightOz={form.reswellPackageWeightOz}
            onLengthInChange={(v) => setField("reswellPackageLengthIn", v)}
            onWidthInChange={(v) => setField("reswellPackageWidthIn", v)}
            onHeightInChange={(v) => setField("reswellPackageHeightIn", v)}
            onWeightLbChange={(v) => setField("reswellPackageWeightLb", v)}
            onWeightOzChange={(v) => setField("reswellPackageWeightOz", v)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={submitting || uploadingCount > 0}>
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
  )
}
