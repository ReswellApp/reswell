"use client"

import { useState } from "react"
import Image from "next/image"
import { Check, Loader2 } from "lucide-react"
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
  shopifySecondaryButtonClass,
  shopifySuccessBadgeClass,
  shopifyThumbClass,
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
    <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className={shopifyThumbClass}>
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-medium leading-5 text-[#303030] dark:text-foreground">
              {product.title}
            </h3>
            {product.selected ? (
              <span className={shopifySuccessBadgeClass}>
                <Check className="mr-1 h-3 w-3" aria-hidden />
                Published
              </span>
            ) : null}
          </div>
          <p className={`mt-0.5 text-[13px] leading-5 ${shopifyMutedClass}`}>
            {product.vendor || "Shopify"} · {productPrice(product)} ·{" "}
            {product.variants.length} variant
            {product.variants.length === 1 ? "" : "s"} · {stock} available
          </p>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
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
            variant="outline"
            onClick={() => onUnpublish(product.id)}
            disabled={busy}
            className={shopifySecondaryButtonClass}
          >
            Unpublish
          </Button>
        ) : null}
      </div>
    </div>
  )
}
