"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifyPrimaryButtonClass,
  shopifySecondaryButtonClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import type { PublicShopifyConnection } from "@/lib/shopify/types"

type AccountState = "connected" | "pending_billing" | "reconnect" | "disconnected"

function accountState(connection: PublicShopifyConnection | null): AccountState {
  if (!connection || connection.status === "disconnected") return "disconnected"
  if (
    connection.status === "reauthorization_required" ||
    connection.status === "error"
  ) {
    return "reconnect"
  }
  if (connection.billing_status !== "active") return "pending_billing"
  return "connected"
}

interface ShopifyAccountConnectionPanelProps {
  connection: PublicShopifyConnection | null
  busy?: boolean
  onDisconnect?: () => void
  manageHref?: string
}

/**
 * Always-visible account section for Sales Channel requirements 5.7.12–5.7.15.
 * Labelled with the channel name (Reswell) and account status.
 */
export function ShopifyAccountConnectionPanel({
  connection,
  busy = false,
  onDisconnect,
  manageHref = "/dashboard/shopify",
}: ShopifyAccountConnectionPanelProps) {
  const state = accountState(connection)
  const shopLabel = connection
    ? connection.shop_name || connection.shop_domain
    : null
  const reconnectHref = connection
    ? `/api/integrations/shopify/connect?shop=${encodeURIComponent(connection.shop_domain)}`
    : null

  return (
    <section className={shopifySurfaceClass} aria-label="Reswell account">
      <div className={`border-b px-5 py-4 ${shopifyDividerClass}`}>
        <h2 className={shopifySectionTitleClass}>Reswell account</h2>
        <p className={`mt-1 ${shopifyBodyClass}`}>
          Connect your Reswell seller account to publish Shopify products on the
          Reswell marketplace.
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {state === "disconnected" ? (
          <p className={shopifyBodyClass}>
            No Shopify store is linked to Reswell yet. Install the Reswell app from
            Shopify, then sign in to finish connecting.
          </p>
        ) : null}

        {state === "pending_billing" ? (
          <div className="rounded-lg border border-[#f1c21b] bg-[#fffbd8] px-3 py-2.5 text-[13px] text-[#4d4700] dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">Awaiting billing approval</p>
            <p className="mt-1">
              {shopLabel ? `${shopLabel} is linked.` : "Your store is linked."}{" "}
              Approve the 7% usage charge in Setup before products can publish on
              Reswell.
            </p>
          </div>
        ) : null}

        {state === "reconnect" ? (
          <div className="rounded-lg border border-[#f1c21b] bg-[#fffbd8] px-3 py-2.5 text-[13px] text-[#4d4700] dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">Reconnect required</p>
            <p className="mt-1">
              Reswell needs you to reconnect {shopLabel || "this store"} before
              publishing can continue.
            </p>
          </div>
        ) : null}

        {state === "connected" ? (
          <div className="rounded-lg border border-[#aee9d1] bg-[#f1f8f5] px-3 py-2.5 text-[13px] text-[#014b40] dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
            <p className="font-semibold">Account approved</p>
            <p className="mt-1">
              {shopLabel || "Your store"} is connected to Reswell. Choose products to
              publish from the listings tools.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {state === "reconnect" && reconnectHref ? (
            <Button type="button" asChild className={shopifyPrimaryButtonClass}>
              <a href={reconnectHref}>Reconnect store</a>
            </Button>
          ) : null}
          {state === "pending_billing" || state === "connected" ? (
            <Button type="button" asChild className={shopifyPrimaryButtonClass}>
              <a href={manageHref}>
                {state === "pending_billing" ? "Open Setup" : "Manage listings"}
              </a>
            </Button>
          ) : null}
          {connection && connection.status !== "disconnected" && onDisconnect ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onDisconnect}
              className={shopifySecondaryButtonClass}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Disconnect Reswell
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
