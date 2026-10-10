"use client"

import { useState, useTransition } from "react"
import { Loader2, Store } from "lucide-react"
import { claimShopifyInstallAction } from "@/lib/actions/shopifyClaim"
import { ShopifyAccessRequestDialog } from "@/components/features/integrations/shopify/shopify-access-request-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

  const expired =
    preview && Date.parse(preview.expiresAt) <= Date.now()
  const launchShop = installLaunchShop?.trim() || null
  const shopLabel = preview?.shopName || preview?.shopDomain || launchShop

  return (
    <>
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Store className="h-5 w-5" aria-hidden />
            Link Shopify to Reswell
          </CardTitle>
          <CardDescription>
            Confirm which Reswell account should manage this Shopify store.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {callbackError ? (
            <Alert variant="destructive">
              <AlertTitle>Install could not be completed</AlertTitle>
              <AlertDescription>
                Return to Shopify and install the Reswell app again, then sign in
                here to finish linking.
              </AlertDescription>
            </Alert>
          ) : null}

          {!preview || !preview.ready || expired ? (
            launchShop ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium text-foreground">{launchShop}</p>
                <p className="text-muted-foreground">
                  This Shopify store is waiting on plugin access for your Reswell
                  account.
                </p>
              </div>
            ) : (
              <Alert>
                <AlertTitle>Install session expired</AlertTitle>
                <AlertDescription>
                  Install the Reswell app from Shopify again to continue. Pending
                  installs expire after 30 minutes.
                </AlertDescription>
              </Alert>
            )
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">
                {preview.shopName || preview.shopDomain}
              </p>
              <p className="text-muted-foreground">{preview.shopDomain}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium">{userEmail}</span>
          </p>

          {shopifyConnectEnabled ? (
            <Button
              type="button"
              className="w-full"
              disabled={!preview?.ready || expired || pending}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const result = await claimShopifyInstallAction()
                  if ("error" in result) {
                    setError(result.error)
                    return
                  }
                  window.location.assign("/dashboard/shopify?connected=1")
                })
              }}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Link this store to my Reswell account
            </Button>
          ) : (
            <>
              <Alert>
                <AlertTitle>Shopify plugin access required</AlertTitle>
                <AlertDescription>
                  {accessRequested
                    ? "Your access request is waiting on Reswell. You’ll be able to link this store after an admin approves it."
                    : "This account is not approved for the Shopify plugin. Request access to continue."}
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                className="w-full"
                variant={accessRequested ? "outline" : "default"}
                onClick={() => setRequestOpen(true)}
              >
                {accessRequested ? "View access request" : "Request Shopify plugin access"}
              </Button>
            </>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

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
