"use client"

import { useState } from "react"
import Image from "next/image"
import { Check, Loader2, PackageOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  shopifyFieldClass,
  shopifyMutedClass,
  shopifyPrimaryButtonClass,
  shopifyQuietDangerButtonClass,
  shopifySuccessBadgeClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import {
  PEER_LISTING_SECTION_LABELS,
  PEER_LISTING_SECTIONS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import type { ShopifyCatalogProduct } from "@/lib/shopify/types"
import { cn } from "@/lib/utils"

interface ShopifyProductCardProps {
  product: ShopifyCatalogProduct
  busy: boolean
  onPublish: (productId: string, section: PeerListingSection) => void
  onUnpublish: (productId: string) => void
}

function productPrice(product: ShopifyCatalogProduct): string {
  const values = product.variants.map((variant) => variant.price)
  if (values.length === 0) return "No price"
  const low = Math.min(...values)
  const high = Math.max(...values)
  return low === high
    ? `$${low.toFixed(2)}`
    : `$${low.toFixed(2)}–$${high.toFixed(2)}`
}

export function ShopifyProductCard({
  product,
  busy,
  onPublish,
  onUnpublish,
}: ShopifyProductCardProps) {
  const [section, setSection] = useState<PeerListingSection>(
    product.selectedSection ?? "accessories",
  )
  const stock = product.variants.reduce(
    (sum, variant) => sum + variant.available,
    0,
  )

  return (
    <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#e1e3e5] bg-[#f6f6f7] dark:border-border dark:bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className={`flex h-full items-center justify-center ${shopifyMutedClass}`}>
              <PackageOpen className="h-4 w-4" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold leading-5 text-[#202223] dark:text-foreground">
              {product.title}
            </h3>
            {product.selected ? (
              <span className={shopifySuccessBadgeClass}>
                <Check className="mr-1 h-3 w-3" aria-hidden />
                Published
              </span>
            ) : null}
          </div>
          <p className={`mt-0.5 text-[12px] leading-4 ${shopifyMutedClass}`}>
            {product.vendor || "Shopify"} · {productPrice(product)} ·{" "}
            {product.variants.length} variant
            {product.variants.length === 1 ? "" : "s"} · {stock} available
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={section}
          onValueChange={(value) => setSection(value as PeerListingSection)}
          disabled={busy}
        >
          <SelectTrigger
            className={cn(shopifyFieldClass, "sm:w-44")}
            aria-label="Reswell category"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PEER_LISTING_SECTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {PEER_LISTING_SECTION_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={() => onPublish(product.id, section)}
          disabled={busy}
          className={shopifyPrimaryButtonClass}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {product.selected ? "Update category" : "Publish on Reswell"}
        </Button>
        {product.selected ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onUnpublish(product.id)}
            disabled={busy}
            className={shopifyQuietDangerButtonClass}
          >
            Unpublish
          </Button>
        ) : null}
      </div>
    </div>
  )
}
