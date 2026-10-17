"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

type ReconcileSummary = {
  balanced: boolean
  settlement_count: number
  unbalanced_count: number
  buyer_spent_cents: number
  seller_pending_cents: number
  platform_fee_cents: number
  shipping_clearing_cents: number
  promo_subsidy_cents: number
  shipping_variance_cents: number
  carrier_matched_cents: number
  shipments_awaiting_label_cost: number
}

function usd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export function ReswellBucksReconcileCard() {
  const [summary, setSummary] = useState<ReconcileSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/reswell-bucks/reconcile", { credentials: "include" })
        const body = (await res.json()) as { data?: ReconcileSummary }
        if (!res.ok || !body.data) {
          if (!cancelled) setFailed(true)
          return
        }
        if (!cancelled) setSummary(body.data)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Reswell Bucks ledger</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            !summary
              ? "bg-muted text-muted-foreground"
              : summary.balanced
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-800",
          )}
        >
          {summary ? (summary.balanced ? "Balanced" : "Out of balance") : failed ? "Unavailable" : "Loading"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Admin checkout only. Each payment debits the buyer and credits the seller, the marketplace fee, and shipping
        clearing. Shipping clearing stays open until a label cost is matched.
      </p>
      {summary ? (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Settlements</dt>
            <dd className="font-medium tabular-nums">{summary.settlement_count}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Buyer spent</dt>
            <dd className="font-medium tabular-nums">{usd(summary.buyer_spent_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Seller pending</dt>
            <dd className="font-medium tabular-nums">{usd(summary.seller_pending_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Marketplace fee</dt>
            <dd className="font-medium tabular-nums">{usd(summary.platform_fee_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shipping still held</dt>
            <dd className="font-medium tabular-nums">{usd(summary.shipping_clearing_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Awaiting label cost</dt>
            <dd className="font-medium tabular-nums">{summary.shipments_awaiting_label_cost}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Promo funded</dt>
            <dd className="font-medium tabular-nums">{usd(summary.promo_subsidy_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Postage above collected</dt>
            <dd className="font-medium tabular-nums">{usd(summary.shipping_variance_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Carrier matched</dt>
            <dd className="font-medium tabular-nums">{usd(summary.carrier_matched_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Unbalanced journals</dt>
            <dd className="font-medium tabular-nums">{summary.unbalanced_count}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  )
}
