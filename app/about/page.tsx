import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Waves } from "lucide-react"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "About — Reswell",
  description:
    "Reswell is the peer-to-peer marketplace built for surfers — buy and sell boards and gear with checkout, messaging, shipping tools, and Purchase Protection.",
  path: "/about",
})

export default function AboutPage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <Waves className="h-10 w-10 text-primary" aria-hidden />
          <div>
            <h1 className="text-3xl font-bold text-foreground">About Reswell</h1>
            <p className="mt-1 text-muted-foreground">
              A marketplace made for surfers, by people who get it
            </p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          Reswell exists because buying and selling surfboards should feel as good as paddling out on
          a clean morning. We built a place where surfers list the boards they love, find their next
          ride, and handle the whole deal — messaging, offers, checkout, and shipping — without the
          chaos of random DMs and sketchy meetups.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What we believe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Surf gear has stories. Every board deserves a second life in the water, and every
                surfer deserves a straight deal. We keep the marketplace human: real profiles, real
                conversations, and support when something does not go as planned.
              </p>
              <p>
                When you buy through Reswell checkout, eligible purchases are covered by our{" "}
                <Link href="/protection-policy" className="text-primary underline">
                  Purchase Protection
                </Link>
                . Sellers get tools to ship, get paid, and manage listings from one dashboard.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Browse{" "}
                <Link href="/boards" className="text-primary underline">
                  surfboards
                </Link>
                , check{" "}
                <Link href="/sold" className="text-primary underline">
                  recently sold
                </Link>{" "}
                boards for market context, message sellers with questions, and pay on-platform when
                you are ready. Selling? Start from{" "}
                <Link href="/sell" className="text-primary underline">
                  List your board
                </Link>{" "}
                and manage everything from your dashboard.
              </p>
              <p>
                For a deeper walkthrough, read{" "}
                <Link href="/what-is-reswell" className="text-primary underline">
                  What is Reswell
                </Link>{" "}
                or visit the{" "}
                <Link href="/help" className="text-primary underline">
                  Help Center
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Get in touch</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p>
                Questions, feedback, or something that does not look right?{" "}
                <Link href="/contact" className="text-primary underline">
                  Contact us
                </Link>
                . We read every message.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
