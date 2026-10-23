import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { DropoffLocationDashboardData } from "@/lib/services/dropoffLocationDashboard"
import { dashboardPageSubtitleClass, dashboardPageTitleClass } from "@/lib/utils/dashboard-display-styles"

interface DashboardDropoffLocationHomeProps {
  data: DropoffLocationDashboardData
}

export function DashboardDropoffLocationHome({ data }: DashboardDropoffLocationHomeProps) {
  const waiting =
    data.waitingCount === 1 ? "1 board waiting to ship." : `${data.waitingCount} boards waiting to ship.`

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className={dashboardPageTitleClass}>{data.location.name}</h2>
        <p className={dashboardPageSubtitleClass}>{data.location.addressLine}</p>
        {data.location.hoursNote ? (
          <p className="text-sm text-muted-foreground">{data.location.hoursNote}</p>
        ) : null}
        {data.location.phone ? <p className="text-sm text-muted-foreground">{data.location.phone}</p> : null}
        <p className="pt-2 text-sm text-foreground">{waiting}</p>
      </header>

      {data.orders.length === 0 ? (
        <p className="rounded-2xl border border-border/70 px-4 py-8 text-sm text-muted-foreground">
          No boards waiting.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 rounded-2xl border border-border/70">
          {data.orders.map((order) => (
            <li key={order.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {order.orderNumber}
                  <span className="font-normal text-muted-foreground"> · {order.title}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.deliveryLabel}
                  {order.statusLabel === "Refunding" ? " · Refunding" : ""}
                  {order.sellerName ? ` · ${order.sellerName}` : ""}
                  {order.createdLabel ? ` · ${order.createdLabel}` : ""}
                </p>
                {order.trackingNumber ? (
                  <p className="text-sm text-muted-foreground">
                    {order.trackingCarrier ? `${order.trackingCarrier} ` : ""}
                    {order.trackingNumber}
                  </p>
                ) : null}
              </div>
              {order.hasLabel ? (
                <Button asChild variant="outline" className="shrink-0">
                  <Link
                    href={`/api/dropoff-location/orders/${order.id}/shipping-label/download?inline=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Shipping label
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Label not ready</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
