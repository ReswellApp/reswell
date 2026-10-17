"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifyIndexGridClass,
  shopifyMutedClass,
  shopifySecondaryButtonClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { ShopifyCatalogSummary } from "@/components/features/integrations/shopify/shopify-catalog-summary"
import { ShopifyLinkedListingRow } from "@/components/features/integrations/shopify/shopify-linked-listing-row"
import { ShopifyLinkedListingsToolbar } from "@/components/features/integrations/shopify/shopify-linked-listings-toolbar"
import type { ShopifyLinkedListingsController } from "@/components/features/integrations/shopify/hooks/use-shopify-linked-listings"
import type { ShopifyCatalogManagerData } from "@/lib/shopify/types"
import { cn } from "@/lib/utils"

interface ShopifyLinkedListingsPanelProps {
  catalog: ShopifyCatalogManagerData
  controller: ShopifyLinkedListingsController
  canSync: boolean
  onUnpublish: (productId: string) => void
  onBrowseShopify: () => void
}

export function ShopifyLinkedListingsPanel({
  catalog,
  controller,
  canSync,
  onUnpublish,
  onBrowseShopify,
}: ShopifyLinkedListingsPanelProps) {
  const { params, loading } = controller
  const page = catalog.listings
  const pageCount = Math.max(1, Math.ceil(page.total / page.pageSize))
  const filtered =
    params.filter !== "all" || params.section !== null || params.query !== ""

  return (
    <section className={shopifySurfaceClass} aria-busy={loading}>
      <div className={`border-b p-3 ${shopifyDividerClass}`}>
        <ShopifyLinkedListingsToolbar
          search={controller.search}
          filter={params.filter}
          section={params.section}
          onSearchChange={controller.setSearch}
          onSearchSubmit={() =>
            void controller.load({ query: controller.search.trim(), page: 1 })
          }
          onFilterChange={(filter) => void controller.load({ filter, page: 1 })}
          onSectionChange={(section) => void controller.load({ section, page: 1 })}
        />
      </div>
      <ShopifyCatalogSummary
        summary={catalog.summary}
        activeFilter={params.filter}
        onFilterChange={(filter) => void controller.load({ filter, page: 1 })}
      />

      {page.listings.length > 0 ? (
        <div>
          <div
            className={cn(
              "hidden border-b bg-[#fafbfb] px-3 py-2 text-[12px] font-medium dark:bg-muted/40 sm:grid",
              shopifyDividerClass,
              shopifyMutedClass,
              shopifyIndexGridClass,
            )}
          >
            <span>Product</span>
            <span>Status</span>
            <span>Stock</span>
            <span>Sync</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul>
            {page.listings.map((listing) => (
              <ShopifyLinkedListingRow
                key={listing.mappingId}
                listing={listing}
                busy={controller.busyProductId === listing.productId}
                canSync={canSync}
                onResync={(productId) => void controller.resync(productId)}
                onUnpublish={onUnpublish}
              />
            ))}
          </ul>
        </div>
      ) : (
        <div className={`px-4 py-10 text-center ${shopifyBodyClass}`}>
          {loading ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-label="Loading" />
          ) : filtered ? (
            "No linked listings match these filters."
          ) : (
            <div className="space-y-3">
              <p>No Shopify products are published on Reswell yet.</p>
              {canSync ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBrowseShopify}
                  className={shopifySecondaryButtonClass}
                >
                  Add products from Shopify
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {pageCount > 1 ? (
        <div
          className={`flex items-center justify-between gap-2 border-t px-3 py-2 text-[13px] ${shopifyDividerClass} ${shopifyMutedClass}`}
        >
          <span>
            Page {page.page} of {pageCount} · {page.total} variants
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page.page <= 1}
              onClick={() => void controller.load({ page: page.page - 1 })}
              className={shopifySecondaryButtonClass}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page.page >= pageCount}
              onClick={() => void controller.load({ page: page.page + 1 })}
              className={shopifySecondaryButtonClass}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
