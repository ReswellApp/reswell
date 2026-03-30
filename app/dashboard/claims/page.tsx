import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, FileText, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CLAIM_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  type ClaimStatus,
  type ClaimType,
} from '@/lib/protection-constants'
import { capitalizeWords } from '@/lib/listing-labels'

type ClaimRow = {
  id: string
  order_id: string
  claim_type: ClaimType
  status: ClaimStatus
  claimed_amount: number
  approved_amount: number | null
  denial_reason: string | null
  created_at: string
  reviewed_at: string | null
  paid_at: string | null
  purchases: {
    id: string
    amount: number
    listings: { id: string; title: string; slug: string | null; section: string } | null
  } | null
}

export default async function ClaimsDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/claims')
  }

  const { data: claims } = await supabase
    .from('purchase_protection_claims')
    .select(
      `
      id,
      order_id,
      claim_type,
      status,
      claimed_amount,
      approved_amount,
      denial_reason,
      created_at,
      reviewed_at,
      paid_at,
      purchases (
        id,
        amount,
        listings ( id, title, slug, section )
      )
    `
    )
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (claims ?? []) as unknown as ClaimRow[]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h1 className="text-2xl font-bold font-mono tracking-tight">My Claims</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Track your Reswell Purchase Protection claims.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
              <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No claims yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Every order you place on Reswell is automatically protected for 30 days after delivery.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/protection-policy">Learn about protection</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((claim) => {
            const purchase = claim.purchases
            const listing = Array.isArray(purchase?.listings)
              ? purchase?.listings[0]
              : purchase?.listings
            const title = listing?.title
              ? capitalizeWords(listing.title)
              : 'Order'

            return (
              <Card key={claim.id} className="hover:border-foreground/30 transition-colors">
                <CardContent className="pt-5 pb-4">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CLAIM_STATUS_COLORS[claim.status]}`}
                        >
                          {CLAIM_STATUS_LABELS[claim.status]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {CLAIM_TYPE_LABELS[claim.claim_type]}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Filed{' '}
                        {new Date(claim.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' '}· Claim #{claim.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        ${Number(claim.claimed_amount).toFixed(2)}
                      </p>
                      {claim.approved_amount != null && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Approved: ${Number(claim.approved_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status timeline */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Filed{' '}
                      {new Date(claim.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {claim.reviewed_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Reviewed{' '}
                        {new Date(claim.reviewed_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {claim.paid_at && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <ShieldCheck className="h-3 w-3" />
                        Paid{' '}
                        {new Date(claim.paid_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>

                  {claim.denial_reason && (
                    <p className="mt-2 text-xs text-destructive/80 bg-destructive/5 rounded-md px-2 py-1.5">
                      {claim.denial_reason}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/claims/${claim.id}`}>View claim</Link>
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
          })}
        </div>
      )}
    </div>
  )
}
