"use client"

import { ArrowDownLeft, ArrowUpRight, Banknote } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"

export function EarningsQuickReference({ stripePayoutsEnabled }: { stripePayoutsEnabled: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick reference</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium mb-1">
              <ArrowDownLeft className="h-4 w-4" /> When you sell
            </div>
            <p className="text-muted-foreground leading-relaxed">
              You keep {SELLER_SHARE_PERCENT}% after Reswell&apos;s {MARKETPLACE_FEE_PERCENT}% fee. It lands as{" "}
              <span className="text-foreground">pending</span>, then becomes{" "}
              <span className="text-foreground">ready</span> after delivery or pickup is complete.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium mb-1">
              <ArrowUpRight className="h-4 w-4" /> When you buy
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Only <span className="text-foreground">ready</span> balance can pay for another seller&apos;s listing.
              Pending earnings from your own sales are not spendable until they unlock.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium mb-1">
              <Banknote className="h-4 w-4" /> When you pay out
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {stripePayoutsEnabled
                ? "Move ready balance to your bank when Connect is set up. Minimums depend on your payout method."
                : "Bank payouts are available when Stripe Connect is enabled for this app."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
