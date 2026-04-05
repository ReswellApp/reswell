import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, CheckCircle2, XCircle, Clock, Package, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import {
  CLAIM_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  type ClaimStatus,
  type ClaimType,
  type PayoutMethod,
} from '@/lib/protection-constants'
import { capitalizeWords } from '@/lib/listing-labels'
import { SellerResponseForm } from './seller-response-form'

type ClaimDetail = {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  claim_type: ClaimType
  status: ClaimStatus
  description: string
  claimed_amount: number
  approved_amount: number | null
  payout_method: PayoutMethod | null
  denial_reason: string | null
  evidence_urls: string[]
  seller_response: string | null
  seller_responded_at: string | null
  reviewed_at: string | null
  paid_at: string | null
  created_at: string
  orders: {
    id: string
    amount: number
    listings: { id: string; title: string; slug: string | null; section: string } | null
  } | null
}

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  ORIGINAL_PAYMENT: 'Original payment method',
  RESWELL_CREDIT: 'Reswell Bucks',
  BANK_TRANSFER: 'Bank transfer',
}

function TimelineItem({
  icon: Icon,
  label,
  date,
  variant = 'default',
}: {
  icon: React.ElementType
  label: string
  date: string | null
  variant?: 'default' | 'success' | 'error'
}) {
  if (!date) return null
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
          variant === 'success'
            ? 'bg-green-100 dark:bg-green-900/30'
            : variant === 'error'
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-secondary'
        }`}
      >
        <Icon
          className={`h-3.5 w-3.5 ${
            variant === 'success'
              ? 'text-green-600 dark:text-green-400'
              : variant === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
          }`}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(date).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>
    </div>
  )
}

export default async function ClaimDetailPage(props: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data, error } = await supabase
    .from('purchase_protection_claims')
    .select(
      `
      id,
      order_id,
      buyer_id,
      seller_id,
      claim_type,
      status,
      description,
      claimed_amount,
      approved_amount,
      payout_method,
      denial_reason,
      evidence_urls,
      seller_response,
      seller_responded_at,
      reviewed_at,
      paid_at,
      created_at,
      orders (
        id,
        amount,
        listings ( id, title, slug, section )
      )
    `
    )
    .eq('id', claimId)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const claim = data as unknown as ClaimDetail
  const isBuyer = claim.buyer_id === user.id
  const isSeller = claim.seller_id === user.id

  const order = claim.orders
  const listing = Array.isArray(order?.listings)
    ? order?.listings[0]
    : order?.listings
  const title = listing?.title ? capitalizeWords(listing.title) : 'Your order'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={isBuyer ? '/dashboard/claims' : '/dashboard/sales'} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {isBuyer ? 'All claims' : 'Back to sales'}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h1 className="text-xl font-bold">Protection Claim</h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLAIM_STATUS_COLORS[claim.status]}`}
          >
            {CLAIM_STATUS_LABELS[claim.status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Claim #{claim.id.slice(0, 8).toUpperCase()} · {title}
        </p>
      </div>

      {/* Claim summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claim details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Claim type</p>
              <p className="font-medium mt-0.5">{CLAIM_TYPE_LABELS[claim.claim_type]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amount claimed</p>
              <p className="font-semibold tabular-nums mt-0.5">
                ${Number(claim.claimed_amount).toFixed(2)}
              </p>
            </div>
            {claim.approved_amount != null && (
              <div>
                <p className="text-xs text-muted-foreground">Approved amount</p>
                <p className="font-semibold tabular-nums text-green-600 dark:text-green-400 mt-0.5">
                  ${Number(claim.approved_amount).toFixed(2)}
                </p>
              </div>
            )}
            {claim.payout_method && (
              <div>
                <p className="text-xs text-muted-foreground">Refund method</p>
                <p className="font-medium mt-0.5">
                  {PAYOUT_METHOD_LABELS[claim.payout_method]}
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
              {claim.description}
            </p>
          </div>

          {claim.evidence_urls.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Evidence ({claim.evidence_urls.length} file{claim.evidence_urls.length > 1 ? 's' : ''})
              </p>
              <ul className="space-y-1.5">
                {claim.evidence_urls.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {claim.denial_reason && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-1">Reason for denial</p>
              <p className="text-sm text-destructive">{claim.denial_reason}</p>
              {isBuyer && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Not satisfied?{' '}
                  <Link href="/contact" className="underline text-foreground">
                    Contact us to appeal
                  </Link>{' '}
                  within 7 days.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seller response */}
      {claim.seller_response && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seller response</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="leading-relaxed whitespace-pre-line">{claim.seller_response}</p>
            {claim.seller_responded_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Responded{' '}
                {new Date(claim.seller_responded_at).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seller action form */}
      {isSeller && claim.status === 'PENDING' && !claim.seller_response && (
        <SellerResponseForm claimId={claim.id} />
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TimelineItem icon={Package} label="Claim filed" date={claim.created_at} />
          {claim.seller_responded_at && (
            <TimelineItem
              icon={Clock}
              label="Seller responded"
              date={claim.seller_responded_at}
            />
          )}
          {claim.reviewed_at && claim.status === 'APPROVED' && (
            <TimelineItem
              icon={CheckCircle2}
              label="Claim approved"
              date={claim.reviewed_at}
              variant="success"
            />
          )}
          {claim.reviewed_at && claim.status === 'DENIED' && (
            <TimelineItem
              icon={XCircle}
              label="Claim denied"
              date={claim.reviewed_at}
              variant="error"
            />
          )}
          {claim.paid_at && (
            <TimelineItem
              icon={ShieldCheck}
              label="Refund processed"
              date={claim.paid_at}
              variant="success"
            />
          )}

          {/* What happens next */}
          {claim.status === 'PENDING' && (
            <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What happens next</p>
              <p>
                We&apos;ve notified the seller and given them 48 hours to respond. Our team will
                review your claim within 3 business days.
              </p>
            </div>
          )}
          {claim.status === 'APPROVED' && !claim.paid_at && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 text-xs text-green-700 dark:text-green-400">
              <p className="font-medium mb-1">Refund in progress</p>
              <p>Your refund will appear in 3–5 business days.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related links */}
      <div className="flex flex-wrap gap-3">
        {order?.id && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/orders/${order.id}`}>View order</Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/protection-policy">Protection policy</Link>
        </Button>
      </div>
    </div>
  )
}
