import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PackageCheck, Package, Truck, MapPin } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"

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
  amount: number | string
  seller_earnings: number | string
  status: string
  created_at: string
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  buyer_id: string
  stripe_checkout_session_id: string | null
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
    .from("purchases")
    .select(
      `
      id,
      amount,
      seller_earnings,
      status,
      created_at,
      shipping_address,
      fulfillment_method,
      buyer_id,
      stripe_checkout_session_id,
      listings (
        id,
        title,
        slug,
        section,
        listing_images ( url, is_primary )
      )
    `
    )
    .eq("seller_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })

  const list = (sales ?? []) as unknown as SaleRow[]

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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sales</h1>
        <p className="text-muted-foreground mt-1">
          Card and wallet purchases of your listings. Shipping addresses appear here when the buyer paid
          with a card and chose delivery.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Could not load sales. If you recently deployed, run{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/030_purchases_fulfillment_seller_policy.sql</code>{" "}
          in Supabase so sellers can read purchase rows.
        </p>
      )}

      {!error && list.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PackageCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 max-w-sm">
              When someone buys your gear, the order shows up here with fulfillment details.
            </p>
            <Button asChild>
              <Link href="/sell">Create a listing</Link>
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
          const listingHref = listing ? listingDetailHref(listing) : null
          const ship = sale.shipping_address
          const addrBlock = ship?.address ? formatAddress(ship.address) : null
          const buyerDisplay = buyerNameById.get(sale.buyer_id)?.trim()
          const buyerName =
            buyerDisplay && buyerDisplay.length > 0
              ? buyerDisplay
              : `Buyer ${sale.buyer_id.slice(0, 8)}…`
          const fulfill = fulfillmentLabel(sale.fulfillment_method, !!addrBlock)

          return (
            <Card key={sale.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PackageCheck className="h-5 w-5 text-muted-foreground" />
                      Sale #{sale.id.slice(0, 8)}
                    </CardTitle>
                    <CardDescription>
                      {new Date(sale.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </CardDescription>
                  </div>
                  <Badge variant="default">Paid</Badge>
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
                    {listingHref ? (
                      <Link
                        href={listingHref}
                        className="font-medium text-foreground hover:text-primary line-clamp-2"
                      >
                        {title}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground line-clamp-2">{title}</span>
                    )}
                    <p className="text-sm text-muted-foreground mt-0.5">Buyer: {buyerName}</p>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Order total</span>
                    <span className="tabular-nums">${Number(sale.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-foreground pt-1">
                    <span>Your earnings</span>
                    <span className="tabular-nums">${Number(sale.seller_earnings).toFixed(2)}</span>
                  </div>
                </div>

                {addrBlock && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium text-foreground mb-1">Ship to</p>
                    {ship?.name && <p className="text-foreground">{ship.name}</p>}
                    <p className="text-muted-foreground whitespace-pre-line">{addrBlock}</p>
                    {ship?.phone && (
                      <p className="text-muted-foreground mt-1">Phone: {ship.phone}</p>
                    )}
                    {ship?.email && (
                      <p className="text-muted-foreground mt-1">Email: {ship.email}</p>
                    )}
                  </div>
                )}

                {!addrBlock && sale.fulfillment_method === "pickup" && (
                  <p className="text-sm text-muted-foreground">
                    Pickup: coordinate time and place with the buyer in{" "}
                    <Link href="/messages" className="text-primary underline underline-offset-2">
                      Messages
                    </Link>
                    .
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/messages">Open messages</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
