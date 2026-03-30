import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert, Package, Truck, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  isDisputeResolved,
  type DisputeReason,
  type DisputeStatus,
} from '@/lib/disputes/constants'
import { capitalizeWords } from '@/lib/listing-labels'

type SellerDisputeRow = {
  id: string
  order_id: string | null
  reason: DisputeReason
  status: DisputeStatus
  claimed_amount: number
  return_required: boolean
  return_label_url: string | null
  return_tracking: string | null
  return_shipped_at: string | null
  return_received_at: string | null
  seller_partial_amount: number | null
  created_at: string
  deadline_at: string
  purchases: {
    id: string
    amount: number
    listings: { id: string; title: string; slug: string | null; section: string } | null
  } | null
}

export default async function SellerDisputesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/sales/disputes')
  }

  const { data: disputes } = await supabase
    .from('disputes')
    .select(
      `
      id,
      order_id,
      reason,
      status,
      claimed_amount,
      return_required,
      return_label_url,
      return_tracking,
      return_shipped_at,
      return_received_at,
      seller_partial_amount,
      created_at,
      deadline_at,
      purchases (
        id,
        amount,
        listings ( id, title, slug, section )
      )
    `
    )
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (disputes ?? []) as unknown as SellerDisputeRow[]
  const active = rows.filter((d) => !isDisputeResolved(d.status))
  const resolved = rows.filter((d) => isDisputeResolved(d.status))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <h1 className="text-2xl font-bold font-mono tracking-tight">Disputes</h1>
          {active.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
              {active.length} active
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Disputes opened by buyers on your orders. Reswell ensures you get your item back before any refund is released.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
              <ShieldAlert className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No disputes</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                All clear. Disputes on your orders will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active disputes */}
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Active disputes</h2>
              {active.map((dispute) => (
                <SellerDisputeCard key={dispute.id} dispute={dispute} />
              ))}
            </div>
          )}

          {/* Resolved disputes */}
          {resolved.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Resolved ({resolved.length})
              </h2>
              {resolved.map((dispute) => (
                <SellerDisputeCard key={dispute.id} dispute={dispute} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SellerDisputeCard({ dispute }: { dispute: SellerDisputeRow }) {
  const purchase = dispute.purchases
  const listing = Array.isArray(purchase?.listings)
    ? purchase?.listings[0]
    : purchase?.listings
  const title = listing?.title ? capitalizeWords(listing.title) : 'Order'
  const isResolved = isDisputeResolved(dispute.status)

  const deadline = new Date(dispute.deadline_at)
  const hoursLeft = Math.max(0, (deadline.getTime() - Date.now()) / (1000 * 60 * 60))
  const isUrgent = !isResolved && hoursLeft < 24

  const needsSellerAction = [
    'AWAITING_SELLER',
    'RETURN_SHIPPED',
    'RETURN_RECEIVED',
  ].includes(dispute.status)

  // Return timeline for seller view
  const returnSteps = dispute.return_required
    ? [
        { label: 'Label sent', done: !!dispute.return_label_url },
        { label: 'Buyer shipped', done: !!dispute.return_tracking },
        { label: 'You receive', done: !!dispute.return_received_at },
      ]
    : []

  return (
    <Card
      className={`transition-colors hover:border-foreground/30 ${
        needsSellerAction ? 'border-orange-300 dark:border-orange-700' : ''
      }`}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  DISPUTE_STATUS_COLORS[dispute.status]
                }`}
              >
                {DISPUTE_STATUS_LABELS[dispute.status]}
              </span>
              <span className="text-xs text-muted-foreground">
                {DISPUTE_REASON_LABELS[dispute.reason]}
              </span>
              {needsSellerAction && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  Response needed
                </span>
              )}
              {isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {Math.round(hoursLeft)}h left
                </span>
              )}
            </div>
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              #{dispute.id.slice(0, 8).toUpperCase()} ·{' '}
              {new Date(dispute.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold tabular-nums">
              ${Number(dispute.claimed_amount).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">claimed</p>
          </div>
        </div>

        {/* Return mini-tracker for seller */}
        {dispute.return_required && returnSteps.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Return status</p>
            <div className="flex items-center gap-3">
              {returnSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-border flex-shrink-0" />
                  )}
                  <span
                    className={`text-xs ${
                      step.done ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < returnSteps.length - 1 && (
                    <div className="h-px w-4 bg-border flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
            {dispute.return_tracking && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Buyer tracking:{' '}
                <span className="font-mono text-foreground">{dispute.return_tracking}</span>
              </p>
            )}
          </div>
        )}

        {/* Partial proposal pending */}
        {dispute.status === 'AWAITING_BUYER' && dispute.seller_partial_amount && (
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <Clock className="h-3 w-3" />
            Partial offer of ${Number(dispute.seller_partial_amount).toFixed(2)} awaiting buyer acceptance
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/dashboard/disputes/${dispute.id}`}>
              {needsSellerAction ? 'Respond now' : 'View dispute'}
            </Link>
          </Button>
          {purchase?.id && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/dashboard/purchases/${purchase.id}`}>View order</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
