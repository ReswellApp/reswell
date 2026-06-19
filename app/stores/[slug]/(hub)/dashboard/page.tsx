import Image from "next/image"
import { getStoreHubContext } from "@/lib/store-hub-access"
import {
  getStoreSalesSummary,
  listStoreCustomers,
  listStoreOrders,
} from "@/lib/db/consignmentStores"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StoreRefundButton } from "@/components/features/consignment/store-refund-button"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

export default async function StoreDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, store } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/dashboard`, slug)

  const [summary, orders, customers] = await Promise.all([
    getStoreSalesSummary(supabase, store.id),
    listStoreOrders(supabase, store.id, 25),
    listStoreCustomers(supabase, store.id, 50),
  ])

  const stats = [
    { name: "Gross sales", value: `$${summary.grossSalesUsd.toFixed(2)}` },
    { name: "Shop earnings", value: `$${summary.shopEarningsUsd.toFixed(2)}` },
    { name: "Paid to consignors", value: `$${summary.consignorPaidUsd.toFixed(2)}` },
    { name: "Orders", value: summary.orderCount.toLocaleString() },
  ]

  return (
    <>
      <StorePageHeader title="Overview" description={description} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.name}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.name}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent sales</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <div className="divide-y">
              {orders.map((o) => (
                <div key={o.orderId} className="flex items-center gap-3 py-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {o.coverUrl ? (
                      <Image src={o.coverUrl} alt={o.title} fill sizes="48px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatOrderNumForCustomer(o.orderNum, o.orderId)}
                      {o.customerName ? ` · ${o.customerName}` : ""} ·{" "}
                      {new Date(o.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={o.salesChannel === "pos" ? "default" : "secondary"}>
                    {o.salesChannel === "pos" ? "In-store" : "Online"}
                  </Badge>
                  <div className="w-28 text-right">
                    <p className="text-sm font-semibold tabular-nums">${o.amount.toFixed(2)}</p>
                    {o.shopNetEarnings != null ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        +${o.shopNetEarnings.toFixed(2)}
                      </p>
                    ) : null}
                    <div className="mt-1">
                      {o.status === "refunded" ? (
                        <Badge variant="outline">Refunded</Badge>
                      ) : o.status === "refunding" ? (
                        <span className="text-[11px] text-muted-foreground">Refund processing…</span>
                      ) : o.status === "confirmed" ? (
                        <StoreRefundButton orderId={o.orderId} amount={o.amount} />
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Customers ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No customers captured yet. Add them at checkout in the register.
            </p>
          ) : (
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  {c.phoneE164 ? (
                    <p className="shrink-0 text-xs text-muted-foreground">{c.phoneE164}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
