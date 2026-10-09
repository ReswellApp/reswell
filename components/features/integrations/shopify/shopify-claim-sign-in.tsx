"use client"

import { AuthLandingShell } from "@/components/auth/auth-landing-shell"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { SHOPIFY_CLAIM_PATH } from "@/lib/shopify/claim-path"
import type { ShopifyPendingInstallationPreview } from "@/lib/shopify/types"

interface ShopifyClaimSignInProps {
  preview: ShopifyPendingInstallationPreview | null
}

export function ShopifyClaimSignIn({ preview }: ShopifyClaimSignInProps) {
  const shopLabel = preview?.shopName || preview?.shopDomain

  return (
    <AuthLandingShell>
      <p className="mb-3 text-sm text-muted-foreground">
        {shopLabel
          ? `Sign in to link ${shopLabel} to your Reswell account.`
          : "Sign in to finish connecting Shopify to Reswell."}
      </p>
      <LoginFormPanel redirectTo={SHOPIFY_CLAIM_PATH} variant="landing" />
    </AuthLandingShell>
  )
}
