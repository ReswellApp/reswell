"use client"

import { AlertTriangle, Info, Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { shopifyPrimaryButtonClass } from "@/components/features/integrations/shopify/shopify-admin-styles"
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

const bannerClass =
  "rounded-lg border border-[#e1e3e5] bg-white py-3 text-[#202223] shadow-none dark:border-border dark:bg-card dark:text-foreground"

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
        <Alert
          variant="destructive"
          className={`${bannerClass} border-l-4 border-l-[#d72c0d] [&>svg]:text-[#d72c0d]`}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-[13px] font-semibold">
            {plural(stillLive, "listing")} deleted in Shopify{" "}
            {stillLive === 1 ? "is" : "are"} still live on Reswell
          </AlertTitle>
          <AlertDescription className="space-y-3 text-[13px] text-[#6d7175] dark:text-muted-foreground">
            <p>
              Shopify no longer has these variants. Reswell removes them
              automatically on the next sync. Remove them now so buyers cannot
              check out on a product you no longer stock.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={onSyncNow}
              disabled={busy}
              className={shopifyPrimaryButtonClass}
            >
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw aria-hidden />
              )}
              Remove now
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {showEmpty ? (
        <Alert className={bannerClass}>
          <Info className="h-4 w-4 text-[#6d7175]" />
          <AlertTitle className="text-[13px] font-semibold">
            Shopify returned no products for {shopDomain}
          </AlertTitle>
          <AlertDescription className="text-[13px] text-[#6d7175] dark:text-muted-foreground">
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
        <p className="text-[12px] leading-4 text-[#6d7175] dark:text-muted-foreground">
          Shopify could not be reached to confirm quantities and deletions.
          Showing the last synced values.
        </p>
      ) : null}
    </div>
  )
}
