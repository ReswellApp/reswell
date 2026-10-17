"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  shopifyBodyClass,
  shopifyCriticalBadgeClass,
  shopifyMutedClass,
  shopifyPrimaryButtonClass,
  shopifySecondaryButtonClass,
  shopifySuccessBadgeClass,
  shopifyTitleClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { ShopifySyncStatusLine } from "@/components/features/integrations/shopify/shopify-sync-health"
import type {
  PublicShopifyConnection,
  ShopifySyncHealth,
} from "@/lib/shopify/types"

interface ShopifyPageHeaderProps {
  connection: PublicShopifyConnection | null
  showConnection: boolean
  health: ShopifySyncHealth | null
  busy: boolean
  onSync: () => void
  onDisconnect: () => void
}

export function ShopifyPageHeader({
  connection,
  showConnection,
  health,
  busy,
  onSync,
  onDisconnect,
}: ShopifyPageHeaderProps) {
  const needsReconnect =
    connection?.status === "reauthorization_required" ||
    connection?.status === "error"
  const reconnectHref = connection
    ? `/api/integrations/shopify/connect?shop=${encodeURIComponent(connection.shop_domain)}`
    : null
  const shopLabel = connection
    ? connection.shop_name || connection.shop_domain
    : ""
  const connectionMeta = connection
    ? [
        connection.shop_name ? connection.shop_domain : null,
        connection.credential_provider === "public_oauth"
          ? "Reswell Shopify app"
          : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ")
    : ""

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={shopifyTitleClass}>Shopify</h1>
          {showConnection && connection ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
              <span className="font-medium text-[#303030] dark:text-foreground">
                {shopLabel}
              </span>
              {connectionMeta ? (
                <span className={shopifyMutedClass}>· {connectionMeta}</span>
              ) : null}
              <span
                className={
                  needsReconnect ? shopifyCriticalBadgeClass : shopifySuccessBadgeClass
                }
              >
                {needsReconnect ? "Reconnect needed" : "Connected"}
              </span>
            </p>
          ) : null}
          {showConnection && needsReconnect ? (
            <p className={`mt-1 ${shopifyBodyClass}`}>
              Reconnect with the Reswell Shopify app to resume syncing. Deleted
              Shopify products are still removed from Reswell.
            </p>
          ) : null}
        </div>

        {showConnection && connection && reconnectHref ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
            {needsReconnect ? (
              <Button
                type="button"
                asChild
                disabled={busy}
                className={`${shopifyPrimaryButtonClass} w-full sm:w-auto`}
              >
                <a href={reconnectHref}>Reconnect</a>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onSync}
                disabled={busy}
                className={`${shopifyPrimaryButtonClass} w-full sm:w-auto`}
              >
                {busy ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw aria-hidden />
                )}
                Sync now
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onDisconnect}
              disabled={busy}
              className={`${shopifySecondaryButtonClass} w-full sm:w-auto`}
            >
              Disconnect
            </Button>
          </div>
        ) : null}
      </div>

      {showConnection && connection ? (
        <ShopifySyncStatusLine connection={connection} health={health} />
      ) : null}
    </header>
  )
}
