import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, Link2, Loader2, ShoppingBag, Store } from "lucide-react"
import type { SupportCaseCustomerOrder } from "@/lib/services/supportCaseCustomerContext"
import { formatCustomerUsd } from "@/lib/admin/case-customer-panel"
import { orderStatusLabel } from "@/lib/order-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type OrderRoleFilter = "all" | "buyer" | "seller"

interface CaseCustomerOrderBrowserProps {
  orders: SupportCaseCustomerOrder[]
  total: number
  hasMore: boolean
  loadingMore: boolean
  linkedOrderId: string | null
  pending: boolean
  search: string
  role: OrderRoleFilter
  onSearchChange: (value: string) => void
  onRoleChange: (role: OrderRoleFilter) => void
  onLoadMore: () => void
  onConnect: (order: SupportCaseCustomerOrder) => void
}

export function CaseCustomerOrderBrowser({
  orders,
  total,
  hasMore,
  loadingMore,
  linkedOrderId,
  pending,
  search,
  role,
  onSearchChange,
  onRoleChange,
  onLoadMore,
  onConnect,
}: CaseCustomerOrderBrowserProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Past orders
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {total} total
        </span>
      </div>
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search order number…"
        className="h-8 bg-background text-xs"
      />
      <div className="flex gap-1">
        {(["all", "buyer", "seller"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onRoleChange(value)}
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
                  {formatCustomerUsd(order.merchandiseAmount)} · {orderStatusLabel(order.status)}
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
      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full text-[11px]"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden /> : null}
          Load more orders
        </Button>
      ) : null}
    </div>
  )
}
