import {
  shopifyBodyClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"

export function ShopifyInventoryScopeNote() {
  return (
    <section className={shopifySurfaceClass}>
      <div className="space-y-2 px-5 py-4">
        <h2 className={shopifySectionTitleClass}>How a sale updates Shopify</h2>
        <p className={shopifyBodyClass}>
          A Reswell sale creates at most one paid Shopify order. That order is what changes Shopify stock. Reswell does not also adjust the inventory quantity for the same sale.
        </p>
        <p className={shopifyBodyClass}>
          The 7% fee on a connected sale is a Shopify usage charge. Sales that are not connected to Shopify keep the usual Reswell payout fee.
        </p>
      </div>
    </section>
  )
}
