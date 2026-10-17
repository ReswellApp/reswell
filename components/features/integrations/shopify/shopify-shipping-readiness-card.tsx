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
      <div className={`flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 ${shopifyDividerClass}`}>
        <div>
          <h2 className={shopifySectionTitleClass}>Shipping setup</h2>
          <p className={`mt-1 ${shopifyBodyClass}`}>
            Shopify products use Reswell checkout, live ShipEngine rates, and
            Reswell-generated labels.
          </p>
        </div>
        <span className={shippingReady ? shopifySuccessBadgeClass : shopifyNeutralBadgeClass}>
          {shippingReady ? "Defaults ready" : "Setup needed"}
        </span>
      </div>

      <dl className="grid sm:grid-cols-2">
        <div className={`border-b px-4 py-3 sm:border-b-0 sm:border-r ${shopifyDividerClass}`}>
          <dt className={shopifySectionTitleClass}>Ship-from address</dt>
          <dd className={`mt-1 ${shopifyBodyClass}`}>
            {readiness.hasShipFromAddress
              ? "Saved and ready for carrier quotes."
              : "Add a saved address before enabling shipping."}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className={shopifySectionTitleClass}>Shop shipping default</dt>
          <dd className={`mt-1 ${shopifyBodyClass}`}>
            {readiness.packageDefaults.length > 0
              ? `${readiness.packageDefaults.length} saved package${
                  readiness.packageDefaults.length === 1 ? "" : "s"
                }.`
              : "Save a shop box before enabling shipping on imports."}
          </dd>
        </div>
      </dl>

      {readiness.packageDefaults.length > 0 ? (
        <div className={`flex flex-wrap gap-2 border-t px-4 py-3 ${shopifyDividerClass}`}>
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

      <div className={`space-y-3 border-t px-4 py-3 ${shopifyDividerClass}`}>
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
    </section>
  )
}
