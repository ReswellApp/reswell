"use client"

import { AlertTriangle, Info, Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { ShopifyCatalogManagerData } from "@/lib/shopify/types"

interface ShopifyCatalogNoticeProps {
  shopDomain: string
  catalog: ShopifyCatalogManagerData
  shopifyCatalogEmpty: boolean
  busy: boolean
  onSyncNow: () => void
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

export function ShopifyCatalogNotice({
  shopDomain,
  catalog,
  shopifyCatalogEmpty,
  busy,
  onSyncNow,
}: ShopifyCatalogNoticeProps) {
  const stillLive = Math.max(
    catalog.summary.needsRemoval,
    catalog.listings.missingInShopify,
  )
  const showEmpty = shopifyCatalogEmpty && catalog.summary.total > 0
  const shopifyUnreachable = catalog.listings.shopifyCheck === "unavailable"
  if (stillLive === 0 && !showEmpty && !shopifyUnreachable) return null

  return (
    <div className="space-y-3">
      {stillLive > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {plural(stillLive, "listing")} deleted in Shopify{" "}
            {stillLive === 1 ? "is" : "are"} still live on Reswell
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Shopify no longer has these variants. Reswell removes them
              automatically on the next sync. Remove them now so buyers cannot
              check out on a product you no longer stock.
            </p>
            <Button type="button" size="sm" onClick={onSyncNow} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              )}
              Remove now
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {showEmpty ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Shopify returned no products for {shopDomain}</AlertTitle>
          <AlertDescription>
            Reswell still has {plural(catalog.summary.total, "linked variant")}{" "}
            from this store, shown below. A product deleted in Shopify disappears
            from Shopify&apos;s product list right away, so it can no longer be
            chosen here. Its Reswell listing stays in this list as “Deleted in
            Shopify” for your records and is taken off the marketplace when
            Shopify&apos;s delete notice arrives or on the next sync.
          </AlertDescription>
        </Alert>
      ) : null}

      {shopifyUnreachable ? (
        <p className="text-xs text-muted-foreground">
          Shopify could not be reached to confirm quantities and deletions.
          Showing the last synced values.
        </p>
      ) : null}
    </div>
  )
}
