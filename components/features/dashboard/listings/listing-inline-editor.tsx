"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { Check, ChevronDown, ExternalLink, Eye, Loader2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DeskPriceInput,
  DeskTitleInput,
  ListingEditorDetails,
} from "@/components/features/dashboard/listings/listing-editor-fields"
import { ListingEditorSpecs } from "@/components/features/dashboard/listings/listing-editor-specs"
import {
  updateListingQuickEditAction,
  type ListingQuickEditSaved,
} from "@/lib/actions/listingQuickEdit"
import { listingDetailHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import {
  capitalizeWords,
  formatCondition,
  isListingSellableCondition,
  type ListingSellableCondition,
} from "@/lib/listing-labels"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { canQuickEditListing } from "@/lib/listing-quick-edit-access"
import {
  PEER_LISTING_SECTION_LABELS,
  isPeerListingSection,
  peerListingEditHref,
} from "@/lib/peer-listing-sections"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import {
  inferShopPackageSizeId,
  isShopPackageSizeId,
  shopPackageChipLabel,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import {
  listingDeskSpecFromRow,
  listingDeskSpecsEqual,
  type ListingDeskSpec,
} from "@/lib/listings-desk-fields"
import { LISTING_QUICK_EDIT_DESCRIPTION_MAX } from "@/lib/validations/listing-quick-edit"
import { cn } from "@/lib/utils"
import {
  listingPortraitThumbClass,
  listingPortraitThumbSizes,
} from "@/lib/utils/dashboard-display-styles"

type ListingQuickDraft = {
  title: string
  description: string
  condition: string
  priceInput: string
  packageSizeId: string
  spec: ListingDeskSpec
}

interface DeskEditorListing {
  id: string
  slug: string | null
  title: string
  price: number
  status: string
  section: string
  condition: string | null
  description: string | null
  views: number
  favoriteCount: number
  cartCount: number
  created_at: string
  listing_images: { url: string; thumbnail_url?: string | null; is_primary: boolean | null }[] | null
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
  local_pickup: boolean | null
  shipping_available: boolean | null
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

interface ListingInlineEditorProps {
  listing: DeskEditorListing
  appliedPackageSizeId?: ShopPackageSizeId | null
  packageSyncNonce?: number
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onSaved: (listingId: string, saved: ListingQuickEditSaved) => void
}

function draftFromListing(listing: DeskEditorListing): ListingQuickDraft {
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

function packageChipLabel(packageSizeId: string): string | null {
  if (!packageSizeId) return null
  if (packageSizeId === "custom") return "Custom box"
  if (isShopPackageSizeId(packageSizeId)) return shopPackageChipLabel(packageSizeId)
  return null
}

function deskStatusLabel(status: string): string | null {
  if (status === "active") return null
  if (status === "draft") return "Draft"
  if (status === "sold") return "Sold"
  if (status === "pending_sale") return "Pending sale"
  if (status === "pending") return "Pending"
  if (status === "delinquent") return "Delinquent"
  return capitalizeWords(status.replace(/[_-]/g, " "))
}

export function ListingInlineEditor({
  listing,
  appliedPackageSizeId = null,
  packageSyncNonce = 0,
  expanded = false,
  onExpandedChange,
  onSaved,
}: ListingInlineEditorProps) {
  const editable = canQuickEditListing(listing.status)
  const [draft, setDraft] = useState(() => draftFromListing(listing))
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const savedRef = useRef(draft)
  const requestRef = useRef(0)
  const imageSrc = listingCardImageSrc(listing.listing_images ?? null) || null
  const editHref = peerListingEditHref(listing.section, listing.id)
  const viewHref =
    listing.status === "draft" ? editHref : listingDetailHref(listing)

  useEffect(() => {
    if (!appliedPackageSizeId || packageSyncNonce === 0) return
    setDraft((current) => ({ ...current, packageSizeId: appliedPackageSizeId }))
    savedRef.current = { ...savedRef.current, packageSizeId: appliedPackageSizeId }
  }, [appliedPackageSizeId, packageSyncNonce])

  useEffect(() => {
    if (window.location.hash !== `#listing-editor-${listing.id}`) return
    onExpandedChange?.(true)
  }, [listing.id, onExpandedChange])

  useEffect(() => {
    if (!editable) return
    if (draftsEqual(draft, savedRef.current)) return
    const snapshot = draft
    const handle = window.setTimeout(() => {
      void persist(snapshot)
    }, 700)
    return () => window.clearTimeout(handle)
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
    if (snapshot.condition && snapshot.condition !== saved.condition && isListingSellableCondition(snapshot.condition)) {
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

  function updateDraft(patch: Partial<Omit<ListingQuickDraft, "spec">> & { spec?: Partial<ListingDeskSpec> }) {
    setStatus("idle")
    setDraft((current) => ({
      ...current,
      ...patch,
      spec: patch.spec ? { ...current.spec, ...patch.spec } : current.spec,
    }))
  }

  const sectionLabel = isPeerListingSection(listing.section)
    ? PEER_LISTING_SECTION_LABELS[listing.section]
    : capitalizeWords(listing.section.replace(/[-_]/g, " "))
  const listedDate = format(new Date(listing.created_at), "MMM d, yyyy")
  const conditionLabel = formatCondition(draft.condition)
  const boxLabel = packageChipLabel(draft.packageSizeId)
  const statusPill = deskStatusLabel(listing.status)
  const facts = [sectionLabel, listedDate, `${listing.views.toLocaleString()} views`, conditionLabel, boxLabel]
    .filter((fact): fact is string => Boolean(fact))
    .join(" · ")
  const displayTitle = capitalizeWords(draft.title || listing.title)
  const detailsId = `listing-editor-details-${listing.id}`

  return (
    <article id={`listing-editor-${listing.id}`} className="scroll-mt-24 px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <button
          type="button"
          className={listingPortraitThumbClass}
          onClick={() => setQuickViewOpen(true)}
          aria-label={`Quick view ${displayTitle}`}
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover object-center"
              sizes={listingPortraitThumbSizes}
              unoptimized={listingImageShouldBypassOptimization(imageSrc)}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            {editable ? (
              <DeskTitleInput
                id={`${listing.id}-title`}
                value={draft.title}
                onChange={(title) => updateDraft({ title })}
                className="min-w-0 flex-1"
              />
            ) : (
              <p className="px-2 py-1 text-[16px] font-semibold tracking-tight text-foreground">
                {displayTitle}
              </p>
            )}
            <div className="flex items-center gap-2 sm:pt-0.5">
              {editable ? (
                <DeskPriceInput
                  id={`${listing.id}-price`}
                  value={draft.priceInput}
                  onChange={(priceInput) => updateDraft({ priceInput })}
                />
              ) : (
                <p className="px-1 text-sm font-semibold tabular-nums text-foreground">
                  ${Number(listing.price).toLocaleString()}
                </p>
              )}
              <SaveState status={status} />
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-2">
            {statusPill ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {statusPill}
              </span>
            ) : null}
            <p className="text-[12px] leading-5 text-muted-foreground">{facts}</p>
          </div>
          {!editable ? (
            <p className="mt-1 px-2 text-[12px] text-muted-foreground">
              {listing.status === "sold"
                ? "Sold listings stay as they were at checkout."
                : "This listing can’t be edited from the desk."}
            </p>
          ) : null}
          {status === "error" && error ? (
            <p className="mt-1 px-2 text-[13px] text-destructive" aria-live="polite">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-1 px-1">
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 rounded-full px-3 text-[13px]"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => onExpandedChange?.(!expanded)}
              >
                {expanded ? "Hide details" : "Details"}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label={`Quick view ${displayTitle}`}
              onClick={() => setQuickViewOpen(true)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {editable ? (
              <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <Link href={editHref} aria-label={`Open full editor for ${displayTitle}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
          {editable && expanded ? (
        <div
          id={detailsId}
          className="mt-4 space-y-5 border-t border-border/60 pt-4 sm:ml-[calc(72px+1rem)] lg:ml-[calc(88px+1rem)]"
        >
          <ListingEditorSpecs
            listingId={listing.id}
            section={listing.section}
            spec={draft.spec}
            images={listing.listing_images}
            editHref={editHref}
            disabled={false}
            onChange={(spec) => updateDraft({ spec })}
          />
          <ListingEditorDetails
            listingId={listing.id}
            section={listing.section}
            description={draft.description}
            condition={draft.condition}
            packageSizeId={draft.packageSizeId}
            disabled={false}
            onChange={updateDraft}
          />
        </div>
      ) : null}
      <Sheet open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Quick edit</SheetTitle>
            <SheetDescription>
              {listing.views.toLocaleString()} views · {listing.favoriteCount.toLocaleString()} saves ·{" "}
              {listing.cartCount.toLocaleString()} in carts
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
              {imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={displayTitle}
                  fill
                  className="object-cover"
                  sizes="400px"
                  unoptimized={listingImageShouldBypassOptimization(imageSrc)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
            </div>
            {editable ? (
              <>
                <DeskTitleInput
                  id={`${listing.id}-quick-title`}
                  value={draft.title}
                  onChange={(title) => updateDraft({ title })}
                />
                <DeskPriceInput
                  id={`${listing.id}-quick-price`}
                  value={draft.priceInput}
                  onChange={(priceInput) => updateDraft({ priceInput })}
                />
                <ListingEditorSpecs
                  listingId={`${listing.id}-quick`}
                  section={listing.section}
                  spec={draft.spec}
                  images={listing.listing_images}
                  editHref={editHref}
                  disabled={false}
                  onChange={(spec) => updateDraft({ spec })}
                />
                <ListingEditorDetails
                  listingId={`${listing.id}-quick`}
                  section={listing.section}
                  description={draft.description}
                  condition={draft.condition}
                  packageSizeId={draft.packageSizeId}
                  disabled={false}
                  onChange={updateDraft}
                />
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {draft.description || "No description yet."}
              </p>
            )}
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link href={viewHref}>Open listing</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </article>
  )
}

function SaveState({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle" || status === "error") return <span className="hidden w-[4.5rem] shrink-0 sm:inline-flex" aria-hidden />
  return (
    <span
      className="inline-flex min-w-[4.5rem] shrink-0 items-center justify-end gap-1 text-[12px] font-medium text-muted-foreground"
      aria-live="polite"
    >
      {status === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
      {status === "saving" ? "Saving" : "Saved"}
    </span>
  )
}
