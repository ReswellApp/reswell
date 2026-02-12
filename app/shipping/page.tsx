import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Truck, MapPin, DollarSign } from "lucide-react"

export const metadata = {
  title: "Shipping Guide - ReSwell Surf",
  description: "How to ship and receive surf gear on ReSwell Surf. Seller and buyer responsibilities, packaging tips, and local pickup.",
}

export default function ShippingGuidePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Package className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Shipping Guide</h1>
              <p className="text-muted-foreground mt-1">
                How to ship and receive surf gear safely
              </p>
            </div>
          </div>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Sellers can choose whether to offer shipping on used gear. Surfboards are typically in-person pickup only so buyers can inspect the board. Use this guide whether you’re sending or receiving an item.
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
                <p>When you create a listing, you can enable “Shipping available” and set a shipping price or “Buyer pays shipping.”</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Pack items securely (bubble wrap, cardboard, sturdy box) to avoid damage in transit.</li>
                  <li>Use a trackable service (USPS, FedEx, UPS) and share the tracking number with the buyer in Messages.</li>
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
                <p>If a listing says “Ships,” you can buy and have it shipped. The seller will send tracking once shipped.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Confirm your shipping address with the seller in Messages before they ship.</li>
                  <li>Inspect the package when it arrives. If something is damaged or not as described, message the seller right away and, if you used ReSwell Bucks, you may be eligible for help from our team.</li>
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
                <p>Many listings, especially surfboards, are local pickup only. Meet in a safe, public place and inspect the item before paying. See our <Link href="/safety" className="text-primary underline">Safety Tips</Link> for meeting in person.</p>
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
                <p>The listing will show whether shipping is free, a flat rate, or “Buyer pays shipping.” Agree on the final cost and method in Messages before the seller ships.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
