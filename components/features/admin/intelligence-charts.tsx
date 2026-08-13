import type { AdminInsightsDailyPoint, AdminMonthlyRevenueRow } from "@/lib/types/adminBusinessInsights"
import { AdminRevenueChart } from "@/components/features/admin/admin-revenue-chart"
import { compactUsd, formatCount, formatMonthKey } from "@/components/features/admin/intelligence-format"
import { BUSINESS_TIMEZONE_LABEL } from "@/lib/utils/business-timezone"
import { cn } from "@/lib/utils"

export function IntelligenceCharts({
  daily,
  periodLabel,
  monthly,
}: {
  daily: AdminInsightsDailyPoint[]
  periodLabel: string
  monthly: AdminMonthlyRevenueRow[]
}) {
  const totalGmv = daily.reduce((sum, row) => sum + row.gmv, 0)
  const totalOrders = daily.reduce((sum, row) => sum + row.orders, 0)
  const hasSales = monthly.some((row) => row.orders > 0)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <AdminRevenueChart
        data={daily}
        chartSubtitle={`Daily GMV and platform fees · ${periodLabel} (${BUSINESS_TIMEZONE_LABEL})`}
        totalGmv={totalGmv}
        totalOrders={totalOrders}
      />
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-headline text-base font-semibold">Month over month</h3>
          <p className="text-xs text-muted-foreground">Confirmed GMV, 7% take, and promo marketing</p>
        </div>
        {!hasSales ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No confirmed sales in the last twelve months yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Month</th>
                  <th className="px-5 py-3 text-right">GMV</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right">Promo</th>
                  <th className="px-5 py-3 text-right">Orders</th>
                  <th className="px-5 py-3 text-right">MoM</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((row, index) => {
                  const older = monthly[index + 1]
                  const mom =
                    older && older.gmv > 0 ? ((row.gmv - older.gmv) / older.gmv) * 100 : null
                  return (
                    <tr key={row.yearMonth} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-2.5 font-medium">{formatMonthKey(row.yearMonth)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{compactUsd(row.gmv)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {compactUsd(row.platformRevenue)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                        {compactUsd(row.marketingExpense ?? 0)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatCount(row.orders)}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-2.5 text-right tabular-nums text-xs",
                          mom == null
                            ? "text-muted-foreground"
                            : mom >= 0
                              ? "text-emerald-600"
                              : "text-rose-600",
                        )}
                      >
                        {mom == null ? "—" : `${mom >= 0 ? "+" : ""}${mom.toFixed(0)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
