import Link from "next/link"
import Image from "next/image"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PackageCheck, Package, Truck, MapPin, RotateCcw } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import {
  ORDER_STATUS_LIST,
  orderStatusIsRefunded,
  orderStatusIsRefundInProgress,
} from "@/lib/order-status"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { fetchOrderIdsWithPreparedShippingLabels } from "@/lib/db/orderShippingLabels"
import { resolveSaleCardStatusDisplay } from "@/lib/sale-card-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { OrdersListRealtimeRefresh } from "@/components/order-realtime-refresh"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { resolveMarketplaceOrderBuyerLabel } from "@/lib/order-buyer-display"
import { resolveSellerOrderDisplayAmounts } from "@/lib/seller-order-display-amounts"
import { listingPortraitThumbClass, listingPortraitThumbSizes } from "@/lib/utils/dashboard-display-styles"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Sales — Reswell",
  description: "Sales you're fulfilling on Reswell: ship, add tracking, and confirm pickup.",
  path: "/dashboard/sales",
})

type ShippingAddressJson = {
  name?: string | null
  phone?: string | null
  email?: string | null
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
} | null

type SaleRow = {
  id: string
  order_num: string | null
  amount: number | string
  shipping_amount?: number | string | null
  platform_fee?: number | string | null
  seller_earnings: number | string
  promo_discount_usd?: number | string | null
  status: string
  delivery_status: string
  tracking_number: string | null
  created_at: string
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  buyer_id: string | null
  listing_id: string
  stripe_checkout_session_id: string | null
  listings:
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        listing_images: Array<{
          url: string
          thumbnail_url?: string | null
          is_primary: boolean | null
        }> | null
      }
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        listing_images: Array<{
          url: string
          thumbnail_url?: string | null
          is_primary: boolean | null
        }> | null
      }[]
    | null
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

function formatAddress(addr: NonNullable<ShippingAddressJson>["address"]) {
  if (!addr) return null
  const parts = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ].filter((p) => p && String(p).trim())
  return parts.length ? parts.join("\n") : null
}

function fulfillmentLabel(method: string | null, hasShipAddr: boolean): string {
  if (method === "shipping" || hasShipAddr) return "Ship to buyer"
  if (method === "pickup") return "Local pickup"
  return hasShipAddr ? "Ship to buyer" : "Local pickup"
}

export default async function SalesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: sales, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      shipping_amount,
      platform_fee,
      seller_earnings,
      promo_discount_usd,
      status,
      delivery_status,
      tracking_number,
      created_at,
      shipping_address,
      fulfillment_method,
      buyer_id,
      listing_id,
      stripe_checkout_session_id,
      listings (
        id,
        title,
        slug,
        section,
        listing_images ( url, thumbnail_url, is_primary )
      )
    `
    )
    .eq("seller_id", user.id)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[dashboard/sales] orders query failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      timestamp: new Date().toISOString(),
    })
  }

  const list = (sales ?? []) as unknown as SaleRow[]

  const preparedLabelOrderIds = await fetchOrderIdsWithPreparedShippingLabels(
    supabase,
    list.map((s) => s.id),
  )

  const trackingOrderIds = list.filter((s) => s.tracking_number?.trim()).map((s) => s.id)
  const trackingDetailByOrderId = new Map<string, ReturnType<typeof parseOrderTrackingDetail>>()
  if (trackingOrderIds.length > 0) {
    const { data: trackingRows } = await supabase
      .from("orders")
      .select("id, tracking_detail")
      .in("id", trackingOrderIds)
      .eq("seller_id", user.id)

    for (const row of trackingRows ?? []) {
      const detail = parseOrderTrackingDetail(
        (row as { tracking_detail?: unknown }).tracking_detail,
      )
      if (detail) {
        trackingDetailByOrderId.set((row as { id: string }).id, detail)
      }
    }
  }

  const buyerIds = [...new Set(list.map((s) => s.buyer_id).filter(Boolean))]
  const { data: buyerProfiles } =
    buyerIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", buyerIds)
      : { data: [] as { id: string; display_name: string | null }[] }

  const buyerNameById = new Map(
    (buyerProfiles ?? []).map((p) => [p.id, p.display_name?.trim() || ""]),
  )

  return (
    <div className="space-y-6">
      <OrdersListRealtimeRefresh role="seller" />
      <DashboardPageHeader
        title="Sales"
        description="Card and wallet purchases of your listings. Shipping addresses appear here when the buyer paid with a card and chose delivery."
      />

      {error && (
        <div className="space-y-1 text-sm text-destructive">
          <p>Could not load sales. Please try again, or contact support if this persists.</p>
          <p className="text-xs text-muted-foreground">
            Error {error.code ? `${error.code}: ` : ""}
            {error.message}
            {error.hint ? ` — ${error.hint}` : ""}
          </p>
        </div>
      )}

      {!error && list.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PackageCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 max-w-sm">
              When someone buys your gear, the sale shows up here with fulfillment details.
            </p>
            <Button asChild>
              <Link href="/sell?new=1">Create a listing</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {list.map((sale) => {
          const listing = Array.isArray(sale.listings) ? sale.listings[0] : sale.listings
          const title = listing?.title
            ? capitalizeWords(listing.title)
            : "Item (listing removed)"
          const img = primaryImage(listing?.listing_images ?? null)
          const ship = sale.shipping_address
          const addrBlock = ship?.address ? formatAddress(ship.address) : null
          const buyerDisplay = sale.buyer_id ? buyerNameById.get(sale.buyer_id)?.trim() : ""
          const buyerName = resolveMarketplaceOrderBuyerLabel({
            buyerId: sale.buyer_id,
            profileDisplayName: buyerDisplay,
            shippingAddress: ship,
          })
          const fulfill = fulfillmentLabel(sale.fulfillment_method, !!addrBlock)
          const statusDisplay = resolveSaleCardStatusDisplay({
            orderStatus: sale.status,
            deliveryStatus: sale.delivery_status ?? "pending",
            trackingNumber: sale.tracking_number,
            trackingDetail: trackingDetailByOrderId.get(sale.id) ?? null,
            hasPreparedShippingLabel: preparedLabelOrderIds.has(sale.id),
          })
          const amounts = resolveSellerOrderDisplayAmounts(sale)

          return (
            <Link
              key={sale.id}
              href={`/dashboard/sales/${sale.id}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card
                className={`h-full transition-colors ${
                  orderStatusIsRefunded(sale.status)
                    ? "border-destructive/20 bg-destructive/[0.02]"
                    : orderStatusIsRefundInProgress(sale.status)
                      ? "border-amber-500/25 bg-amber-500/[0.03]"
                      : "hover:bg-muted/40 hover:border-primary/25"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PackageCheck className="h-5 w-5 text-muted-foreground" />
                        Sale #{formatOrderNumForCustomer(sale.order_num, sale.id)}
                      </CardTitle>
                      <CardDescription>
                        <LocalDateTime iso={sale.created_at} dateStyle="medium" timeStyle="short" />
                      </CardDescription>
                    </div>
                    <Badge variant={statusDisplay.variant} className={statusDisplay.className}>
                      {statusDisplay.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1 font-normal">
                      {fulfill.includes("Ship") ? (
                        <Truck className="h-3.5 w-3.5" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5" />
                      )}
                      {fulfill}
                    </Badge>
                  </div>

                  <div className="flex gap-3">
                    <div className={listingPortraitThumbClass}>
                      {img ? (
                        <Image src={img} alt="" fill className="object-cover" sizes={listingPortraitThumbSizes} unoptimized={listingImageShouldBypassOptimization(img)} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-semibold text-foreground">{title}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">Buyer: {buyerName}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Tap for sale details, shipping address, and messages
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Sale total</span>
                      <span
                        className={`tabular-nums ${orderStatusIsRefunded(sale.status) ? "line-through" : ""}`}
                      >
                        ${amounts.sellerSaleTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-foreground pt-1">
                      <span>
                        {orderStatusIsRefunded(sale.status)
                          ? "Earnings (reversed)"
                          : orderStatusIsRefundInProgress(sale.status)
                            ? "Your earnings (pending reversal)"
                            : "Your earnings"}
                      </span>
                      <span
                        className={`tabular-nums ${
                          orderStatusIsRefunded(sale.status)
                            ? "line-through text-muted-foreground"
                            : orderStatusIsRefundInProgress(sale.status)
                              ? "text-muted-foreground"
                              : ""
                        }`}
                      >
                        ${amounts.sellerEarningsAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {orderStatusIsRefundInProgress(sale.status) && (
                    <div className="rounded-lg bg-amber-500/[0.08] border border-amber-500/25 p-2.5 flex items-center gap-2 text-sm">
                      <RotateCcw className="h-3.5 w-3.5 text-amber-800 dark:text-amber-200 shrink-0" />
                      <span className="text-amber-950 dark:text-amber-100 font-medium">
                        Refund in progress — ${amounts.buyerPaidTotal.toFixed(2)} returning to buyer via Stripe
                      </span>
                    </div>
                  )}

                  {orderStatusIsRefunded(sale.status) && (
                    <div className="rounded-lg bg-destructive/5 border border-destructive/15 p-2.5 flex items-center gap-2 text-sm">
                      <RotateCcw className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-destructive font-medium">
                        Refund complete — ${amounts.buyerPaidTotal.toFixed(2)} returned to buyer
                      </span>
                    </div>
                  )}

                  {addrBlock && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="font-medium text-foreground mb-1">Ship to</p>
                      {ship?.name && <p className="text-foreground">{ship.name}</p>}
                      <p className="text-muted-foreground whitespace-pre-line line-clamp-3">
                        {addrBlock}
                      </p>
                      {(ship?.phone || ship?.email) && (
                        <p className="text-xs text-muted-foreground mt-1">Open sale for full details</p>
                      )}
                    </div>
                  )}

                  {!addrBlock && sale.fulfillment_method === "pickup" && (
                    <p className="text-sm text-muted-foreground">
                      Local pickup — open this sale to message the buyer and confirm details.
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
