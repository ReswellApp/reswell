"use client"

import { helpHubOrderStatusLine } from "@/lib/help/order-help-issues"
import type { HelpHubOrderOption } from "@/lib/services/supportCases"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SupportHubOrderPickerProps {
  orders: HelpHubOrderOption[]
  roleFilter: "all" | "buyer" | "seller"
  onRoleFilter: (role: "all" | "buyer" | "seller") => void
  onPick: (order: HelpHubOrderOption) => void
  showRoleTabs?: boolean
}

export function SupportHubOrderPicker({
  orders,
  roleFilter,
  onRoleFilter,
  onPick,
  showRoleTabs = true,
}: SupportHubOrderPickerProps) {
  return (
    <div className="space-y-4">
      {showRoleTabs ? (
        <div className="flex flex-wrap gap-2">
          {(["all", "buyer", "seller"] as const).map((role) => (
            <Button
              key={role}
              type="button"
              size="sm"
              variant={roleFilter === role ? "default" : "outline"}
              className={cn(
                "rounded-full",
                roleFilter === role && "bg-listingHeart text-white hover:bg-listingHeart/90",
              )}
              onClick={() => onRoleFilter(role)}
            >
              {role === "all" ? "All" : role === "buyer" ? "Purchases" : "Sales"}
            </Button>
          ))}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
          <p className="font-medium text-foreground">No matching orders</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Go back and pick another topic if this isn’t about a purchase or sale.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
          {orders.map((order) => (
            <li key={`${order.role}-${order.id}`}>
              <button
                type="button"
                onClick={() => onPick(order)}
                className={cn(
                  "flex h-full min-h-[5.75rem] w-full flex-col items-start justify-center rounded-2xl border border-border/70 bg-card px-4 py-4 text-left shadow-sm transition-colors",
                  "hover:border-listingHeart/35 hover:bg-listingHeart/[0.04]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart",
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {order.role === "buyer" ? "Purchase" : "Sale"}
                </span>
                <span className="mt-1 line-clamp-2 text-[15px] font-semibold text-foreground">
                  {order.title}
                </span>
                <span className="mt-1 text-[13px] text-muted-foreground">
                  {order.orderRef} · {helpHubOrderStatusLine(order)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
