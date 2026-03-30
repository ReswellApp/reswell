import { createServiceRoleClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CLAIM_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  PROTECTION_FUND_MINIMUM_RESERVE,
  type ClaimStatus,
  type ClaimType,
} from '@/lib/protection-constants'
import { AdminClaimActions } from './admin-claim-actions'

type AdminClaimRow = {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  claim_type: ClaimType
  status: ClaimStatus
  claimed_amount: number
  approved_amount: number | null
  denial_reason: string | null
  fraud_flags: string[]
  created_at: string
  reviewed_at: string | null
  purchases: {
    id: string
    amount: number
    fulfillment_method: string | null
  } | null
  buyer: { display_name: string | null } | null
  seller: { display_name: string | null } | null
}

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function AdminClaimsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirect=/admin/claims')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_employee) {
    redirect('/')
  }

  const adminDb = createServiceRoleClient()

  const { data: claims } = await adminDb
    .from('purchase_protection_claims')
    .select(
      `
      id,
      order_id,
      buyer_id,
      seller_id,
      claim_type,
      status,
      claimed_amount,
      approved_amount,
      denial_reason,
      fraud_flags,
      created_at,
      reviewed_at,
      purchases (
        id,
        amount,
        fulfillment_method
      ),
      buyer:profiles!purchase_protection_claims_buyer_id_fkey ( display_name ),
      seller:profiles!purchase_protection_claims_seller_id_fkey ( display_name )
    `
    )
    // PENDING first, then oldest
    .order('created_at', { ascending: true })

  const { data: fund } = await adminDb
    .from('seller_protection_fund')
    .select('balance, last_updated')
    .single()

  const allClaims = (claims ?? []) as unknown as AdminClaimRow[]

  // Sort: PENDING first, then by created_at asc
  const sorted = [...allClaims].sort((a, b) => {
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1
    if (b.status === 'PENDING' && a.status !== 'PENDING') return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const pendingCount = sorted.filter((c) => c.status === 'PENDING').length
  const fundBalance = fund?.balance ?? 0
  const fundLow = fundBalance < PROTECTION_FUND_MINIMUM_RESERVE

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h1 className="text-2xl font-bold">Purchase Protection Claims</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Review and resolve buyer protection claims.
        </p>
      </div>

      {/* Fund balance widget */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={fundLow ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20' : 'border-green-200 bg-green-50/60 dark:border-green-800/40 dark:bg-green-950/20'}>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Protection Fund Balance
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${fundLow ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-300'}`}>
              ${fundBalance.toFixed(2)}
            </p>
            {fundLow && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Below $500 reserve — payouts paused
              </p>
            )}
            {!fundLow && (
              <p className="text-xs text-muted-foreground mt-1">
                Min reserve: $500
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pending Review
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {pendingCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Awaiting decision</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Claims
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {sorted.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Claims table */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No protection claims yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((claim) => {
            const daysOpen = daysSince(claim.created_at)
            const purchase = claim.purchases
            const orderAmount = Number(purchase?.amount ?? 0)
            const isNotReceived = claim.claim_type === 'NOT_RECEIVED'
            const hasFraudFlags = claim.fraud_flags?.length > 0

            return (
              <Card
                key={claim.id}
                className={`${claim.status === 'PENDING' ? 'border-amber-200 dark:border-amber-800/40' : ''} ${hasFraudFlags ? 'ring-1 ring-red-300 dark:ring-red-800' : ''}`}
              >
                <CardContent className="pt-5 pb-4 space-y-4">
                  {/* Row 1: status + meta */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLAIM_STATUS_COLORS[claim.status]}`}
                        >
                          {CLAIM_STATUS_LABELS[claim.status]}
                        </span>
                        <span className="text-xs font-medium text-foreground">
                          {CLAIM_TYPE_LABELS[claim.claim_type]}
                        </span>
                        {isNotReceived && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            No cap
                          </span>
                        )}
                        {!isNotReceived && (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            Cap: $500
                          </span>
                        )}
                        {hasFraudFlags && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Fraud flags
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Claim #{claim.id.slice(0, 8).toUpperCase()} ·{' '}
                        {daysOpen === 0 ? 'Today' : `${daysOpen}d open`} ·{' '}
                        {new Date(claim.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        Claimed: ${Number(claim.claimed_amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order: ${orderAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: buyer/seller */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Buyer</p>
                      <p className="font-medium text-foreground mt-0.5">
                        {claim.buyer?.display_name || claim.buyer_id.slice(0, 8)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Seller</p>
                      <p className="font-medium text-foreground mt-0.5">
                        {claim.seller?.display_name || claim.seller_id.slice(0, 8)}
                      </p>
                    </div>
                  </div>

                  {/* Fraud flags — admin only */}
                  {hasFraudFlags && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-2.5 text-xs text-red-700 dark:text-red-400">
                      <p className="font-semibold mb-1">Fraud flags (internal only)</p>
                      <ul className="space-y-0.5">
                        {claim.fraud_flags.map((flag, i) => (
                          <li key={i} className="font-mono">{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Admin actions — only for PENDING claims */}
                  {claim.status === 'PENDING' && profile?.is_admin && (
                    <AdminClaimActions
                      claimId={claim.id}
                      claimType={claim.claim_type}
                      claimedAmount={Number(claim.claimed_amount)}
                      orderAmount={orderAmount}
                      fundBalance={fundBalance}
                    />
                  )}

                  {/* View link */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/claims/${claim.id}`}>View full claim</Link>
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
