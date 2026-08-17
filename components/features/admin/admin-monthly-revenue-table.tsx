import Link from 'next/link'

import type { AdminMonthlyRevenueRow } from '@/lib/types/adminBusinessInsights'
import { formatMonthKey } from '@/lib/pnl-calc'
import { cn } from '@/lib/utils'

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export interface AdminMonthlyRevenueTableProps {
  rows: AdminMonthlyRevenueRow[]
  selectedYearMonth: string | null
  className?: string
}

export function AdminMonthlyRevenueTable({
  rows,
  selectedYearMonth,
  className,
}: AdminMonthlyRevenueTableProps) {
  const hasAnySales = rows.some((r) => r.orders > 0)

  return (
    <div className={cn('rounded-2xl border border-border bg-card', className)}>
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-headline text-base font-semibold text-foreground">
          Revenue by month
        </h3>
        <p className="text-xs text-muted-foreground">
          Confirmed orders in UTC calendar months · 7% take on listing price · promo as marketing
        </p>
      </div>
      {!hasAnySales ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No confirmed sales in the last twelve months yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Month</th>
                <th className="px-5 py-3 text-right">GMV</th>
                <th className="px-5 py-3 text-right">Platform revenue</th>
                <th className="px-5 py-3 text-right">Promo (marketing)</th>
                <th className="px-5 py-3 text-right">Orders</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = selectedYearMonth === row.yearMonth
                const href = `/admin/overview?month=${encodeURIComponent(row.yearMonth)}`
                return (
                  <tr
                    key={row.yearMonth}
                    className={cn(
                      'border-b border-border/60 last:border-0',
                      active && 'bg-muted/50',
                    )}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={href}
                        className={cn(
                          'font-medium hover:underline',
                          active ? 'text-foreground' : 'text-foreground/90',
                        )}
                      >
                        {formatMonthKey(row.yearMonth)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {formatUsd(row.gmv)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatUsd(row.platformRevenue)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {formatUsd(row.marketingExpense ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {row.orders}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
