"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShopifyCatalogSummaryTiles } from "@/components/features/integrations/shopify/shopify-catalog-summary"
import { ShopifyLinkedListingRow } from "@/components/features/integrations/shopify/shopify-linked-listing-row"
import { ShopifyLinkedListingsToolbar } from "@/components/features/integrations/shopify/shopify-linked-listings-toolbar"
import type { ShopifyLinkedListingsController } from "@/components/features/integrations/shopify/hooks/use-shopify-linked-listings"
import type { ShopifyCatalogManagerData } from "@/lib/shopify/types"

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
    <section className="space-y-4">
      <ShopifyCatalogSummaryTiles
        summary={catalog.summary}
        activeFilter={params.filter}
        onFilterChange={(filter) => void controller.load({ filter, page: 1 })}
      />
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

      {page.listings.length > 0 ? (
        <ul className="space-y-2" aria-busy={loading}>
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
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Loading" />
          ) : filtered ? (
            "No linked listings match these filters."
          ) : (
            <div className="space-y-3">
              <p>No Shopify products are published on Reswell yet.</p>
              {canSync ? (
                <Button type="button" variant="outline" onClick={onBrowseShopify}>
                  Add products from Shopify
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
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
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page.page >= pageCount}
              onClick={() => void controller.load({ page: page.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
