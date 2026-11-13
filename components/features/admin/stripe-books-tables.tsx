import type { StripeBooksReport } from "@/lib/types/stripeBooks"
import { formatAdminUsd } from "@/lib/admin/admin-user-detail-display"
import { formatMonthKey } from "@/lib/utils/adminRevenueMonthly"
import { formatBusinessDateTime } from "@/lib/utils/business-timezone"
import { cn } from "@/lib/utils"

function money(cents: number): string {
  return formatAdminUsd(cents / 100)
}

function signedClass(cents: number): string {
  if (cents > 0) return "text-emerald-700 dark:text-emerald-400"
  if (cents < 0) return "text-rose-700 dark:text-rose-400"
  return "text-muted-foreground"
}

export function StripeBooksTables({ report }: { report: StripeBooksReport }) {
  const activeCategories = report.categories.filter((row) => row.count > 0)

  return (
    <div className="space-y-6">
      <section className="overflow-x-auto rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Stripe activity by account</h2>
          <p className="text-xs text-muted-foreground">
            Source of truth is Stripe balance transactions for {report.period.label}. Net is what
            moved the platform Stripe balance.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Books as</th>
              <th className="px-4 py-2 text-right font-medium">Count</th>
              <th className="px-4 py-2 text-right font-medium">Gross</th>
              <th className="px-4 py-2 text-right font-medium">Stripe fees</th>
              <th className="px-4 py-2 text-right font-medium">Net to Stripe</th>
            </tr>
          </thead>
          <tbody>
            {activeCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No Stripe balance transactions in this period.
                </td>
              </tr>
            ) : (
              activeCategories.map((row) => (
                <tr key={row.category} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{row.label}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.glAccount}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                  <td className={cn("px-4 py-2 text-right tabular-nums", signedClass(row.amountCents))}>
                    {money(row.amountCents)}
                  </td>
                  <td className={cn("px-4 py-2 text-right tabular-nums", signedClass(-row.feeCents))}>
                    {row.feeCents ? money(-row.feeCents) : "—"}
                  </td>
                  <td className={cn("px-4 py-2 text-right tabular-nums font-medium", signedClass(row.netCents))}>
                    {money(row.netCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {report.months.length > 0 ? (
        <section className="overflow-x-auto rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Month by month</h2>
          </div>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-4 py-2 text-right font-medium">Charges</th>
                <th className="px-4 py-2 text-right font-medium">Processing</th>
                <th className="px-4 py-2 text-right font-medium">Connect fees</th>
                <th className="px-4 py-2 text-right font-medium">Refunds</th>
                <th className="px-4 py-2 text-right font-medium">Seller transfers</th>
                <th className="px-4 py-2 text-right font-medium">Bank payouts</th>
                <th className="px-4 py-2 text-right font-medium">Top-ups</th>
                <th className="px-4 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((row) => (
                <tr key={row.yearMonth} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{formatMonthKey(row.yearMonth)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(row.cardVolumeCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(-row.processingFeeCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(-row.connectFeeCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(row.refundCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(row.sellerTransferCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(row.platformPayoutCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(row.topupCents)}</td>
                  <td className={cn("px-4 py-2 text-right tabular-nums font-medium", signedClass(row.netChangeCents))}>
                    {money(row.netChangeCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Recent Stripe balance transactions</h2>
          <p className="text-xs text-muted-foreground">
            Showing {report.transactions.length} of {report.transactionCount}. Export CSV for the full
            period.
          </p>
        </div>
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-right font-medium">Fees</th>
              <th className="px-4 py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {report.transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No transactions to list.
                </td>
              </tr>
            ) : (
              report.transactions.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                    {formatBusinessDateTime(row.createdIso)}
                  </td>
                  <td className="px-4 py-2">{row.categoryLabel}</td>
                  <td className="px-4 py-2">
                    <p className="max-w-[28rem] truncate">{row.description}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{row.id}</p>
                  </td>
                  <td className={cn("px-4 py-2 text-right tabular-nums", signedClass(row.amountCents))}>
                    {money(row.amountCents)}
                  </td>
                  <td className={cn("px-4 py-2 text-right tabular-nums", signedClass(-row.feeCents))}>
                    {row.feeCents ? money(-row.feeCents) : "—"}
                  </td>
                  <td className={cn("px-4 py-2 text-right tabular-nums font-medium", signedClass(row.netCents))}>
                    {money(row.netCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
