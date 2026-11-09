"use client"

import { Store } from "lucide-react"
import { signOutAndRedirect } from "@/lib/auth/sign-out-and-redirect"

interface ShopifyConsentIdentityProps {
  shopName: string | null
  shopDomain: string | null
  userEmail: string | null
}

export function ShopifyConsentIdentity({
  shopName,
  shopDomain,
  userEmail,
}: ShopifyConsentIdentityProps) {
  const initial = userEmail?.trim().charAt(0).toUpperCase() || "?"

  return (
    <div className="divide-y rounded-xl border bg-muted/30">
      {shopDomain ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Store className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {shopName || shopDomain}
            </p>
            <p className="truncate text-xs text-muted-foreground">{shopDomain}</p>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Reswell account</p>
          <p className="break-all text-sm font-medium text-foreground">{userEmail}</p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() =>
            signOutAndRedirect(`${window.location.pathname}${window.location.search}`)
          }
        >
          Switch account
        </button>
      </div>
    </div>
  )
}
