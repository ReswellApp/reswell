"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, Link2, ShoppingBag, Store } from "lucide-react"
import type { SupportCaseCustomerOrder } from "@/lib/services/supportCaseCustomerContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type OrderRoleFilter = "all" | "buyer" | "seller"

interface CaseCustomerOrderBrowserProps {
  orders: SupportCaseCustomerOrder[]
  linkedOrderId: string | null
  pending: boolean
  onConnect: (order: SupportCaseCustomerOrder) => void
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function CaseCustomerOrderBrowser({
  orders: allOrders,
  linkedOrderId,
  pending,
  onConnect,
}: CaseCustomerOrderBrowserProps) {
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<OrderRoleFilter>("all")
  const orders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allOrders.filter((order) => {
      if (role !== "all" && order.role !== role) return false
      if (!query) return true
      return (
        order.orderRef?.toLowerCase().includes(query) ||
        order.listingTitle?.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query)
      )
    })
  }, [allOrders, role, search])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Find and connect an order
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {orders.length} shown
        </span>
      </div>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search order number or item…"
        className="h-8 bg-background text-xs"
      />
      <div className="flex gap-1">
        {(["all", "buyer", "seller"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRole(value)}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] font-medium",
              role === value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "buyer" ? "Purchases" : value === "seller" ? "Sales" : "All orders"}
          </button>
        ))}
      </div>
      <div className="max-h-72 divide-y divide-border/50 overflow-y-auto rounded-lg border border-border/60 bg-background">
        {orders.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matching orders.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="flex items-center gap-2 px-3 py-2.5">
              {order.role === "buyer" ? (
                <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden />
              ) : (
                <Store className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{order.listingTitle ?? "Order item"}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  #{order.orderRef ?? order.id.slice(0, 8)} ·{" "}
                  {format(new Date(order.createdAt), "MMM d, yyyy")} ·{" "}
                  {usd(order.merchandiseAmount)}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                <Link href={`/admin/orders/${order.id}`} aria-label="Open order">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={linkedOrderId === order.id ? "secondary" : "outline"}
                className="h-7 shrink-0 px-2 text-[10px]"
                disabled={pending || linkedOrderId === order.id}
                onClick={() => onConnect(order)}
              >
                <Link2 className="mr-1 h-3 w-3" />
                {linkedOrderId === order.id ? "Connected" : "Connect"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
