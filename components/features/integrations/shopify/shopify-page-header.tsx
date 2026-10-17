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
import type { PublicShopifyConnection } from "@/lib/shopify/types"

interface ShopifyPageHeaderProps {
  connection: PublicShopifyConnection | null
  showConnection: boolean
  busy: boolean
  onSync: () => void
  onDisconnect: () => void
}

export function ShopifyPageHeader({
  connection,
  showConnection,
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
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className={shopifyTitleClass}>Shopify</h1>
        <p className={`mt-1 max-w-xl ${shopifyBodyClass}`}>
          Sell Shopify products on Reswell. Shopify stays the source of truth
          for titles, prices, images, variants, and stock.
        </p>
        {showConnection && connection ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
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
            variant="ghost"
            onClick={onDisconnect}
            disabled={busy}
            className={`${shopifyQuietDangerButtonClass} w-full sm:w-auto`}
          >
            Disconnect
          </Button>
        </div>
      ) : null}
    </header>
  )
}
