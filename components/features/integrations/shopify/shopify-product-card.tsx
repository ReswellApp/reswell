"use client"

import { useState } from "react"
import Image from "next/image"
import { Check, Loader2, PackageOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PEER_LISTING_SECTION_LABELS,
  PEER_LISTING_SECTIONS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import type { ShopifyCatalogProduct } from "@/lib/shopify/types"

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
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-28">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 112px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <PackageOpen className="h-8 w-8" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{product.title}</h3>
              {product.selected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Check className="h-3 w-3" aria-hidden />
                  Published
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.vendor || "Shopify"} · {productPrice(product)} ·{" "}
              {product.variants.length} variant
              {product.variants.length === 1 ? "" : "s"} · {stock} available
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={section}
              onValueChange={(value) => setSection(value as PeerListingSection)}
              disabled={busy}
            >
              <SelectTrigger className="sm:w-48" aria-label="Reswell category">
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
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {product.selected ? "Update category" : "Publish on Reswell"}
            </Button>
            {product.selected ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onUnpublish(product.id)}
                disabled={busy}
              >
                Unpublish
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
