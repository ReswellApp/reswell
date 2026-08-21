"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ImageOff, Loader2, Package, Plus, Truck, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { capitalizeWords } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import {
  offerShippingAmountFromListing,
  offerShippingCostHint,
  offerShippingCostLabel,
} from "@/lib/offer-listing-shipping"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function parseAmountInput(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return roundMoney(n)
}

type SellerListingRow = {
  id: string
  title: string | null
  section: string | null
  price: number
  minimum_offer_pct: number | null
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: number | null
  board_shipping_cost_mode: "reswell" | "flat" | "free" | null
  listing_images: ListingImageForCard[] | null
}

const SELLER_OFFER_LISTING_SELECT =
  "id, title, section, price, minimum_offer_pct, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode, hidden_from_site, buyer_offers_enabled, listing_images(url, thumbnail_url, is_primary)"

function fallbackSellerListingRow({
  listingId,
  listingTitle,
  listPrice,
  primaryImageUrl,
}: {
  listingId: string
  listingTitle?: string
  listPrice?: number
  primaryImageUrl?: string | null
}): SellerListingRow | null {
  if (listPrice == null || listPrice <= 0) return null
  return {
    id: listingId,
    title: listingTitle?.trim() || "Listing",
    section: null,
    price: roundMoney(listPrice),
    minimum_offer_pct: null,
    shipping_available: null,
    local_pickup: true,
    shipping_price: null,
    board_shipping_cost_mode: null,
    listing_images: primaryImageUrl ? [{ url: primaryImageUrl, is_primary: true }] : null,
  }
}

function mapSellerListingRow(row: Record<string, unknown>): SellerListingRow {
  return {
    id: row.id as string,
    title: (row.title as string | null) ?? null,
    section: (row.section as string | null) ?? null,
    price: roundMoney(parseFloat(String(row.price ?? 0))),
    minimum_offer_pct: (row.minimum_offer_pct as number | null) ?? null,
    shipping_available: row.shipping_available as boolean | null,
    local_pickup: row.local_pickup as boolean | null,
    shipping_price:
      row.shipping_price != null ? roundMoney(parseFloat(String(row.shipping_price))) : null,
    board_shipping_cost_mode:
      (row.board_shipping_cost_mode as SellerListingRow["board_shipping_cost_mode"]) ?? null,
    listing_images: (row.listing_images as ListingImageForCard[] | null) ?? null,
  }
}

function ListingThumb({
  src,
  size = "md",
}: {
  src: string | null
  size?: "sm" | "md"
}) {
  const dim = size === "sm" ? "h-11 w-11" : "h-14 w-14"
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/30",
        dim,
      )}
    >
      {src ? (
        <Image
          src={proxiedListingImageSrc(src) || src}
          alt=""
          fill
          className="object-cover"
          sizes={size === "sm" ? "44px" : "56px"}
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
        </div>
      )}
    </div>
  )
}

function SelectedOfferListingCard({
  row,
  isAnchor,
  amountInput,
  onAmountChange,
  onRemove,
}: {
  row: SellerListingRow
  isAnchor: boolean
  amountInput: string
  onAmountChange: (value: string) => void
  onRemove?: () => void
}) {
  const parsed = parseAmountInput(amountInput)
  const amountInvalid = amountInput.trim() !== "" && (parsed === null || parsed > row.price)
  const thumb = listingTitleThumbnailSrc(row.listing_images)
  const title = capitalizeWords((row.title ?? "Listing").trim() || "Listing")

  return (
    <li className="rounded-xl border border-listingHeart/35 bg-listingHeart/[0.04] p-3.5 shadow-sm">
      <div className="flex gap-3">
        <ListingThumb src={thumb} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                {title}
              </p>
              {isAnchor ? (
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  This thread
                </p>
              ) : null}
            </div>
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${title} from offer`}
                onClick={onRemove}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                List price
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-foreground">
                ${row.price.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background px-3 py-2">
              <Label
                htmlFor={`offer-amount-${row.id}`}
                className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Your offer
              </Label>
              <div className="relative mt-0.5">
                <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
                  $
                </span>
                <Input
                  id={`offer-amount-${row.id}`}
                  className={cn(
                    "h-8 border-0 bg-transparent p-0 pl-4 text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0",
                    amountInvalid ? "text-destructive" : "",
                  )}
                  placeholder="0.00"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => onAmountChange(e.target.value)}
                  aria-invalid={amountInvalid}
                />
              </div>
            </div>
          </div>

          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
            Offer any amount up to ${row.price.toFixed(2)}
          </p>
        </div>
      </div>
    </li>
  )
}

function AvailableListingPickerRow({
  row,
  onAdd,
}: {
  row: SellerListingRow
  onAdd: () => void
}) {
  const thumb = listingTitleThumbnailSrc(row.listing_images)
  const title = capitalizeWords((row.title ?? "Listing").trim() || "Listing")

  return (
    <li>
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:border-listingHeart/40 hover:bg-listingHeart/[0.03]"
      >
        <ListingThumb src={thumb} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug text-foreground">{title}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            List ${row.price.toFixed(2)}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-foreground">
          <Plus className="h-3 w-3" aria-hidden />
          Add
        </span>
      </button>
    </li>
  )
}

export type SellerMakeOfferToBuyerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  listingId: string
  buyerUserId: string
  sellerUserId: string
  /** When set, stay on thread after send instead of navigating away. */
  conversationId?: string | null
  listingTitle?: string
  listPrice?: number
  primaryImageUrl?: string | null
  /** Form only — parent already provides the dialog shell. */
  embedded?: boolean
  onOfferSent?: (payload: {
    listingId: string
    buyerUserId: string
    offerId: string
    conversationId: string | null
  }) => void
}

export function SellerMakeOfferToBuyerDialog({
  open,
  onOpenChange,
  listingId,
  buyerUserId,
  sellerUserId,
  conversationId,
  listingTitle,
  listPrice,
  primaryImageUrl,
  embedded = false,
  onOfferSent,
}: SellerMakeOfferToBuyerDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  const [listings, setListings] = useState<SellerListingRow[]>(() => {
    const fallback = fallbackSellerListingRow({
      listingId,
      listingTitle,
      listPrice,
      primaryImageUrl,
    })
    return fallback ? [fallback] : []
  })
  const [loadingListings, setLoadingListings] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set([listingId]))
  /** Selected listing order — thread listing pinned first; newly added appear next. */
  const [selectedOrder, setSelectedOrder] = useState<string[]>([listingId])
  const [amountByListingId, setAmountByListingId] = useState<Record<string, string>>({})
  const [fulfillment, setFulfillment] = useState<"pickup" | "shipping">("pickup")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadSellerListings = useCallback(async () => {
    setLoadingListings(true)
    try {
      const [listRes, anchorRes] = await Promise.all([
        supabase
          .from("listings")
          .select(SELLER_OFFER_LISTING_SELECT)
          .eq("user_id", sellerUserId)
          .in("section", PEER_LISTING_SECTIONS_FILTER)
          .in("status", ["active", "pending_sale"])
          .order("created_at", { ascending: false }),
        supabase
          .from("listings")
          .select(SELLER_OFFER_LISTING_SELECT)
          .eq("id", listingId)
          .eq("user_id", sellerUserId)
          .maybeSingle(),
      ])

      if (listRes.error) {
        toast.error("Could not load your listings.")
        return
      }

      const byId = new Map<string, SellerListingRow>()
      for (const row of listRes.data ?? []) {
        const record = row as Record<string, unknown>
        if (record.hidden_from_site === true) continue
        if (record.buyer_offers_enabled === false && record.id !== listingId) continue
        byId.set(record.id as string, mapSellerListingRow(record))
      }

      if (anchorRes.data && !anchorRes.error) {
        const record = anchorRes.data as Record<string, unknown>
        if (record.hidden_from_site !== true) {
          byId.set(record.id as string, mapSellerListingRow(record))
        }
      }

      if (!byId.has(listingId)) {
        const fallback = fallbackSellerListingRow({
          listingId,
          listingTitle,
          listPrice,
          primaryImageUrl,
        })
        if (fallback) byId.set(listingId, fallback)
      }

      setListings([...byId.values()])
    } finally {
      setLoadingListings(false)
    }
  }, [supabase, sellerUserId, listingId, listingTitle, listPrice, primaryImageUrl])

  useEffect(() => {
    if (!open) return
    setSelectedIds(new Set([listingId]))
    setSelectedOrder([listingId])
    setAmountByListingId({})
    setFulfillment("pickup")
    setMessage("")
    setSubmitting(false)
    void loadSellerListings()
  }, [open, listingId, loadSellerListings])

  const orderedSelectedListings = useMemo(() => {
    const byId = new Map(listings.map((row) => [row.id, row]))
    const seen = new Set<string>()
    const ordered: SellerListingRow[] = []

    for (const id of selectedOrder) {
      if (!selectedIds.has(id) || seen.has(id)) continue
      const row = byId.get(id)
      if (row) {
        ordered.push(row)
        seen.add(id)
      }
    }

    for (const id of selectedIds) {
      if (seen.has(id)) continue
      const row = byId.get(id)
      if (row) ordered.push(row)
    }

    return ordered
  }, [listings, selectedIds, selectedOrder])

  const unselectedListings = useMemo(
    () => listings.filter((row) => !selectedIds.has(row.id)),
    [listings, selectedIds],
  )

  const isBundle = orderedSelectedListings.length > 1
  const singleListing = orderedSelectedListings.length === 1 ? orderedSelectedListings[0] : null
  const shippingMode =
    singleListing && !isBundle ? effectiveBoardShippingMode(singleListing) : null
  const listingFlatRate =
    singleListing != null
      ? Math.max(0, Number(singleListing.shipping_price ?? 0) || 0)
      : 0

  const bundleFulfillmentMode = useMemo(() => {
    if (orderedSelectedListings.length === 0) return "pickup_only" as const
    const allPickup = orderedSelectedListings.every((row) => row.local_pickup !== false)
    const allShip = orderedSelectedListings.every((row) => !!row.shipping_available)
    if (allPickup && allShip && orderedSelectedListings.length === 1) {
      return "pickup_and_shipping" as const
    }
    if (allPickup) return "pickup_only" as const
    if (allShip && orderedSelectedListings.length === 1) return "shipping_only" as const
    return "pickup_only" as const
  }, [orderedSelectedListings])

  useEffect(() => {
    if (isBundle) {
      setFulfillment("pickup")
      return
    }
    if (bundleFulfillmentMode === "shipping_only") setFulfillment("shipping")
    if (bundleFulfillmentMode === "pickup_only") setFulfillment("pickup")
  }, [isBundle, bundleFulfillmentMode])

  const lineItems = useMemo(() => {
    return orderedSelectedListings.map((row) => ({
      listingId: row.id,
      amount: parseAmountInput(amountByListingId[row.id] ?? ""),
      listPrice: row.price,
      title: row.title,
    }))
  }, [orderedSelectedListings, amountByListingId])

  const allAmountsValid = lineItems.every(
    (row) => row.amount !== null && row.amount <= row.listPrice,
  )

  const itemsSubtotal = useMemo(() => {
    if (!allAmountsValid) return null
    return roundMoney(lineItems.reduce((sum, row) => sum + (row.amount ?? 0), 0))
  }, [allAmountsValid, lineItems])

  const listSubtotal = useMemo(
    () => roundMoney(orderedSelectedListings.reduce((sum, row) => sum + row.price, 0)),
    [orderedSelectedListings],
  )

  /** Sum of entered offer amounts — updates live as the seller types. */
  const offerSubtotalLive = useMemo(() => {
    let sum = 0
    let any = false
    for (const row of lineItems) {
      if (row.amount !== null) {
        sum += row.amount
        any = true
      }
    }
    return any ? roundMoney(sum) : null
  }, [lineItems])

  const allOfferAmountsEntered =
    lineItems.length > 0 && lineItems.every((row) => row.amount !== null)

  const offerSavings =
    offerSubtotalLive != null && allOfferAmountsEntered && listSubtotal > offerSubtotalLive
      ? roundMoney(listSubtotal - offerSubtotalLive)
      : null

  const shippingAmount = useMemo(() => {
    if (fulfillment !== "shipping" || !singleListing) return null
    return offerShippingAmountFromListing(singleListing, fulfillment)
  }, [fulfillment, singleListing])

  const shippingLabel =
    fulfillment === "shipping"
      ? offerShippingCostLabel(shippingMode, listingFlatRate)
      : "Local pickup"

  const totalPreview =
    itemsSubtotal != null
      ? shippingAmount != null
        ? roundMoney(itemsSubtotal + shippingAmount)
        : itemsSubtotal
      : null

  function addListing(id: string) {
    if (selectedIds.has(id)) return
    setSelectedIds((prev) => new Set([...prev, id]))
    setSelectedOrder((prev) => [id, ...prev.filter((rowId) => rowId !== id)])
  }

  function removeListing(id: string) {
    if (id === listingId) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setSelectedOrder((prev) => prev.filter((rowId) => rowId !== id))
    setAmountByListingId((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allAmountsValid || orderedSelectedListings.length === 0) {
      toast.error("Check each item price and fulfillment option.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/listings/${listingId}/seller-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerUserId,
          fulfillment,
          lineItems: lineItems.map((row) => ({
            listingId: row.listingId,
            amount: row.amount,
          })),
          message: message.trim() || undefined,
        }),
      })
      const json: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Could not send your offer."
        toast.error(err)
        return
      }

      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: { offerId?: string; conversationId?: string | null } }).data
          : undefined
      const offerId = data?.offerId ?? null
      const returnedConversationId = data?.conversationId ?? null

      if (offerId) {
        onOfferSent?.({
          listingId,
          buyerUserId,
          offerId,
          conversationId: returnedConversationId,
        })
      }

      onOpenChange(false)
      toast.success("Offer sent.")

      if (conversationId) {
        router.refresh()
      } else if (returnedConversationId) {
        router.push(`/messages/${returnedConversationId}`)
      } else {
        router.push("/messages/offers")
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const canPick =
    orderedSelectedListings.length === 0 ||
    orderedSelectedListings.every((r) => r.local_pickup !== false)
  const canShip =
    !isBundle && orderedSelectedListings.length === 1 && !!orderedSelectedListings[0]?.shipping_available

  const form = (
    <>
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 sm:px-6">
          <DialogTitle className="text-left text-xl font-semibold">Make them an offer</DialogTitle>
          <p className="text-left text-[15px] leading-snug text-muted-foreground">
            Set your price for each listing. Add more listings to bundle into one offer.
          </p>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                In this offer ({orderedSelectedListings.length})
              </Label>

              {orderedSelectedListings.length > 0 && !loadingListings ? (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        List total
                      </p>
                      <p className="mt-0.5 text-xl font-semibold tabular-nums leading-none text-muted-foreground">
                        ${listSubtotal.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Your offer
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-xl font-semibold tabular-nums leading-none",
                          offerSubtotalLive != null ? "text-foreground" : "text-muted-foreground/50",
                        )}
                      >
                        {offerSubtotalLive != null ? `$${offerSubtotalLive.toFixed(2)}` : "—"}
                      </p>
                    </div>
                  </div>
                  {offerSubtotalLive != null && allOfferAmountsEntered && offerSavings != null && offerSavings > 0 ? (
                    <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
                      ${offerSavings.toFixed(2)} below list
                    </p>
                  ) : offerSubtotalLive != null && !allOfferAmountsEntered ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Enter a price for each listing to complete your offer.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {orderedSelectedListings.length === 0 && loadingListings ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading your listings…
                </div>
              ) : orderedSelectedListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No listings selected.</p>
              ) : (
                <ul className="space-y-2.5">
                  {orderedSelectedListings.map((row) => (
                    <SelectedOfferListingCard
                      key={row.id}
                      row={row}
                      isAnchor={row.id === listingId}
                      amountInput={amountByListingId[row.id] ?? ""}
                      onAmountChange={(value) =>
                        setAmountByListingId((prev) => ({ ...prev, [row.id]: value }))
                      }
                      onRemove={row.id === listingId ? undefined : () => removeListing(row.id)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {!loadingListings && unselectedListings.length > 0 ? (
              <div className="space-y-2 border-t border-border/50 pt-4">
                <Label className="text-sm font-semibold">Add another listing</Label>
                <p className="text-xs text-muted-foreground">
                  Tap a listing to include it — it moves to the top section above.
                </p>
                <ul className="space-y-2">
                  {unselectedListings.map((row) => (
                    <AvailableListingPickerRow key={row.id} row={row} onAdd={() => addListing(row.id)} />
                  ))}
                </ul>
              </div>
            ) : null}

            {!loadingListings && listings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No eligible listings found.</p>
            ) : null}

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-sm font-semibold">Fulfillment</Label>
              {isBundle ? (
                <p className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 shrink-0" aria-hidden />
                  Bundled offers use local pickup for all items.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canPick}
                    onClick={() => setFulfillment("pickup")}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      fulfillment === "pickup"
                        ? "border-listingHeart bg-listingHeart/[0.06] text-foreground"
                        : "border-border/60 bg-card text-muted-foreground hover:bg-muted/30",
                      !canPick && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Package className="h-4 w-4" aria-hidden />
                    <span className="font-medium text-foreground">Local pickup</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canShip}
                    onClick={() => setFulfillment("shipping")}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      fulfillment === "shipping"
                        ? "border-listingHeart bg-listingHeart/[0.06] text-foreground"
                        : "border-border/60 bg-card text-muted-foreground hover:bg-muted/30",
                      !canShip && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Truck className="h-4 w-4" aria-hidden />
                    <span className="font-medium text-foreground">Ship to me</span>
                  </button>
                </div>
              )}
            </div>

            {fulfillment === "shipping" && !isBundle && singleListing ? (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Shipping from listing</Label>
                <p className="text-sm font-medium tabular-nums">{shippingLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {offerShippingCostHint(shippingMode, listingFlatRate)}
                </p>
              </div>
            ) : null}

            {totalPreview != null ? (
              <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Offer total
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight">
                    ${totalPreview.toFixed(2)}
                  </p>
                  {itemsSubtotal != null && listSubtotal > itemsSubtotal ? (
                    <p className="text-sm tabular-nums text-muted-foreground line-through">
                      List ${listSubtotal.toFixed(2)}
                    </p>
                  ) : null}
                </div>
                {fulfillment === "shipping" && itemsSubtotal != null ? (
                  shippingAmount != null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ${itemsSubtotal.toFixed(2)} items + ${shippingAmount.toFixed(2)} shipping
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ${itemsSubtotal.toFixed(2)} items + shipping at checkout
                    </p>
                  )
                ) : isBundle && itemsSubtotal != null ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ${itemsSubtotal.toFixed(2)} for {orderedSelectedListings.length} items (list $
                    {listSubtotal.toFixed(2)})
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Message</Label>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Optional
                </span>
              </div>
              <Textarea
                rows={3}
                maxLength={200}
                placeholder="e.g. Happy to meet locally this weekend, or bundle both items."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                loadingListings ||
                orderedSelectedListings.length === 0 ||
                !allAmountsValid
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send offer"
              )}
            </Button>
          </DialogFooter>
        </form>
    </>
  )

  if (embedded) return form

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,720px)] w-[calc(100%-1.5rem)] max-w-lg flex-col overflow-hidden p-0"
      >
        {form}
      </DialogContent>
    </Dialog>
  )
}
