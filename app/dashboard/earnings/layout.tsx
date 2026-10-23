import type { ReactNode } from "react"
import { getShopAccountContext } from "@/lib/services/accountAccess"

export default async function EarningsLayout({ children }: { children: ReactNode }) {
  const shop = await getShopAccountContext()
  if (shop && !shop.permissions.has("payouts.read")) {
    return (
      <div className="mx-auto max-w-xl space-y-2 py-6">
        <h1 className="text-[15px] font-semibold tracking-tight">Earnings stay with the owner</h1>
        <p className="text-sm text-muted-foreground">
          Your login can run {shop.shopLabel} without access to payouts. Switch back to My account to see your own earnings.
        </p>
      </div>
    )
  }
  return children
}
