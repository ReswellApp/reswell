import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert, FileText, Clock, CheckCircle, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  type DisputeReason,
  type DisputeStatus,
} from '@/lib/disputes/constants'
import { capitalizeWords } from '@/lib/listing-labels'

type DisputeRow = {
  id: string
  order_id: string | null
  reason: DisputeReason
  status: DisputeStatus
  claimed_amount: number
  approved_amount: number | null
  return_required: boolean
  return_tracking: string | null
  return_label_url: string | null
  created_at: string
  resolved_at: string | null
  deadline_at: string
  orders: {
    id: string
    amount: number
    listings: { id: string; title: string; slug: string | null; section: string } | null
  } | null
}

export default async function DisputesDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/disputes')
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
      approved_amount,
      return_required,
      return_tracking,
      return_label_url,
      created_at,
      resolved_at,
      deadline_at,
      orders (
        id,
        amount,
        listings ( id, title, slug, section )
      )
    `
    )
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (disputes ?? []) as unknown as DisputeRow[]

  const activeCount = rows.filter(
    (d) => !['RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'RESOLVED_KEEP_ITEM', 'CLOSED'].includes(d.status)
  ).length

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <h1 className="text-2xl font-bold font-mono tracking-tight">My Disputes</h1>
          {activeCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
              {activeCount} active
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Track all disputes you've opened. Reswell protects both buyers and sellers.
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
                If something goes wrong with an order, you can open a dispute from your orders page.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/orders">View orders</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((dispute) => {
            const order = dispute.orders
            const listing = Array.isArray(order?.listings)
              ? order?.listings[0]
              : order?.listings
            const title = listing?.title ? capitalizeWords(listing.title) : 'Order'
            const isResolved = ['RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'RESOLVED_KEEP_ITEM', 'CLOSED'].includes(dispute.status)
            const needsAction = ['AWAITING_BUYER', 'RETURN_REQUESTED'].includes(dispute.status)
            const deadline = new Date(dispute.deadline_at)
            const hoursLeft = Math.max(0, (deadline.getTime() - Date.now()) / (1000 * 60 * 60))
            const isUrgent = !isResolved && hoursLeft < 24

            return (
              <Card
                key={dispute.id}
                className={`transition-colors hover:border-foreground/30 ${needsAction ? 'border-orange-300 dark:border-orange-700' : ''}`}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${DISPUTE_STATUS_COLORS[dispute.status]}`}
                        >
                          {DISPUTE_STATUS_LABELS[dispute.status]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {DISPUTE_REASON_LABELS[dispute.reason]}
                        </span>
                        {needsAction && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                            Action needed
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
                        Opened{' '}
                        {new Date(dispute.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' '}· #{dispute.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        ${Number(dispute.claimed_amount).toFixed(2)}
                      </p>
                      {dispute.approved_amount != null && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Approved: ${Number(dispute.approved_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Return status strip */}
                  {dispute.return_required && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Return required
                      </span>
                      {dispute.return_label_url && (
                        <a
                          href={dispute.return_label_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline dark:text-blue-400"
                        >
                          Download label
                        </a>
                      )}
                      {dispute.return_tracking && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Tracking: {dispute.return_tracking}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Timeline dots */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Opened{' '}
                      {new Date(dispute.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {dispute.resolved_at && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        Resolved{' '}
                        {new Date(dispute.resolved_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {!isResolved && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Deadline{' '}
                        {deadline.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/disputes/${dispute.id}`}>View dispute</Link>
                    </Button>
                    {order?.id && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/orders/${order.id}`}>View order</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
