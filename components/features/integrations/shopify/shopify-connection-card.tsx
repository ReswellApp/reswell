"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, Store, Unplug } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { Label } from "@/components/ui/label"
import type { PublicShopifyConnection } from "@/lib/shopify/types"

interface ShopifyConnectionCardProps {
  connection: PublicShopifyConnection | null
  busy: boolean
  publicOAuthEnabled: boolean
  manualCanaryEnabled: boolean
  appInstallUrl: string | null
  onSync: () => void
  onDisconnect: () => void
}

export function ShopifyConnectionCard({
  connection,
  busy,
  publicOAuthEnabled,
  manualCanaryEnabled,
  appInstallUrl,
  onSync,
  onDisconnect,
}: ShopifyConnectionCardProps) {
  const [shop, setShop] = useState("")
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [manualBusy, setManualBusy] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  async function submitManualConnect() {
    setManualError(null)
    setManualBusy(true)
    try {
      const response = await fetch("/api/integrations/shopify/manual-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          clientId,
          clientSecret,
        }),
      })
      const json = (await response.json()) as { error?: string }
      if (!response.ok) {
        setManualError(json.error ?? "Could not connect Shopify app")
        return
      }
      window.location.assign("/dashboard/shopify?connected=1")
    } catch {
      setManualError("Could not connect Shopify app")
    } finally {
      setManualBusy(false)
    }
  }

  if (!connection || connection.status === "disconnected") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Store className="h-5 w-5" aria-hidden />
            Connect your Shopify store
          </CardTitle>
          <CardDescription>
            {publicOAuthEnabled
              ? "Install the Reswell app from Shopify, then sign in here to link your seller account."
              : "Use the permanent your-store.myshopify.com domain for migration testing only."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {publicOAuthEnabled && appInstallUrl ? (
            <Button asChild className="w-full sm:w-auto">
              <a href={appInstallUrl} rel="noopener noreferrer">
                Install from Shopify
              </a>
            </Button>
          ) : (
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
          )}

          {manualCanaryEnabled ? (
            <Accordion type="single" collapsible className="rounded-lg border px-4">
              <AccordionItem value="manual" className="border-0">
                <AccordionTrigger className="py-3 text-sm font-medium">
                  Dev Dashboard pilot (admin-approved)
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Use client ID and secret from your Shopify Dev Dashboard app.
                    Reswell exchanges them for a short-lived token — never paste a
                    static Admin API access token.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="shopify-manual-shop">Store domain</Label>
                    <Input
                      id="shopify-manual-shop"
                      value={shop}
                      onChange={(event) => setShop(event.target.value)}
                      placeholder="your-store.myshopify.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shopify-manual-client-id">Client ID</Label>
                    <Input
                      id="shopify-manual-client-id"
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shopify-manual-client-secret">Client secret</Label>
                    <Input
                      id="shopify-manual-client-secret"
                      type="password"
                      value={clientSecret}
                      onChange={(event) => setClientSecret(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  {manualError ? (
                    <p className="text-sm text-destructive">{manualError}</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={manualBusy}
                    onClick={() => void submitManualConnect()}
                  >
                    {manualBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Connect Dev app
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  const needsReconnect =
    connection.status === "reauthorization_required" ||
    connection.status === "error"

  const reconnectHref =
    publicOAuthEnabled && appInstallUrl
      ? appInstallUrl
      : `/api/integrations/shopify/connect?shop=${encodeURIComponent(connection.shop_domain)}`

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
              {connection.credential_provider === "merchant_custom"
                ? " · Dev pilot"
                : null}
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
            <Button type="button" asChild disabled={busy}>
              <a href={reconnectHref}>Reconnect</a>
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
