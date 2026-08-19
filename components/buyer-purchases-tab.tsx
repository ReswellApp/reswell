"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Package, ChevronRight, Receipt, RotateCcw } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import {
  ORDER_STATUS_LIST,
  orderStatusIsRefunded,
  orderStatusIsRefundInProgress,
} from "@/lib/order-status"
import { resolveSaleCardStatusDisplay } from "@/lib/sale-card-status"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { cn } from "@/lib/utils"
import { REAL_MARKETPLACE_PURCHASES_FILTER } from "@/lib/order-admin-test"
import { LocalDateOnly } from "@/components/ui/local-datetime"
import { canSubmitSellerReview } from "@/lib/services/orderSellerReview"
import {
  ReviewSellerControls,
  type ExistingSellerReview,
} from "@/components/review-seller-controls"

type Row = {
  id: string
  order_num: string | null
  amount: number | string
  status: string
  delivery_status: string
  tracking_number: string | null
  tracking_detail?: unknown
  created_at: string
  fulfillment_method: string | null
  stripe_checkout_session_id: string | null
  seller_id: string
  listings: {
    id: string
    title: string
    listing_images: Array<{
      url: string
      thumbnail_url?: string | null
      is_primary: boolean | null
    }> | null
  } | null
  sellerReview: { canSubmit: boolean; existing: ExistingSellerReview | null } | null
  sellerDisplayName: string
}

function primaryImage(
  images: Array<{
    url: string
    thumbnail_url?: string | null
    is_primary: boolean | null
  }> | null | undefined,
) {
  const s = listingTitleThumbnailSrc(images ?? null)
  return s || null
}

export function BuyerPurchasesTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data, error: qErr } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_num,
        amount,
        status,
        delivery_status,
        tracking_number,
        tracking_detail,
        created_at,
        fulfillment_method,
        stripe_checkout_session_id,
        seller_id,
        listings ( id, title, listing_images ( url, thumbnail_url, is_primary ) )
      `
      )
      .eq("buyer_id", user.id)
      .match(REAL_MARKETPLACE_PURCHASES_FILTER)
      .in("status", [...ORDER_STATUS_LIST])
      .order("created_at", { ascending: false })

    if (qErr) {
      setError(true)
      setRows([])
    } else {
      const base = (data ?? []).map((r) => {
        const raw = r as {
          listings:
            | Row["listings"]
            | NonNullable<Row["listings"]>[]
            | null
        }
        const listing = Array.isArray(raw.listings) ? raw.listings[0] : raw.listings
        return { ...(r as Omit<Row, "listings" | "sellerReview" | "sellerDisplayName">), listings: listing ?? null }
      })

      const sellerIds = [...new Set(base.map((o) => o.seller_id))]
      const { data: sellerProfiles } =
        sellerIds.length > 0
          ? await supabase.from("profiles").select("id, display_name").in("id", sellerIds)
          : { data: [] as { id: string; display_name: string | null }[] }
      const sellerNameById = new Map(
        (sellerProfiles ?? []).map((p) => [p.id, p.display_name?.trim() || ""]),
      )

      const ids = base.map((o) => o.id)
      const { data: revs } =
        ids.length > 0
          ? await supabase
              .from("reviews")
              .select("order_id, id, rating, comment, created_at")
              .in("order_id", ids)
              .eq("reviewer_id", user.id)
          : { data: [] as { order_id: string; id: string; rating: number; comment: string | null; created_at: string }[] }

      const revByOrder = new Map((revs ?? []).map((x) => [x.order_id, x]))

      const normalized: Row[] = base.map((o) => {
        const rev = revByOrder.get(o.id)
        const existing: ExistingSellerReview | null = rev
          ? {
              id: rev.id,
              rating: rev.rating,
              comment: rev.comment,
              created_at: rev.created_at,
            }
          : null
        const canSubmit = !existing && canSubmitSellerReview(o)
        const sellerReview = canSubmit || existing ? { canSubmit, existing } : null
        const rawName = sellerNameById.get(o.seller_id)?.trim()
        const sellerDisplayName =
          rawName && rawName.length > 0 ? rawName : `Seller ${o.seller_id.slice(0, 8)}…`
        return { ...o, sellerReview, sellerDisplayName }
      })

      setRows(normalized)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    // CLS-FIX: skeleton list reserves the same vertical space as the loaded
    // purchase rows, preventing the page from shifting when data arrives.
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
          <div className="h-8 w-28 rounded bg-muted animate-pulse" />
        </div>
        <ul className="space-y-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="h-12 w-12 flex-shrink-0 rounded-md bg-muted animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${50 + i * 12}%` }} />
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-5 rounded bg-muted animate-pulse shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load purchases. If this persists, check marketplace RLS for the{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">orders</code> table in Supabase.
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center space-y-4">
          <Receipt className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm max-w-sm">
            You have not bought anything from other members yet. When you do, it will show here and on
            the full purchases page.
          </p>
          <Button asChild variant="outline">
            <Link href="/gear">Browse gear</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Peer-to-peer buys (surfboards, wallet or card).
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/purchases">Open full page</Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => {
          const title = row.listings?.title
            ? capitalizeWords(row.listings.title)
            : "Item (listing removed)"
          const img = primaryImage(row.listings?.listing_images ?? null)
          const fulfill =
            row.fulfillment_method === "shipping"
              ? "Ship"
              : row.fulfillment_method === "pickup"
                ? "Pickup"
                : "—"

          const sellerRaw = row.sellerReview
          const statusDisplay = resolveSaleCardStatusDisplay({
            orderStatus: row.status,
            deliveryStatus: row.delivery_status ?? "pending",
            trackingNumber: row.tracking_number,
            trackingDetail: parseOrderTrackingDetail(row.tracking_detail),
            fulfillmentMethod: row.fulfillment_method,
          })

          return (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border bg-card overflow-hidden sm:flex-row sm:items-stretch"
            >
              <Link
                href={`/dashboard/purchases/${row.id}`}
                className="flex flex-1 items-center gap-3 p-3 min-w-0 transition-colors hover:bg-muted/40"
              >
                <div className="relative h-12 w-12 flex-shrink-0 rounded-md border bg-muted overflow-hidden">
                  {img ? (
                    <Image src={img} alt="" fill className="object-cover" sizes="48px" unoptimized={listingImageShouldBypassOptimization(img)} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-mono text-muted-foreground">
                      #{formatOrderNumForCustomer(row.order_num, row.id)}
                    </p>
                    <Badge
                      variant={statusDisplay.variant}
                      className={cn("text-[10px] px-1.5 py-0", statusDisplay.className)}
                    >
                      {statusDisplay.label}
                    </Badge>
                  </div>
                  <p className="font-medium text-foreground line-clamp-1">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    <LocalDateOnly iso={row.created_at} dateStyle="medium" /> · $
                    {Number(row.amount).toFixed(2)} · {fulfill}
                  </p>
                  {orderStatusIsRefundInProgress(row.status) && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium flex items-center gap-1 mt-0.5">
                      <RotateCcw className="h-3 w-3" />
                      Refund in progress
                    </p>
                  )}
                  {orderStatusIsRefunded(row.status) && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-0.5">
                      <RotateCcw className="h-3 w-3" />
                      Refund complete
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block" />
              </Link>
              {sellerRaw && (
                <div className="flex items-center border-t sm:border-t-0 sm:border-l sm:max-w-[220px] px-3 py-3 bg-muted/25">
                  <ReviewSellerControls
                    orderId={row.id}
                    sellerName={row.sellerDisplayName}
                    canReview={sellerRaw.canSubmit}
                    existingReview={sellerRaw.existing}
                    compact
                    onSuccess={load}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
