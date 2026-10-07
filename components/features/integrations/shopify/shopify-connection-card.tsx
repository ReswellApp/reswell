"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import type { PublicShopifyConnection } from "@/lib/shopify/types"

interface ShopifyConnectionCardProps {
  connection: PublicShopifyConnection | null
  busy: boolean
  onSync: () => void
  onDisconnect: () => void
}

export function ShopifyConnectionCard({
  connection,
  busy,
  onSync,
  onDisconnect,
}: ShopifyConnectionCardProps) {
  const [shop, setShop] = useState("")

  if (!connection || connection.status === "disconnected") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Store className="h-5 w-5" aria-hidden />
            Connect your Shopify store
          </CardTitle>
          <CardDescription>
            Use the permanent <strong>your-store.myshopify.com</strong> domain.
            Reswell only requests product, location, and inventory access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              const value = shop.trim()
              if (!value) return
              window.location.assign(
                `/api/integrations/shopify/connect?shop=${encodeURIComponent(value)}`,
              )
            }}
          >
            <Input
              value={shop}
              onChange={(event) => setShop(event.target.value)}
              placeholder="your-store.myshopify.com"
              aria-label="Shopify store domain"
              required
            />
            <Button type="submit" className="shrink-0">
              Connect Shopify
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  const needsReconnect =
    connection.status === "reauthorization_required" ||
    connection.status === "error"

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
            </CardDescription>
          </div>
          <Badge variant={needsReconnect ? "destructive" : "secondary"}>
            {needsReconnect ? "Reconnect needed" : "Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {connection.last_reconciled_at
            ? `Last reconciled ${new Date(connection.last_reconciled_at).toLocaleString()}`
            : "The first reconciliation will run automatically."}
        </p>
        <div className="flex flex-wrap gap-2">
          {needsReconnect ? (
            <Button
              type="button"
              onClick={() =>
                window.location.assign(
                  `/api/integrations/shopify/connect?shop=${encodeURIComponent(connection.shop_domain)}`,
                )
              }
              disabled={busy}
            >
              Reconnect
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onSync}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              )}
              Sync now
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onDisconnect}
            disabled={busy}
          >
            <Unplug className="mr-2 h-4 w-4" aria-hidden />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
