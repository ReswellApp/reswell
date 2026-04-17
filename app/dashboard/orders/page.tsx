import Link from "next/link"
import Image from "next/image"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Receipt, Package, Truck, MapPin, RotateCcw } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import {
  ORDER_STATUS_LIST,
  orderStatusBadgeVariant,
  orderStatusIsRefunded,
  orderStatusIsRefundInProgress,
  orderStatusLabel,
} from "@/lib/order-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { LocalDateTime } from "@/components/ui/local-datetime"

export const metadata = privatePageMetadata({
  title: "Orders — Reswell",
  description: "Your purchases on Reswell: shipping status, pickup codes, and order history.",
  path: "/dashboard/orders",
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

type MarketplaceOrderRow = {
  id: string
  order_num: string | null
  amount: number | string
  status: string
  created_at: string
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  stripe_checkout_session_id: string | null
  seller_id: string
  listings:
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        listing_images: Array<{ url: string; is_primary: boolean | null }> | null
      }
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        listing_images: Array<{ url: string; is_primary: boolean | null }> | null
      }[]
    | null
}

function primaryImage(images: Array<{ url: string; is_primary: boolean | null }> | null | undefined) {
  if (!images?.length) return null
  const primary = images.find((i) => i.is_primary)
  return (primary ?? images[0]).url
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

/** Buyer-facing labels aligned with the sales list tile pattern. */
function fulfillmentLabel(method: string | null, hasShipAddr: boolean): string {
  if (method === "shipping" || hasShipAddr) return "Ship to you"
  if (method === "pickup") return "Local pickup"
  return hasShipAddr ? "Ship to you" : "Local pickup"
}

function paymentLabel(stripeSessionId: string | null): string {
  return stripeSessionId ? "Card" : "Reswell Bucks"
}

export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      status,
      created_at,
      shipping_address,
      fulfillment_method,
      stripe_checkout_session_id,
      seller_id,
      listings (
        id,
        title,
        slug,
        section,
        listing_images ( url, is_primary )
      )
    `
    )
    .eq("buyer_id", user.id)
    .in("status", [...ORDER_STATUS_LIST])
    .order("created_at", { ascending: false })

  const list = (orders ?? []) as unknown as MarketplaceOrderRow[]

  const sellerIds = [...new Set(list.map((p) => p.seller_id).filter(Boolean))]
  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", sellerIds)
      : { data: [] as { id: string; display_name: string | null }[] }

  const sellerNameById = new Map(
    (sellerProfiles ?? []).map((p) => [p.id, p.display_name?.trim() || ""]),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1">
          Used gear and peer-to-peer buys. Sales you make are under{" "}
          <Link href="/dashboard/sales" className="text-primary underline underline-offset-2">
            Sales
          </Link>
          ; wallet activity is in{" "}
          <Link href="/dashboard/wallet" className="text-primary underline underline-offset-2">
            Reswell Bucks
          </Link>
          .
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Could not load orders. If this persists, check that marketplace RLS policies for{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">orders</code> are applied in Supabase.
        </p>
      )}

      {!error && list.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 max-w-sm">
              When you buy from other members, your receipts show up here.
            </p>
            <Button asChild>
              <Link href="/gear">Browse gear</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {list.map((row) => {
          const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
          const title = listing?.title
            ? capitalizeWords(listing.title)
            : "Item (listing removed)"
          const img = primaryImage(listing?.listing_images ?? null)
          const sellerRaw = sellerNameById.get(row.seller_id)?.trim()
          const sellerName =
            sellerRaw && sellerRaw.length > 0 ? sellerRaw : `Seller ${row.seller_id.slice(0, 8)}…`
          const ship = row.shipping_address
          const addrBlock = ship?.address ? formatAddress(ship.address) : null
          const fulfill = fulfillmentLabel(row.fulfillment_method, !!addrBlock)
          const paidWith = paymentLabel(row.stripe_checkout_session_id)

          return (
            <Link
              key={row.id}
              href={`/dashboard/orders/${row.id}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card
                className={`h-full transition-colors ${
                  orderStatusIsRefunded(row.status)
                    ? "border-destructive/20 bg-destructive/[0.02]"
                    : orderStatusIsRefundInProgress(row.status)
                      ? "border-amber-500/25 bg-amber-500/[0.03]"
                      : "hover:bg-muted/40 hover:border-primary/25"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-muted-foreground" />
                        Order #{formatOrderNumForCustomer(row.order_num, row.id)}
                      </CardTitle>
                      <CardDescription>
                        <LocalDateTime iso={row.created_at} dateStyle="medium" timeStyle="short" />
                      </CardDescription>
                    </div>
                    <Badge
                      variant={orderStatusBadgeVariant(row.status)}
                      className={
                        orderStatusIsRefundInProgress(row.status)
                          ? "border-amber-500/40 text-amber-950 dark:text-amber-100"
                          : undefined
                      }
                    >
                      {orderStatusLabel(row.status)}
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
                    <div className="relative h-16 w-16 flex-shrink-0 rounded-md border bg-muted overflow-hidden">
                      {img ? (
                        <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground line-clamp-2">{title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Seller: {sellerName}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Tap for order details, tracking, and messages
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Order total</span>
                      <span
                        className={`tabular-nums ${orderStatusIsRefunded(row.status) ? "line-through" : ""}`}
                      >
                        ${Number(row.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-foreground pt-1">
                      <span>Payment</span>
                      <span>{paidWith}</span>
                    </div>
                  </div>

                  {orderStatusIsRefundInProgress(row.status) && (
                    <div className="rounded-lg bg-amber-500/[0.08] border border-amber-500/25 p-2.5 flex items-center gap-2 text-sm">
                      <RotateCcw className="h-3.5 w-3.5 text-amber-800 dark:text-amber-200 shrink-0" />
                      <span className="text-amber-950 dark:text-amber-100 font-medium">
                        Refund in progress — ${Number(row.amount).toFixed(2)} via Stripe (bank timing varies)
                      </span>
                    </div>
                  )}

                  {orderStatusIsRefunded(row.status) && (
                    <div className="rounded-lg bg-destructive/5 border border-destructive/15 p-2.5 flex items-center gap-2 text-sm">
                      <RotateCcw className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-destructive font-medium">
                        Refund complete — ${Number(row.amount).toFixed(2)} returned to you
                      </span>
                    </div>
                  )}

                  {addrBlock && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="font-medium text-foreground mb-1">Deliver to</p>
                      {ship?.name && <p className="text-foreground">{ship.name}</p>}
                      <p className="text-muted-foreground whitespace-pre-line line-clamp-3">
                        {addrBlock}
                      </p>
                      {(ship?.phone || ship?.email) && (
                        <p className="text-xs text-muted-foreground mt-1">Open order for full details</p>
                      )}
                    </div>
                  )}

                  {!addrBlock && row.fulfillment_method === "pickup" && (
                    <p className="text-sm text-muted-foreground">
                      Local pickup — open this order to message the seller and confirm details.
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
