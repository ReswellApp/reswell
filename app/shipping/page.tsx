import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { ShippingLabelTool } from "@/components/shipping-label-tool"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { listSellerLabelPurchasableOrders } from "@/lib/services/sellerShippingLabelCheckout"
import { capitalizeWords } from "@/lib/listing-labels"
import { Truck } from "lucide-react"

export async function generateMetadata() {
  return resolvePageMetadata("shipping")
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ShippingGuideCards() {
  return (
    <>
      <p className="text-muted-foreground mb-4 leading-relaxed">
        Sellers choose whether to offer shipping on each listing. For surfboards you can offer
        local pickup, shipping, or both. If you ship, you set a flat shipping price when you post
        the listing. This guide covers both sides, whether you&apos;re sending a board or waiting
        on one.
      </p>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        Planning ahead? Use our{" "}
        <Link href="/shipping-estimator" className="font-medium text-primary underline underline-offset-4">
          shipping label cost estimator
        </Link>{" "}
        to compare domestic carrier quotes by ZIP, weight, and packed dimensions before you list or
        ship.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          We&apos;ve partnered with A New Earth Project
        </h2>

        <div className="mb-4 overflow-hidden rounded-lg border border-border bg-muted shadow-sm">
          <iframe
            src="https://www.youtube.com/embed/f2K8VUpsgkw"
            title="Reswell shipping guide video"
            className="aspect-video w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Sellers can get purpose-built, sustainable surfboard shipping boxes from our partner{" "}
          <a
            href="https://anewearthproject.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            A New Earth Project
          </a>
          .
        </p>
      </section>

      <section id="how-to-pack-a-surfboard" className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">How to pack a surfboard</h2>

        <div className="mb-4 overflow-hidden rounded-lg border border-border bg-muted shadow-sm">
          <iframe
            src="https://www.youtube.com/embed/NzDaFE4d9V4?start=14"
            title="How to pack a surfboard for shipping"
            className="aspect-video w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>

        <Card>
          <CardContent className="space-y-3 pt-6 text-muted-foreground">
            <p>
              A well-packed board is the best way to avoid damage in transit. If you need a box,
              order one from our partner{" "}
              <a
                href="https://anewearthproject.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                A New Earth Project
              </a>
              . Their system is built for surfboards and is fully curbside recyclable.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Wrap the board in protective material, paying extra attention to the nose and tail.</li>
              <li>Slide the board into a telescoping box that fits snugly without forcing it.</li>
              <li>Fill any gaps so the board cannot shift during transit.</li>
              <li>Seal the box securely and label it clearly before handing it to the carrier.</li>
            </ul>
            <p>The video above walks through the full process step by step.</p>
          </CardContent>
        </Card>
      </section>

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
                Pack the board well. See{" "}
                <a href="#how-to-pack-a-surfboard" className="text-primary underline">
                  How to pack a surfboard
                </a>{" "}
                above for a full walkthrough.
              </li>
              <li>
                Use a tracked service like USPS, FedEx, or UPS, and drop the tracking number in
                Messages. You can also buy a label straight from the sale page.
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
              If a listing ships, you can buy it through Reswell checkout and have the seller send
              it to your door. The listing shows whether shipping is calculated at checkout, a flat
              rate, or included free.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                At checkout you&apos;ll see the full total — item price plus shipping when it
                applies. On Reswell shipping listings, the carrier rate appears once you enter your
                address.
              </li>
              <li>
                Confirm your shipping address before you pay. You can also double-check with the
                seller in Messages.
              </li>
              <li>
                Once the board ships, tracking appears on your purchase page. If the seller is taking
                longer than expected, message them in Messages or use Get help on your purchase page.
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
            <CardTitle className="text-lg">Reswell shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              On many listings, sellers choose Reswell shipping. We calculate the carrier rate from
              the packed box size and weight on the listing, and the buyer sees that cost at
              checkout.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Buyers pay shipping as part of their order total — no guessing what it will cost
                later.
              </li>
              <li>
                After a sale, the seller gets a shipping label to print and attach before handing
                the board to the carrier.
              </li>
              <li>
                Sellers can preview label costs with the{" "}
                <Link href="/shipping-estimator" className="text-primary underline underline-offset-4">
                  shipping label cost estimator
                </Link>{" "}
                while creating a listing or anytime before checkout.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Flat rate shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Some sellers set one fixed shipping price for the Continental U.S. Every buyer on
              that listing pays the same amount, shown clearly before checkout.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                The shipping cost is added to the buyer&apos;s order total at checkout — what you
                see on the listing is what you pay.
              </li>
              <li>
                Sellers arrange shipping themselves and add tracking in Messages once the board is
                on its way.
              </li>
              <li>
                Sellers can use Reswell&apos;s label tools from the sale when available, or buy a
                label through their preferred carrier.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Free shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Some sellers cover shipping to attract more buyers. On these listings, you only pay
              the item price — shipping is included.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                No shipping line item at checkout. The listing price is your full total before
                tax.
              </li>
              <li>
                The seller still ships the board to you and should share tracking once it&apos;s
                sent.
              </li>
              <li>
                Sellers often build the shipping cost into the listing price, so the board may
                reflect that upfront.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/** Pending sales where the seller can buy a label — entry point into the label checkout. */
async function SellerBuyLabelEntry({ sellerId }: { sellerId: string }) {
  const supabase = await createClient()
  const orders = await listSellerLabelPurchasableOrders(supabase, sellerId)
  if (orders.length === 0) return null

  return (
    <Card className="mb-8 border-primary/25">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Buy a shipping label
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          These sales are waiting to ship. Purchase a discounted carrier label through Reswell —
          tracking and carrier are added to the order automatically.
        </p>
        <ul className="divide-y rounded-md border">
          {orders.map((o) => (
            <li key={o.orderId} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{capitalizeWords(o.listingTitle)}</p>
                <p className="text-xs text-muted-foreground">Order #{o.displayOrderNum}</p>
              </div>
              <Button size="sm" asChild>
                <Link href={`/shipping?order=${encodeURIComponent(o.orderId)}`}>Buy label</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {labelFlow ? "Print shipping label" : "Shipping Guide"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {labelFlow
              ? "Buy a carrier label and add tracking to this order."
              : "How to ship and receive surfboards safely"}
          </p>
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

        {labelFlow && user && (
          <Suspense
            fallback={
              <div className="rounded-lg border bg-card p-10 text-sm text-muted-foreground">
                Loading shipping tools…
              </div>
            }
          >
            <ShippingLabelTool orderId={orderId!} />
          </Suspense>
        )}

        {labelFlow && (
          <p className="mt-10 text-sm text-muted-foreground border-t border-border/60 pt-8">
            Looking for packaging tips, who does what, and pickup info?{" "}
            <Link href="/shipping" className="text-primary font-medium underline underline-offset-4">
              Open the full shipping guide
            </Link>{" "}
            (same page, no order link needed).
          </p>
        )}

        {!labelFlow && user && (
          <Suspense fallback={null}>
            <SellerBuyLabelEntry sellerId={user.id} />
          </Suspense>
        )}

        {!labelFlow && <ShippingGuideCards />}
      </div>
    </main>
  )
}
