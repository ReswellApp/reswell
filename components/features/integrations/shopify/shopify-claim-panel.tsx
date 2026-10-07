"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, Store } from "lucide-react"
import { claimShopifyInstallAction } from "@/lib/actions/shopifyClaim"
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
  signedIn: boolean
  userEmail: string | null
  callbackError: boolean
}

export function ShopifyClaimPanel({
  preview,
  signedIn,
  userEmail,
  callbackError,
}: ShopifyClaimPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const expired =
    preview && Date.parse(preview.expiresAt) <= Date.now()

  return (
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
          <Alert>
            <AlertTitle>Install session expired</AlertTitle>
            <AlertDescription>
              Install the Reswell app from Shopify again to continue. Pending
              installs expire after 30 minutes.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground">
              {preview.shopName || preview.shopDomain}
            </p>
            <p className="text-muted-foreground">{preview.shopDomain}</p>
          </div>
        )}

        {!signedIn ? (
          <Button asChild className="w-full">
            <Link href="/login?next=%2Fshopify%2Fclaim">Sign in to continue</Link>
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{userEmail}</span>
            </p>
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
          </>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
