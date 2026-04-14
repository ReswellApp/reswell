import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Truck, MapPin, DollarSign } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ShippingLabelTool } from "@/components/shipping-label-tool"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Shipping guide — Reswell",
  description:
    "How to ship and receive surfboards on Reswell — packaging, pickup, labels, and buyer/seller responsibilities.",
  path: "/shipping",
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ShippingGuideCards() {
  return (
    <>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        Sellers choose whether to offer shipping on each listing. For surfboards you can offer local pickup,
        shipping, or both—if you ship, you set a flat shipping price at listing time. Use this guide whether
        you are sending or receiving a board.
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              For sellers: offering shipping
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              When you create a listing, you can enable “Shipping available” and set a shipping price or
              “Buyer pays shipping.”
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Pack items securely (bubble wrap, cardboard, sturdy box) to avoid damage in transit.</li>
              <li>
                Use a trackable service (USPS, FedEx, UPS) and share the tracking number with the buyer in
                Messages—or use integrated label printing from your sale when ShipEngine is configured.
              </li>
              <li>Ship within the timeframe you agreed with the buyer (e.g. 1–3 business days).</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              For buyers: receiving shipped items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              If a listing says “Ships,” you can buy and have it shipped. The seller will send tracking once
              shipped.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirm your shipping address with the seller in Messages before they ship.</li>
              <li>
                Inspect the package when it arrives. If something is damaged or not as described, message the
                seller right away and, if you used Reswell Bucks, you may be eligible for help from our team.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Local pickup (surfboards and in-person sales)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Many listings, especially surfboards, are local pickup only. Meet in a safe, public place and
              inspect the item before paying. See our{" "}
              <Link href="/safety" className="text-primary underline">
                Safety Tips
              </Link>{" "}
              for meeting in person.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Who pays for shipping?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              The listing will show whether shipping is free, a flat rate, or “Buyer pays shipping.” Agree on
              the final cost and method in Messages before the seller ships.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default async function ShippingGuidePage(props: {
  searchParams: Promise<{ order?: string }>
}) {
  const sp = await props.searchParams
  const rawOrder = typeof sp.order === "string" ? sp.order.trim() : ""
  const orderId = rawOrder && UUID_RE.test(rawOrder) ? rawOrder : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const loginHref = orderId
    ? `/auth/login?redirect=${encodeURIComponent(`/shipping?order=${encodeURIComponent(orderId)}`)}`
    : "/auth/login?redirect=/shipping"

  /** With `?order=`, this route is the seller label workflow — not the long guide. */
  const labelFlow = Boolean(orderId)

  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <Package className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {labelFlow ? "Print shipping label" : "Shipping Guide"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {labelFlow
                ? "Buy a carrier label and add tracking to this order (ShipEngine)."
                : "How to ship and receive surfboards safely"}
            </p>
          </div>
        </div>

        {labelFlow && !user && (
          <Alert className="mb-8">
            <AlertTitle>Sign in to print a label</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>Seller tools for this order require your account.</span>
              <Button type="button" size="sm" asChild>
                <Link href={loginHref}>Sign in</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {labelFlow && user && <ShippingLabelTool orderId={orderId!} />}

        {labelFlow && (
          <p className="mt-10 text-sm text-muted-foreground border-t border-border/60 pt-8">
            Looking for packaging tips, buyer/seller responsibilities, and pickup info?{" "}
            <Link href="/shipping" className="text-primary font-medium underline underline-offset-4">
              Open the full shipping guide
            </Link>{" "}
            (same site — without an order link).
          </p>
        )}

        {!labelFlow && <ShippingGuideCards />}
      </div>
    </main>
  )
}
