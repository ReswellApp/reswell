"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifyFieldClass,
  shopifySecondaryButtonClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { ShopifyProductCard } from "@/components/features/integrations/shopify/shopify-product-card"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { ShopifyCatalogProduct } from "@/lib/shopify/types"

interface ShopifyProductPickerProps {
  products: ShopifyCatalogProduct[]
  query: string
  busyProductId: string | null
  loading: boolean
  hasNextPage: boolean
  onQueryChange: (query: string) => void
  onSearch: () => void
  onLoadMore: () => void
  linkedCount: number
  onPublish: (productId: string, section: PeerListingSection) => void
  onUnpublish: (productId: string) => void
  onViewLinked?: () => void
}

export function ShopifyProductPicker({
  products,
  query,
  busyProductId,
  loading,
  hasNextPage,
  linkedCount,
  onQueryChange,
  onSearch,
  onLoadMore,
  onPublish,
  onUnpublish,
  onViewLinked,
}: ShopifyProductPickerProps) {
  const searched = query.trim() !== ""
  return (
    <section className={shopifySurfaceClass}>
      <div className={`border-b px-4 py-3 ${shopifyDividerClass}`}>
        <h2 className={shopifySectionTitleClass}>Add products from Shopify</h2>
        <p className={`mt-1 ${shopifyBodyClass}`}>
          Each Shopify variant becomes a Reswell listing. Shopify continues to
          control titles, prices, images, and inventory. New imports start as
          local pickup; add package details from My Listings before enabling shipping.
        </p>
      </div>

      <form
        className={`flex gap-2 border-b px-3 py-2 ${shopifyDividerClass}`}
        onSubmit={(event) => {
          event.preventDefault()
          onSearch()
        }}
      >
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search Shopify products"
          aria-label="Search Shopify products"
          className={shopifyFieldClass}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={loading}
          className={shopifySecondaryButtonClass}
        >
          <Search aria-hidden />
          Search
        </Button>
      </form>

      {products.length > 0 ? (
        <ul className="divide-y divide-[#e1e3e5] dark:divide-border">
          {products.map((product) => (
            <li key={product.id}>
              <ShopifyProductCard
                product={product}
                busy={busyProductId === product.id}
                onPublish={onPublish}
                onUnpublish={onUnpublish}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className={`px-4 py-10 text-center ${shopifyBodyClass}`}>
          {loading ? (
            <p>Loading products…</p>
          ) : searched ? (
            <p>No Shopify products match “{query.trim()}”.</p>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold text-[#202223] dark:text-foreground">
                Shopify returned no products for this store.
              </p>
              <p>
                Products deleted in Shopify no longer appear here.
                {linkedCount > 0
                  ? " Their Reswell listings are still tracked under Listings."
                  : " Add a product in Shopify, then search again."}
              </p>
              {linkedCount > 0 && onViewLinked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onViewLinked}
                  className={shopifySecondaryButtonClass}
                >
                  View {linkedCount} linked listing{linkedCount === 1 ? "" : "s"}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {hasNextPage ? (
        <div className={`border-t px-3 py-2 ${shopifyDividerClass}`}>
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
            className={shopifySecondaryButtonClass}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
