import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Store } from "lucide-react"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("what-is-reswell")
}

export default function WhatIsReswellPage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Store className="h-10 w-10 text-primary" aria-hidden />
          <div>
            <h1 className="text-3xl font-bold text-foreground">What is Reswell?</h1>
            <p className="mt-1 text-muted-foreground">
              A place for surfers to buy, sell, and actually enjoy the process
            </p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          Think of Reswell as a community marketplace where surfers list boards they love and pick up
          gear from each other, plus some new stuff from shops we work with. You get messaging,
          checkout, help with shipping labels when it applies, and real humans on support when you need
          them. When you buy or sell here, you are dealing with the other person directly. We step in
          on covered purchases through{" "}
          <Link href="/protection-policy" className="text-primary underline">
            Purchase Protection
          </Link>{" "}
          when something goes wrong and it qualifies under the policy.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">If you are buying</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Start on{" "}
                <Link href="/boards" className="text-primary underline">
                  surfboards
                </Link>
                , poke around, message a seller if you have questions, send an offer when it is
                turned on, then pay right here when you are ready. Each listing tells you if shipping,
                pickup, or both are on the table.
              </p>
              <p>
                If your purchase is eligible and you paid through Reswell, Purchase Protection has your
                back for covered issues. Buyers do not pay extra for that.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">If you are selling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Post from{" "}
                <Link href="/sell" className="text-primary underline">
                  Sell your board
                </Link>
                , hook up how you get paid, and keep an eye on purchases from your dashboard. We collect a
                marketplace fee when a sale completes. Sellers do not get hit with a separate protection
                fee on top of that.
              </p>
              <p>
                Curious how any of that works day to day? Our{" "}
                <Link href="/faq" className="text-primary underline">
                  FAQ
                </Link>{" "}
                breaks it down.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Keeping it respectful</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                We are all here because we care about surfing. Please read our{" "}
                <Link href="/terms" className="text-primary underline">
                  Terms of Service
                </Link>
                , be straight with each other, and keep checkout inside Reswell when you are buying or
                selling through us so everyone stays protected when it counts.
              </p>
              <p>
                Meeting someone for pickup? Our{" "}
                <Link href="/safety" className="text-primary underline">
                  Safety tips
                </Link>{" "}
                are worth a quick read.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Got a question we did not cover?{" "}
          <Link href="/contact" className="text-primary underline">
            Contact us
          </Link>
          . We read every message.
        </p>
      </div>
    </main>
  )
}
