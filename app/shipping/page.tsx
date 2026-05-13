import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ShippingLabelTool } from "@/components/shipping-label-tool"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Shipping guide — Reswell",
  description:
    "How to ship and receive surfboards on Reswell, from packaging to pickup, labels, and what each side is responsible for.",
  path: "/shipping",
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ShippingGuideCards() {
  return (
    <>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        Sellers choose whether to offer shipping on each listing. For surfboards you can offer
        local pickup, shipping, or both. If you ship, you set a flat shipping price when you post
        the listing. This guide covers both sides, whether you&apos;re sending a board or waiting
        on one.
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">If you&apos;re the seller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              When you create a listing you can turn on “Shipping available” and either set a flat
              price or pick “Buyer pays shipping.”
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Pack the board well. Bubble wrap, a sturdy box, and plenty of padding around the
                nose and tail go a long way.
              </li>
              <li>
                Use a tracked service like USPS, FedEx, or UPS, and drop the tracking number in
                Messages. You can also buy a label straight from the sale when ShipEngine is set
                up.
              </li>
              <li>
                Ship within the window you agreed with the buyer, usually 1 to 3 business days.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">If you&apos;re the buyer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              If a listing says “Ships,” you can buy it and have the seller send it to you. The
              seller will add tracking once the board is on its way.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Double check your shipping address with the seller in Messages before they send
                the board.
              </li>
              <li>
                Inspect the package when it arrives. If something is damaged or not as described,
                message the seller right away. Eligible purchases paid through Reswell checkout are
                covered by{" "}
                <Link href="/protection-policy" className="text-primary underline">
                  Purchase Protection
                </Link>
                , so you can open a refund claim from your purchase page if you need help.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Local pickup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Plenty of listings, especially surfboards, are pickup only. Meet somewhere public,
              take a proper look at the board, and only pay once you&apos;re happy. Our{" "}
              <Link href="/safety" className="text-primary underline">
                Safety tips
              </Link>{" "}
              have more on meeting up with someone for the first time.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Who pays for shipping?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Every listing tells you whether shipping is free, a flat rate, or “Buyer pays
              shipping.” It&apos;s worth confirming the final cost and carrier in Messages before
              the seller ships.
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

  /** With `?order=`, this route is the seller label workflow, not the long guide. */
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
            Looking for packaging tips, who does what, and pickup info?{" "}
            <Link href="/shipping" className="text-primary font-medium underline underline-offset-4">
              Open the full shipping guide
            </Link>{" "}
            (same page, no order link needed).
          </p>
        )}

        {!labelFlow && <ShippingGuideCards />}
      </div>
    </main>
  )
}
