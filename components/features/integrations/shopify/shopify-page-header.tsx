"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  shopifyBodyClass,
  shopifyCriticalBadgeClass,
  shopifyMutedClass,
  shopifyPrimaryButtonClass,
  shopifyQuietDangerButtonClass,
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
    <header className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className={shopifyTitleClass}>Shopify</h1>
        <p className={`mt-1 max-w-3xl ${shopifyBodyClass}`}>
          Sell Shopify products on Reswell. Shopify stays the source of truth
          for titles, prices, images, variants, and stock.
        </p>
        {showConnection && connection ? (
          <div className="mt-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
              <span className="font-semibold text-[#202223] dark:text-foreground">
                {connection.shop_name || connection.shop_domain}
              </span>
              {connectionMeta ? (
                <span className={shopifyMutedClass}>{connectionMeta}</span>
              ) : null}
              <span
                className={
                  needsReconnect ? shopifyCriticalBadgeClass : shopifySuccessBadgeClass
                }
              >
                {needsReconnect ? "Reconnect needed" : "Connected"}
              </span>
            </p>
            <ShopifySyncStatusLine connection={connection} health={health} />
            {needsReconnect ? (
              <p className={`mt-1 ${shopifyBodyClass}`}>
                Reconnect with the Reswell Shopify app to resume syncing. Deleted
                Shopify products are still removed from Reswell.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {showConnection && connection && reconnectHref ? (
        <div className="flex w-full shrink-0 flex-col gap-2 lg:w-auto lg:flex-row-reverse lg:items-center">
          {needsReconnect ? (
            <Button
              type="button"
              asChild
              disabled={busy}
              className={`${shopifyPrimaryButtonClass} w-full lg:w-auto`}
            >
              <a href={reconnectHref}>Reconnect</a>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSync}
              disabled={busy}
              className={`${shopifyPrimaryButtonClass} w-full lg:w-auto`}
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
            variant="ghost"
            onClick={onDisconnect}
            disabled={busy}
            className={`${shopifyQuietDangerButtonClass} w-full lg:w-auto`}
          >
            Disconnect
          </Button>
        </div>
      ) : null}
    </header>
  )
}
