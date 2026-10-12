"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    <section className="space-y-4">
      <div>
        <h2 className="font-headline text-xl font-semibold text-foreground">
          Add products from Shopify
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each Shopify variant becomes a Reswell listing. Shopify continues to
          control titles, prices, images, and inventory. New imports start as
          local pickup; add package details from My Listings before enabling shipping.
        </p>
      </div>

      <form
        className="flex gap-2"
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
        />
        <Button type="submit" variant="outline" disabled={loading}>
          <Search className="mr-2 h-4 w-4" aria-hidden />
          Search
        </Button>
      </form>

      {products.length > 0 ? (
        <div className="space-y-3">
          {products.map((product) => (
            <ShopifyProductCard
              key={product.id}
              product={product}
              busy={busyProductId === product.id}
              onPublish={onPublish}
              onUnpublish={onUnpublish}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {loading ? (
            <p>Loading products…</p>
          ) : searched ? (
            <p>No Shopify products match “{query.trim()}”.</p>
          ) : (
            <>
              <p className="font-medium text-foreground">
                Shopify returned no products for this store.
              </p>
              <p>
                Products deleted in Shopify no longer appear here.
                {linkedCount > 0
                  ? " Their Reswell listings are still tracked under Listings."
                  : " Add a product in Shopify, then search again."}
              </p>
              {linkedCount > 0 && onViewLinked ? (
                <Button type="button" variant="outline" size="sm" onClick={onViewLinked}>
                  View {linkedCount} linked listing{linkedCount === 1 ? "" : "s"}
                </Button>
              ) : null}
            </>
          )}
        </div>
      )}

      {hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </section>
  )
}
