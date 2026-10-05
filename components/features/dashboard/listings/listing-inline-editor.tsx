"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, Eye, Loader2, Package } from "lucide-react"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  updateListingQuickEditAction,
  type ListingQuickEditSaved,
} from "@/lib/actions/listingQuickEdit"
import { listingDetailHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import {
  LISTING_CONDITION_SELL_OPTIONS,
  capitalizeWords,
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
  shopPackageSizeLabel,
  shopPackageSizesForSection,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
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
}

interface ListingInlineEditorProps {
  listing: DeskEditorListing
  appliedPackageSizeId?: ShopPackageSizeId | null
  packageSyncNonce?: number
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
  }
}

function draftsEqual(a: ListingQuickDraft, b: ListingQuickDraft): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    a.description.trim() === b.description.trim() &&
    a.condition === b.condition &&
    a.priceInput.trim() === b.priceInput.trim() &&
    a.packageSizeId === b.packageSizeId
  )
}

function ListingFields({
  listingId,
  section,
  draft,
  disabled,
  onChange,
}: {
  listingId: string
  section: string
  draft: ListingQuickDraft
  disabled: boolean
  onChange: (patch: Partial<ListingQuickDraft>) => void
}) {
  const packageSizes = isPeerListingSection(section) ? shopPackageSizesForSection(section) : []
  const packageValue = draft.packageSizeId || undefined

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${listingId}-title`}>Title</Label>
        <Input
          id={`${listingId}-title`}
          value={draft.title}
          maxLength={LISTING_TITLE_MAX_LENGTH}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${listingId}-price`}>Price</Label>
        <Input
          id={`${listingId}-price`}
          inputMode="decimal"
          value={draft.priceInput}
          disabled={disabled}
          onChange={(event) => onChange({ priceInput: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${listingId}-condition`}>Condition</Label>
        <Select
          value={draft.condition || undefined}
          onValueChange={(condition) => onChange({ condition })}
          disabled={disabled}
        >
          <SelectTrigger id={`${listingId}-condition`} aria-label="Condition">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            {LISTING_CONDITION_SELL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {packageSizes.length > 0 ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${listingId}-package`}>Package size</Label>
          <Select
            value={packageValue}
            onValueChange={(packageSizeId) => onChange({ packageSizeId })}
            disabled={disabled}
          >
            <SelectTrigger id={`${listingId}-package`} aria-label="Package size">
              <SelectValue placeholder="Package size" />
            </SelectTrigger>
            <SelectContent>
              {draft.packageSizeId === "custom" ? (
                <SelectItem value="custom">Custom box</SelectItem>
              ) : null}
              {packageSizes.map((sizeId) => (
                <SelectItem key={sizeId} value={sizeId}>
                  {shopPackageSizeLabel(sizeId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${listingId}-description`}>Description</Label>
        <Textarea
          id={`${listingId}-description`}
          value={draft.description}
          maxLength={LISTING_QUICK_EDIT_DESCRIPTION_MAX}
          rows={3}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>
    </div>
  )
}

export function ListingInlineEditor({
  listing,
  appliedPackageSizeId = null,
  packageSyncNonce = 0,
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

  function updateDraft(patch: Partial<ListingQuickDraft>) {
    setStatus("idle")
    setDraft((current) => ({ ...current, ...patch }))
  }

  const sectionLabel = isPeerListingSection(listing.section)
    ? PEER_LISTING_SECTION_LABELS[listing.section]
    : capitalizeWords(listing.section.replace(/[-_]/g, " "))
  const listedDate = format(new Date(listing.created_at), "MMM d, yyyy")
  const statusLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? error : null

  return (
    <article
      id={`listing-editor-${listing.id}`}
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          className={cn(listingPortraitThumbClass, "w-20 sm:w-[88px]")}
          onClick={() => setQuickViewOpen(true)}
          aria-label={`Quick view ${capitalizeWords(listing.title)}`}
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
              <Package className="h-7 w-7 text-muted-foreground" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground">
              {sectionLabel} · Listed {listedDate} ·{" "}
              {listing.views.toLocaleString()} views
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setQuickViewOpen(true)}>
                <Eye className="h-3.5 w-3.5" />
                Quick view
              </Button>
              {editable ? (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link href={editHref}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Full editor
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          {editable ? (
            <ListingFields
              listingId={listing.id}
              section={listing.section}
              draft={draft}
              disabled={false}
              onChange={updateDraft}
            />
          ) : (
            <div>
              <p className="font-semibold text-foreground">{capitalizeWords(listing.title)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listing.status === "sold"
                  ? "Sold listings stay as they were at checkout."
                  : "This listing can’t be edited from the desk."}
              </p>
            </div>
          )}
          <p
            className={cn(
              "flex min-h-5 items-center gap-1.5 text-[12px]",
              status === "error" ? "text-destructive" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {status === "saving" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            {statusLabel}
          </p>
        </div>
      </div>
      <Sheet open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{capitalizeWords(draft.title || listing.title)}</SheetTitle>
            <SheetDescription>
              {listing.views.toLocaleString()} views · {listing.favoriteCount.toLocaleString()} saves ·{" "}
              {listing.cartCount.toLocaleString()} in carts
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
              {imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={capitalizeWords(listing.title)}
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
              <ListingFields
                listingId={`${listing.id}-quick`}
                section={listing.section}
                draft={draft}
                disabled={false}
                onChange={updateDraft}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{draft.description || "No description yet."}</p>
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
