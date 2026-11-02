"use client"

import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { PublicShopifyConnection } from "@/lib/shopify/types"

const bannerClass =
  "rounded-xl border border-[#e1e3e5] bg-white py-3 text-[#202223] shadow-none dark:border-border dark:bg-card dark:text-foreground"

interface ShopifyAccountStatusBannersProps {
  connection: PublicShopifyConnection | null
}

/**
 * Approval / pending / rejection banners for Sales Channel 5.7.8 and 5.7.15.
 */
export function ShopifyAccountStatusBanners({
  connection,
}: ShopifyAccountStatusBannersProps) {
  if (!connection || connection.status === "disconnected") return null

  if (
    connection.status === "reauthorization_required" ||
    connection.status === "error"
  ) {
    return (
      <Alert
        variant="destructive"
        className={`${bannerClass} border-l-4 border-l-[#d72c0d] [&>svg]:text-[#d72c0d]`}
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="text-[13px] font-semibold">
          Reswell account needs attention
        </AlertTitle>
        <AlertDescription className="text-[13px] text-[#6d7175] dark:text-muted-foreground">
          {connection.last_error?.trim() ||
            "Reconnect this Shopify store to continue publishing on Reswell."}
        </AlertDescription>
      </Alert>
    )
  }

  if (connection.billing_status !== "active") {
    return (
      <Alert className={`${bannerClass} border-l-4 border-l-[#f1c21b] [&>svg]:text-[#8a6116]`}>
        <Info className="h-4 w-4" />
        <AlertTitle className="text-[13px] font-semibold">
          Pending Reswell approval
        </AlertTitle>
        <AlertDescription className="text-[13px] text-[#6d7175] dark:text-muted-foreground">
          Your store is linked. Approve the 7% Shopify usage charge in Setup so
          products can go live on Reswell. Until then, the sales channel stays pending.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className={`${bannerClass} border-l-4 border-l-[#008060] [&>svg]:text-[#008060]`}>
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle className="text-[13px] font-semibold">
        Reswell account approved
      </AlertTitle>
      <AlertDescription className="text-[13px] text-[#6d7175] dark:text-muted-foreground">
        You can publish Shopify products to Reswell and manage them from this sales
        channel.
      </AlertDescription>
    </Alert>
  )
}
