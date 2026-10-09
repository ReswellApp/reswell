import Link from "next/link"
import { ArrowRight, MapPin, PackageCheck, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ShopifyShippingReadiness } from "@/lib/shopify/types"

interface ShopifyShippingReadinessCardProps {
  readiness: ShopifyShippingReadiness
}

export function ShopifyShippingReadinessCard({
  readiness,
}: ShopifyShippingReadinessCardProps) {
  const shippingReady =
    readiness.hasShipFromAddress && readiness.packageDefaults.length > 0

  return (
    <Card className={shippingReady ? "border-emerald-200/80" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Truck className="h-5 w-5" aria-hidden />
              Shipping setup
            </CardTitle>
            <CardDescription className="mt-1">
              Shopify products use Reswell checkout, live ShipEngine rates, and
              Reswell-generated labels.
            </CardDescription>
          </div>
          <Badge variant={shippingReady ? "secondary" : "outline"}>
            {shippingReady ? "Defaults ready" : "Setup needed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-lg border p-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Ship-from address</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {readiness.hasShipFromAddress
                  ? "Saved and ready for carrier quotes."
                  : "Add a saved address before enabling shipping."}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-3">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Category package defaults</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {readiness.packageDefaults.length > 0
                  ? `${readiness.packageDefaults.length} configured categor${
                      readiness.packageDefaults.length === 1 ? "y" : "ies"
                    }.`
                  : "Choose a package size for each category you plan to import."}
              </p>
            </div>
          </div>
        </div>

        {readiness.packageDefaults.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {readiness.packageDefaults.map((entry) => (
              <Badge key={entry.section} variant="outline">
                {entry.sectionLabel}: {entry.packageLabel}
              </Badge>
            ))}
          </div>
        ) : null}

        <p className="text-sm leading-relaxed text-muted-foreground">
          New imports with both requirements ready offer local pickup and live
          shipping. Otherwise they start pickup-only. Listing-level fulfillment
          and package overrides remain editable from My Listings.
        </p>

        <div className="flex flex-wrap gap-2">
          {!readiness.hasShipFromAddress ? (
            <Button variant="outline" asChild>
              <Link href="/dashboard/profile">Add ship-from address</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/dashboard/listings?view=advanced">
              Configure package defaults
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
