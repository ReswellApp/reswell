import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Receipt, Package, ChevronRight } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"

type MarketplaceOrderRow = {
  id: string
  amount: number | string
  status: string
  created_at: string
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
      amount,
      status,
      created_at,
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
    .eq("status", "confirmed")
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

      <div className="space-y-3">
        {list.map((row) => {
          const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
          const title = listing?.title
            ? capitalizeWords(listing.title)
            : "Item (listing removed)"
          const img = primaryImage(listing?.listing_images ?? null)
          const sellerRaw = sellerNameById.get(row.seller_id)?.trim()
          const sellerName =
            sellerRaw && sellerRaw.length > 0 ? sellerRaw : `Seller ${row.seller_id.slice(0, 8)}…`
          const fulfill =
            row.fulfillment_method === "shipping"
              ? "Shipping"
              : row.fulfillment_method === "pickup"
                ? "Local pickup"
                : "—"

          return (
            <Card key={row.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-mono text-muted-foreground">
                      Order #{row.id.slice(0, 8).toUpperCase()}
                    </CardTitle>
                    <CardDescription>
                      {new Date(row.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {paymentLabel(row.stripe_checkout_session_id)} · {fulfill}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">Paid</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href={`/dashboard/orders/${row.id}`}
                  className="flex gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                >
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
                    <p className="text-sm text-muted-foreground mt-0.5">From {sellerName}</p>
                    <p className="text-sm font-semibold tabular-nums mt-1">
                      ${Number(row.amount).toFixed(2)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
