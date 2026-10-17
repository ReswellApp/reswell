import {
  shopifyBodyClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"

export function ShopifyInventoryScopeNote() {
  return (
    <section className={shopifySurfaceClass}>
      <div className="space-y-2 px-4 py-3">
        <h2 className={shopifySectionTitleClass}>Inventory-only access</h2>
        <p className={shopifyBodyClass}>
          Reswell does not read or sync Shopify orders, customers, payments,
          fulfillments, cancellations, or refunds. A Reswell sale only
          decrements the linked Shopify inventory item.
        </p>
        <p className={shopifyBodyClass}>
          Shopify stays the source of truth for titles, prices, images,
          variants, and stock. Deleting a product or variant in Shopify takes
          its Reswell listing off the marketplace.
        </p>
      </div>
    </section>
  )
}
