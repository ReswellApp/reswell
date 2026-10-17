"use client"

import { CheckCircle2, Loader2, RefreshCw, Store, Unplug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShopifyPluginConnectOption } from "@/components/features/integrations/shopify/shopify-plugin-connect-option"
import { ShopifySyncHealthTiles } from "@/components/features/integrations/shopify/shopify-sync-health"
import type {
  PublicShopifyConnection,
  ShopifyConnectOptions,
  ShopifySyncHealth,
} from "@/lib/shopify/types"

interface ShopifyConnectionCardProps {
  connection: PublicShopifyConnection | null
  busy: boolean
  connectOptions: ShopifyConnectOptions
  health: ShopifySyncHealth | null
  onSync: () => void
  onDisconnect: () => void
}

export function ShopifyConnectionCard({
  connection,
  busy,
  connectOptions,
  health,
  onSync,
  onDisconnect,
}: ShopifyConnectionCardProps) {
  if (!connection || connection.status === "disconnected") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Store className="h-5 w-5" aria-hidden />
            Connect your Shopify store
          </CardTitle>
          <CardDescription>
            Install the Reswell Shopify app and approve it on your store.
            Products and stock then sync to this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShopifyPluginConnectOption available={connectOptions.pluginAvailable} />
        </CardContent>
      </Card>
    )
  }

  const needsReconnect =
    connection.status === "reauthorization_required" ||
    connection.status === "error"

  const reconnectHref = `/api/integrations/shopify/connect?shop=${encodeURIComponent(connection.shop_domain)}`

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
              {connection.shop_name || connection.shop_domain}
            </CardTitle>
            <CardDescription className="mt-1">
              {connection.shop_domain}
              {connection.credential_provider === "public_oauth"
                ? " · Reswell Shopify app"
                : null}
            </CardDescription>
          </div>
          <Badge variant={needsReconnect ? "destructive" : "secondary"}>
            {needsReconnect ? "Reconnect needed" : "Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {health ? (
          <ShopifySyncHealthTiles connection={connection} health={health} />
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {needsReconnect
              ? "Reconnect with the Reswell Shopify app to resume syncing. Deleted Shopify products are still removed from Reswell."
              : "Sync now removes products deleted in Shopify and refreshes every linked variant."}
          </p>
          <div className="flex flex-wrap gap-2">
            {needsReconnect ? (
              <Button type="button" asChild disabled={busy}>
                <a href={reconnectHref}>Reconnect</a>
              </Button>
            ) : null}
            {!needsReconnect ? (
              <Button type="button" variant="outline" onClick={onSync} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                )}
                Sync now
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onDisconnect} disabled={busy}>
              <Unplug className="mr-2 h-4 w-4" aria-hidden />
              Disconnect
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
