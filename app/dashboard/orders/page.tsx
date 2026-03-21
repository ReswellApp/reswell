import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, Package } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"

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

type OrderRow = {
  id: string
  status: string
  subtotal: number | string
  shipping: number | string
  tax: number | string
  total: number | string
  created_at: string
  shipping_address: ShippingAddressJson
  order_items: Array<{
    id: string
    quantity: number
    price: number | string
    listing_id: string
    listings: {
      id: string
      title: string
      listing_images: Array<{ url: string; is_primary: boolean | null }> | null
    } | null
  }> | null
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Awaiting payment",
    paid: "Paid",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  }
  return map[status] ?? status
}

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid" || status === "shipped" || status === "delivered") return "default"
  if (status === "pending") return "secondary"
  if (status === "cancelled" || status === "refunded") return "destructive"
  return "outline"
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
      status,
      subtotal,
      shipping,
      tax,
      total,
      created_at,
      shipping_address,
      order_items (
        id,
        quantity,
        price,
        listing_id,
        listings (
          id,
          title,
          listing_images ( url, is_primary )
        )
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const list = (orders ?? []) as OrderRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1">
          Shop purchases (new gear checkout). For used gear and surfboards, see activity in{" "}
          <Link href="/dashboard/wallet" className="text-primary underline underline-offset-2">
            Reswell Bucks
          </Link>
          .
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Could not load orders. Try again later or contact support if this persists.
        </p>
      )}

      {!error && list.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 max-w-sm">
              You don&apos;t have any shop orders yet. When you buy from the new gear store, they&apos;ll
              show up here.
            </p>
            <Button asChild>
              <Link href="/shop">Browse shop</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {list.map((order) => {
          const items = order.order_items ?? []
          const ship = order.shipping_address
          const addrBlock = ship?.address ? formatAddress(ship.address) : null

          return (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      Order #{order.id.slice(0, 8)}
                    </CardTitle>
                    <CardDescription>
                      {new Date(order.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </CardDescription>
                  </div>
                  <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {items.map((line) => {
                    const listing = line.listings
                    const title = listing?.title
                      ? capitalizeWords(listing.title)
                      : "Item (listing removed)"
                    const img = primaryImage(listing?.listing_images ?? null)
                    const href = listing?.id ? `/shop/${listing.id}` : null

                    return (
                      <li key={line.id} className="flex gap-3">
                        <div className="relative h-16 w-16 flex-shrink-0 rounded-md border bg-muted overflow-hidden">
                          {img ? (
                            <Image
                              src={img}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {href ? (
                            <Link
                              href={href}
                              className="font-medium text-foreground hover:text-primary line-clamp-2"
                            >
                              {title}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground line-clamp-2">{title}</span>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Qty {line.quantity} × ${Number(line.price).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right text-sm font-medium tabular-nums">
                          ${(Number(line.price) * line.quantity).toFixed(2)}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">${Number(order.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span className="tabular-nums">${Number(order.shipping).toFixed(2)}</span>
                  </div>
                  {Number(order.tax) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax</span>
                      <span className="tabular-nums">${Number(order.tax).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-foreground pt-1">
                    <span>Total</span>
                    <span className="tabular-nums">${Number(order.total).toFixed(2)}</span>
                  </div>
                </div>

                {order.status !== "pending" && addrBlock && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium text-foreground mb-1">Ship to</p>
                    {ship?.name && <p className="text-foreground">{ship.name}</p>}
                    <p className="text-muted-foreground whitespace-pre-line">{addrBlock}</p>
                    {ship?.phone && (
                      <p className="text-muted-foreground mt-1">Phone: {ship.phone}</p>
                    )}
                  </div>
                )}

                {order.status === "pending" && (
                  <p className="text-xs text-muted-foreground">
                    If checkout wasn&apos;t completed, this order may expire. You can start a new checkout
                    from your cart.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
