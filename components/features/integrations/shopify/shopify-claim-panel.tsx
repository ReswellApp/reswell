"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { claimShopifyInstallAction } from "@/lib/actions/shopifyClaim"
import { ShopifyAccessRequestDialog } from "@/components/features/integrations/shopify/shopify-access-request-dialog"
import { ShopifyConsentHeader } from "@/components/features/integrations/shopify/shopify-consent-header"
import { ShopifyConsentIdentity } from "@/components/features/integrations/shopify/shopify-consent-identity"
import { ShopifyConsentPermissions } from "@/components/features/integrations/shopify/shopify-consent-permissions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { ShopifyPendingInstallationPreview } from "@/lib/shopify/types"

interface ShopifyClaimPanelProps {
  preview: ShopifyPendingInstallationPreview | null
  userEmail: string | null
  shopifyConnectEnabled: boolean
  accessRequested: boolean
  callbackError: boolean
  /** Verified install-launch shop. Shown while access is still required. */
  installLaunchShop?: string | null
}

export function ShopifyClaimPanel({
  preview,
  userEmail,
  shopifyConnectEnabled,
  accessRequested,
  callbackError,
  installLaunchShop = null,
}: ShopifyClaimPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [requestOpen, setRequestOpen] = useState(!shopifyConnectEnabled)

  const expired = preview && Date.parse(preview.expiresAt) <= Date.now()
  const ready = Boolean(preview?.ready) && !expired
  const launchShop = installLaunchShop?.trim() || null
  const shopDomain = ready ? (preview?.shopDomain ?? null) : launchShop
  const shopName = ready ? (preview?.shopName ?? null) : null
  const shopLabel = shopName || shopDomain
  const cancelHref = shopDomain ? `https://${shopDomain}/admin` : "/"

  const connect = () => {
    setError(null)
    startTransition(async () => {
      const result = await claimShopifyInstallAction()
      if ("error" in result) {
        setError(result.error)
        return
      }
      window.location.assign("/dashboard/shopify?connected=1")
    })
  }

  return (
    <>
      <div className="space-y-6 rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        <ShopifyConsentHeader
          title="Connect Shopify to Reswell"
          description={
            shopLabel
              ? `Reswell will list the products you choose from ${shopLabel} and keep them in sync. Shopify stays in charge of prices and stock.`
              : "Reswell lists the products you choose and keeps them in sync. Shopify stays in charge of prices and stock."
          }
        />

        {callbackError ? (
          <Alert variant="destructive">
            <AlertTitle>Install could not be completed</AlertTitle>
            <AlertDescription>
              Return to Shopify and install the Reswell app again, then sign in here to finish.
            </AlertDescription>
          </Alert>
        ) : null}

        {!ready && !launchShop ? (
          <Alert>
            <AlertTitle>Install session expired</AlertTitle>
            <AlertDescription>
              Open the Reswell app from Shopify again to continue. Install sessions expire after
              30 minutes.
            </AlertDescription>
          </Alert>
        ) : null}

        <ShopifyConsentIdentity shopName={shopName} shopDomain={shopDomain} userEmail={userEmail} />

        <ShopifyConsentPermissions />

        {!shopifyConnectEnabled ? (
          <Alert>
            <AlertTitle>Shopify access required</AlertTitle>
            <AlertDescription>
              {accessRequested
                ? "Your request is with the Reswell team. You can connect this store once it’s approved."
                : "This account isn’t approved for Shopify yet. Request access to continue."}
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          {shopifyConnectEnabled ? (
            <Button
              type="button"
              size="lg"
              className="h-11 w-full rounded-lg text-sm"
              disabled={!ready || pending}
              onClick={connect}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {pending ? "Connecting…" : "Connect store"}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-11 w-full rounded-lg text-sm"
              variant={accessRequested ? "outline" : "default"}
              onClick={() => setRequestOpen(true)}
            >
              {accessRequested ? "View access request" : "Request Shopify access"}
            </Button>
          )}
          <a
            href={cancelHref}
            className="block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Not now
          </a>
        </div>
      </div>

      {!shopifyConnectEnabled ? (
        <ShopifyAccessRequestDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          shopLabel={shopLabel}
          alreadyRequested={accessRequested}
        />
      ) : null}
    </>
  )
}
