import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifyNeutralBadgeClass,
  shopifySecondaryButtonClass,
  shopifySectionTitleClass,
  shopifySuccessBadgeClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
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
    <section className={shopifySurfaceClass}>
      <div className={`flex flex-wrap items-start justify-between gap-3 px-5 py-4 ${shopifyDividerClass}`}>
        <div className="min-w-0">
          <h2 className={shopifySectionTitleClass}>Shipping setup</h2>
          <p className={`mt-1 max-w-3xl ${shopifyBodyClass}`}>
            Shopify products use Reswell checkout, live ShipEngine rates, and
            Reswell-generated labels.
          </p>
        </div>
        <span className={shippingReady ? shopifySuccessBadgeClass : shopifyNeutralBadgeClass}>
          {shippingReady ? "Defaults ready" : "Setup needed"}
        </span>
      </div>

      <div className={`space-y-4 border-t px-5 py-4 ${shopifyDividerClass}`}>
        <div>
          <h3 className="text-[13px] font-semibold text-[#202223] dark:text-foreground">
            Ship-from address
          </h3>
          <p className={`mt-1 ${shopifyBodyClass}`}>
            {readiness.hasShipFromAddress
              ? "Saved and ready for carrier quotes."
              : "Add a saved address before enabling shipping."}
          </p>
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-[#202223] dark:text-foreground">
            Shop shipping default
          </h3>
          <p className={`mt-1 ${shopifyBodyClass}`}>
            {readiness.packageDefaults.length > 0
              ? `${readiness.packageDefaults.length} saved package${
                  readiness.packageDefaults.length === 1 ? "" : "s"
                }.`
              : "Save a shop box before enabling shipping on imports."}
          </p>
        </div>

      {readiness.packageDefaults.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {readiness.packageDefaults.map((entry) => (
            <span
              key={`${entry.section}-${entry.packageSizeId}`}
              className={shopifyNeutralBadgeClass}
            >
              {entry.sectionLabel}: {entry.packageLabel}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <p className={shopifyBodyClass}>
          New imports with both requirements ready offer local pickup and live
          shipping. Otherwise they start pickup-only. Listing-level fulfillment
          and package overrides remain editable from My Listings.
        </p>
        <div className="flex flex-wrap gap-2">
          {!readiness.hasShipFromAddress ? (
            <Button variant="outline" asChild className={shopifySecondaryButtonClass}>
              <Link href="/dashboard/profile">Add ship-from address</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild className={shopifySecondaryButtonClass}>
            <Link href="/dashboard/listings?view=advanced">
              Set shop shipping default
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
      </div>
    </section>
  )
}
