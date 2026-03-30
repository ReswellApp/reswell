import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ShieldAlert,
  Zap,
  Flag,
  RotateCcw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  type DisputeReason,
  type DisputeStatus,
} from '@/lib/disputes/constants'
import { capitalizeWords } from '@/lib/listing-labels'

type AdminDisputeRow = {
  id: string
  reason: DisputeReason
  status: DisputeStatus
  claimed_amount: number
  return_required: boolean
  is_large_item: boolean
  created_at: string
  deadline_at: string
  buyer_id: string | null
  seller_id: string | null
  buyer_name?: string | null
  seller_name?: string | null
  purchases: {
    id: string
    listings: { title: string } | null
  } | null
}

type QueueCounts = {
  fast_track: number
  return_waiver: number
  fraud: number
  open: number
}

async function getAdminDisputes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  queue: string
) {
  const params = new URLSearchParams({ queue })
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  // Server-side: call DB directly for performance
  let statusFilter: string[] = []
  let reasonFilter: string | null = null

  if (queue === 'fast_track') {
    statusFilter = ['AWAITING_SELLER', 'UNDER_REVIEW', 'OPEN']
    reasonFilter = 'NOT_RECEIVED'
  } else if (queue === 'return_waiver') {
    statusFilter = ['UNDER_REVIEW']
    reasonFilter = 'DAMAGED'
  } else {
    // all open
    statusFilter = [
      'OPEN',
      'AWAITING_SELLER',
      'AWAITING_BUYER',
      'RETURN_REQUESTED',
      'RETURN_SHIPPED',
      'RETURN_RECEIVED',
      'UNDER_REVIEW',
    ]
  }

  let query = supabase
    .from('disputes')
    .select(
      `
      id,
      reason,
      status,
      claimed_amount,
      return_required,
      is_large_item,
      created_at,
      deadline_at,
      buyer_id,
      seller_id,
      purchases (
        id,
        listings ( title )
      )
    `,
      { count: 'exact' }
    )
    .in('status', statusFilter)
    .order('deadline_at', { ascending: true })
    .limit(50)

  if (reasonFilter) {
    query = query.eq('reason', reasonFilter)
  }

  const { data: disputes, count } = await query

  // Fetch names
  const userIds = [
    ...new Set([
      ...(disputes ?? []).map((d) => d.buyer_id),
      ...(disputes ?? []).map((d) => d.seller_id),
    ].filter(Boolean)),
  ] as string[]

  const { data: profiles } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  return {
    disputes: (disputes ?? []).map((d) => ({
      ...d,
      buyer_name: profileMap[d.buyer_id ?? '']?.display_name ?? null,
      seller_name: profileMap[d.seller_id ?? '']?.display_name ?? null,
    })) as AdminDisputeRow[],
    count: count ?? 0,
  }
}

async function getQueueCounts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<QueueCounts> {
  const [
    { count: fastTrack },
    { count: returnWaiver },
    { count: openCount },
  ] = await Promise.all([
    supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('reason', 'NOT_RECEIVED')
      .in('status', ['AWAITING_SELLER', 'UNDER_REVIEW', 'OPEN']),
    supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('reason', 'DAMAGED')
      .eq('status', 'UNDER_REVIEW'),
    supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '(RESOLVED_REFUND,RESOLVED_NO_REFUND,RESOLVED_KEEP_ITEM,CLOSED)'),
  ])

  // Rough fraud count: distinct disputes with flags
  const { count: fraudCount } = await supabase
    .from('dispute_flags')
    .select('dispute_id', { count: 'exact', head: true })
    .neq('flag_type', 'buyer_escalated')

  return {
    fast_track: fastTrack ?? 0,
    return_waiver: returnWaiver ?? 0,
    fraud: fraudCount ?? 0,
    open: openCount ?? 0,
  }
}

type Props = { searchParams: Promise<{ queue?: string }> }

export default async function AdminDisputesPage({ searchParams }: Props) {
  const { queue = 'all' } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_employee) {
    redirect('/dashboard')
  }

  const [{ disputes, count }, queueCounts] = await Promise.all([
    getAdminDisputes(supabase, queue),
    getQueueCounts(supabase),
  ])

  const queues = [
    {
      key: 'all',
      label: 'All open',
      count: queueCounts.open,
      icon: ShieldAlert,
      color: 'text-orange-500',
    },
    {
      key: 'fast_track',
      label: 'Fast-track',
      count: queueCounts.fast_track,
      icon: Zap,
      color: 'text-yellow-500',
      description: 'NOT_RECEIVED — same-day target',
    },
    {
      key: 'return_waiver',
      label: 'Return waiver',
      count: queueCounts.return_waiver,
      icon: RotateCcw,
      color: 'text-blue-500',
      description: 'Damaged items needing waiver decision',
    },
    {
      key: 'fraud',
      label: 'Fraud flags',
      count: queueCounts.fraud,
      icon: Flag,
      color: 'text-red-500',
      description: 'Disputes with auto-detected fraud signals',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <h1 className="text-2xl font-bold font-mono tracking-tight">Disputes</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Review and resolve buyer/seller disputes. Refunds are never released before seller confirms return.
        </p>
      </div>

      {/* Queue tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {queues.map((q) => (
          <Link key={q.key} href={`/admin/disputes?queue=${q.key}`}>
            <Card
              className={`transition-colors cursor-pointer hover:border-foreground/40 ${
                queue === q.key ? 'border-foreground' : ''
              }`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <q.icon className={`h-4 w-4 ${q.color}`} />
                  <span className="text-xl font-bold tabular-nums">{q.count}</span>
                </div>
                <p className="text-sm font-medium">{q.label}</p>
                {q.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Dispute list */}
      {disputes.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="font-semibold">All clear</p>
            <p className="text-sm text-muted-foreground">No disputes in this queue.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {count} dispute{count !== 1 ? 's' : ''} — sorted by deadline
          </p>

          {disputes.map((dispute) => {
            const purchase = Array.isArray(dispute.purchases)
              ? dispute.purchases[0]
              : dispute.purchases
            const listing = purchase
              ? Array.isArray(purchase.listings)
                ? purchase.listings[0]
                : purchase.listings
              : null
            const title = listing?.title ? capitalizeWords(listing.title) : 'Order'

            const deadline = new Date(dispute.deadline_at)
            const hoursLeft = Math.max(0, (deadline.getTime() - Date.now()) / (1000 * 60 * 60))
            const isUrgent = hoursLeft < 24
            const isOverdue = hoursLeft === 0

            return (
              <Card
                key={dispute.id}
                className={`hover:border-foreground/30 transition-colors ${
                  isOverdue
                    ? 'border-red-300 dark:border-red-700'
                    : isUrgent
                    ? 'border-orange-300 dark:border-orange-700'
                    : ''
                }`}
              >
                <CardContent className="pt-4 pb-4">
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
                        {dispute.is_large_item && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            <Package className="h-3 w-3" /> Large item
                          </span>
                        )}
                        {isUrgent && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isOverdue
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                            }`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {isOverdue ? 'Overdue' : `${Math.round(hoursLeft)}h left`}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        #{dispute.id.slice(0, 8).toUpperCase()}
                        {dispute.buyer_name && ` · Buyer: ${dispute.buyer_name}`}
                        {dispute.seller_name && ` · Seller: ${dispute.seller_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Opened{' '}
                        {new Date(dispute.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' · '}
                        Deadline{' '}
                        {deadline.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        ${Number(dispute.claimed_amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/disputes/${dispute.id}`}>Review dispute</Link>
                    </Button>
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
