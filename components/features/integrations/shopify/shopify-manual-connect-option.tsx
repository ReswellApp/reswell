"use client"

import { KeyRound, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShopifyConnectOptionPanel } from "@/components/features/integrations/shopify/shopify-connect-option-panel"
import { useShopifyManualConnect } from "@/components/features/integrations/shopify/hooks/use-shopify-manual-connect"
import type { ShopifyManualSetupState } from "@/lib/shopify/types"

interface ShopifyManualConnectOptionProps {
  state: ShopifyManualSetupState
}

const UNAVAILABLE_COPY: Record<Exclude<ShopifyManualSetupState, "available">, string> = {
  disabled:
    "Manual setup is turned off on Reswell right now. Use the Reswell Shopify app instead.",
  needs_approval:
    "Manual setup needs Reswell approval on your account. Contact Reswell support to request it, or use the Reswell Shopify app.",
}

export function ShopifyManualConnectOption({
  state,
}: ShopifyManualConnectOptionProps) {
  const form = useShopifyManualConnect()

  return (
    <ShopifyConnectOptionPanel
      icon={KeyRound}
      title="Manual setup"
      badge={state === "available" ? "Advanced" : "Unavailable"}
      description="Use your own app from the Shopify Dev Dashboard. Reswell exchanges its client ID and secret for short-lived tokens server-side."
    >
      {state === "available" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void form.submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="shopify-manual-shop">Store domain</Label>
            <Input
              id="shopify-manual-shop"
              value={form.shop}
              onChange={(event) => form.setShop(event.target.value)}
              placeholder="your-store.myshopify.com"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shopify-manual-client-id">Client ID</Label>
            <Input
              id="shopify-manual-client-id"
              value={form.clientId}
              onChange={(event) => form.setClientId(event.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shopify-manual-client-secret">Client secret</Label>
            <Input
              id="shopify-manual-client-secret"
              type="password"
              value={form.clientSecret}
              onChange={(event) => form.setClientSecret(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Find both under your app&apos;s Settings in the Dev Dashboard. The app
            needs read_products, read_inventory, and read_locations, and must be
            installed on this store. Admin API access tokens are not accepted.
          </p>
          {form.error ? (
            <p role="alert" className="text-sm text-destructive">
              {form.error}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={form.busy}>
            {form.busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {form.busy ? "Connecting…" : "Connect manually"}
          </Button>
        </form>
      ) : (
        <div className="flex gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{UNAVAILABLE_COPY[state]}</p>
        </div>
      )}
    </ShopifyConnectOptionPanel>
  )
}
