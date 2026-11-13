import Link from "next/link"
import { Download, ExternalLink } from "lucide-react"

import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { AdminStatStrip } from "@/components/features/admin/admin-stat-strip"
import { StripeBooksPeriodFilter } from "@/components/features/admin/stripe-books-period-filter"
import { StripeBooksTables } from "@/components/features/admin/stripe-books-tables"
import { Button } from "@/components/ui/button"
import { formatAdminUsd } from "@/lib/admin/admin-user-detail-display"
import type { StripeBooksReport } from "@/lib/types/stripeBooks"
import { stripeBooksCsvHref } from "@/lib/utils/stripeBooks"
import { cn } from "@/lib/utils"

function money(cents: number): string {
  return formatAdminUsd(cents / 100)
}

function stripeDashboardHref(accountId: string | null, path: string): string {
  if (!accountId) return `https://dashboard.stripe.com${path}`
  const destination = encodeURIComponent(path)
  return `https://dashboard.stripe.com/b/${accountId}?destination=${destination}`
}

export function StripeBooksDashboard({ report }: { report: StripeBooksReport }) {
  const csvHref = stripeBooksCsvHref(report.period)
  const cardVolume = report.categories.find((row) => row.category === "card_volume")
  const transfers = report.categories.find((row) => row.category === "seller_transfer")
  const payouts = report.categories.find((row) => row.category === "platform_payout")
  const topups = report.categories.find((row) => row.category === "topup")
  const processingCents = report.feeTotals.processingFeeCents
  const connectCents = report.feeTotals.connectFeeCents
  const surplus = report.coverage.surplusCents
  const coverageTone = surplus >= 0 ? "green" : "red"

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Stripe books"
        description="Live Stripe balance, fees, Connect transfers, bank payouts, and the Reswell ledger they must reconcile to. Marketplace 7% is not a Stripe line — it stays in the platform balance until you pay sellers or payout to Mercury."
        breadcrumbs={[
          { label: "Home", href: "/admin/home" },
          { label: "Stripe books" },
        ]}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <StripeBooksPeriodFilter period={report.period} />
            <Button asChild variant="outline" size="sm">
              <a href={csvHref}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={stripeDashboardHref(report.stripeAccountId, "/balance")}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Stripe Dashboard
              </a>
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground">
        {report.livemode === false ? "Test mode. " : null}
        {report.stripeAccountId ? `Account ${report.stripeAccountId}. ` : null}
        Generated {report.generatedAtIso} · {report.period.label}
        {report.truncated ? " · listing truncated at 15,000 Stripe transactions" : null}
      </p>

      {report.balance ? (
        <AdminStatStrip
          items={[
            {
              label: "Stripe available",
              value: money(report.balance.availableCents),
              footnote: "Can transfer to sellers or payout now",
              tone: "green",
            },
            {
              label: "Stripe pending",
              value: money(report.balance.pendingCents),
              footnote: "Card charges still settling",
              tone: "amber",
            },
            {
              label: "Connect reserved",
              value: money(report.balance.connectReservedCents),
              footnote: "Held for connected accounts",
              tone: "violet",
            },
            {
              label: "Stripe total",
              value: money(report.balance.totalCents),
              footnote: "Available + pending + reserved",
              tone: "teal",
            },
          ]}
        />
      ) : null}

      <AdminStatStrip
        items={[
          {
            label: "Seller wallets available",
            value: money(report.coverage.sellerAvailableCents),
            footnote: "Cash-out demand against Stripe available",
            tone: "blue",
          },
          {
            label: "Coverage surplus",
            value: money(surplus),
            footnote:
              surplus >= 0
                ? "Available Stripe cash after seller wallets"
                : "Top up from Mercury or wait for pending to settle",
            tone: coverageTone,
          },
          {
            label: "Marketplace fee (7%)",
            value: money(report.ledger.marketplaceFeeCents),
            footnote: `${report.ledger.confirmedOrderCount} confirmed orders in period`,
            tone: "green",
          },
          {
            label: "Instant cash-out fee kept",
            value: money(report.ledger.connectTransferFeeCents),
            footnote: `${report.ledger.instantCashoutCount} instant payouts · 1.5% Reswell fee`,
            tone: "teal",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">How a card sale hits the books</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
            <li>
              Buyer is charged on the Reswell platform account (separate charges and transfers — not
              destination charges). Stripe takes ~2.9% + $0.30; Reswell absorbs that.
            </li>
            <li>
              Of the listing price, 7% is Reswell revenue and 93% is a seller payable. Shipping is
              clearing, not seller earnings.
            </li>
            <li>
              Cash-out moves Stripe cash to the seller’s Connect account, then to their bank.
              Instant keeps 1.5% on the platform.
            </li>
            <li>
              Remaining Stripe cash (fees, shipping float, unsettled charges, top-ups) can payout to
              Mercury ••••4015.
            </li>
          </ol>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Period activity vs internal ledger</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Stripe card volume</dt>
              <dd className="font-medium tabular-nums">{money(cardVolume?.amountCents ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Confirmed Stripe orders</dt>
              <dd className="font-medium tabular-nums">{money(report.ledger.cardOrderVolumeCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Stripe processing (embedded + fees)</dt>
              <dd className="font-medium tabular-nums text-rose-700 dark:text-rose-400">
                {money(-Math.abs(processingCents))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Stripe Connect fees</dt>
              <dd className="font-medium tabular-nums text-rose-700 dark:text-rose-400">
                {money(-Math.abs(connectCents))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Seller transfers (Stripe)</dt>
              <dd className="font-medium tabular-nums">{money(transfers?.netCents ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Succeeded Connect cash-outs</dt>
              <dd className="font-medium tabular-nums">{money(-report.ledger.connectTransferNetCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Payouts to bank</dt>
              <dd className="font-medium tabular-nums">{money(payouts?.netCents ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Top-ups from bank</dt>
              <dd className="font-medium tabular-nums">{money(topups?.netCents ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Shipping collected</dt>
              <dd className="font-medium tabular-nums">{money(report.ledger.shippingCollectedCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Promo (marketing)</dt>
              <dd className="font-medium tabular-nums">{money(report.ledger.promoMarketingCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Seller tip revenue</dt>
              <dd className="font-medium tabular-nums">{money(report.ledger.tipRevenueCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Net Stripe movement</dt>
              <dd
                className={cn(
                  "font-medium tabular-nums",
                  report.stripeNetChangeCents < 0 && "text-rose-700 dark:text-rose-400",
                )}
              >
                {money(report.stripeNetChangeCents)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Wallet available/pending above are current snapshot, not period-sliced.{" "}
            <Link href="/admin/wallets" className="underline underline-offset-2">
              Open wallet balances
            </Link>
            .
          </p>
        </section>
      </div>

      {report.topups.length > 0 || report.payouts.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MiniList
            title="Bank top-ups"
            empty="No top-ups in this period."
            rows={report.topups.map((row) => ({
              id: row.id,
              label: row.status,
              value: money(row.amountCents),
            }))}
          />
          <MiniList
            title="Platform payouts"
            empty="No payouts to Mercury in this period."
            rows={report.payouts.map((row) => ({
              id: row.id,
              label: `${row.status}${row.method ? ` · ${row.method}` : ""}`,
              value: money(row.amountCents),
            }))}
          />
        </div>
      ) : null}

      <StripeBooksTables report={report} />
    </div>
  )
}

function MiniList({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: Array<{ id: string; label: string; value: string }>
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.slice(0, 8).map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{row.id}</span>
              <span className="shrink-0 text-muted-foreground">{row.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
