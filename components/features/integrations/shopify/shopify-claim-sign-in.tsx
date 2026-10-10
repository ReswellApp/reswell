"use client"

import { AuthLandingShell } from "@/components/auth/auth-landing-shell"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { SHOPIFY_CONNECT_PATH } from "@/lib/shopify/claim-path"
import type { ShopifyPendingInstallationPreview } from "@/lib/shopify/types"

interface ShopifyClaimSignInProps {
  preview: ShopifyPendingInstallationPreview | null
  /** Post-login path. Install launches must keep the original query so HMAC still verifies. */
  redirectTo?: string
  shopLabel?: string | null
}

export function ShopifyClaimSignIn({
  preview,
  redirectTo = SHOPIFY_CONNECT_PATH,
  shopLabel,
}: ShopifyClaimSignInProps) {
  const label = shopLabel || preview?.shopName || preview?.shopDomain

  return (
    <AuthLandingShell>
      <p className="mb-3 text-sm text-muted-foreground">
        {label
          ? `Sign in to link ${label} to your Reswell account.`
          : "Sign in to finish connecting Shopify to Reswell."}
      </p>
      <LoginFormPanel redirectTo={redirectTo} variant="landing" />
    </AuthLandingShell>
  )
}
