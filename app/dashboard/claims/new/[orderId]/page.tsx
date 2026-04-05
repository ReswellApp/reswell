import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { isProtectionWindowActive } from '@/lib/protection-constants'
import { capitalizeWords } from '@/lib/listing-labels'
import { ClaimForm } from './claim-form'

export default async function NewClaimPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/claims')
  }

  const { data: orderRow, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      amount,
      buyer_id,
      fulfillment_method,
      listings ( id, title )
    `
    )
    .eq('id', orderId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (error || !orderRow) {
    notFound()
  }

  if (orderRow.fulfillment_method === 'pickup') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={`/dashboard/orders/${orderId}`} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to order
            </Link>
          </Button>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/40 dark:bg-amber-950/20 space-y-3">
          <p className="font-semibold text-amber-900 dark:text-amber-300">
            Not eligible for Purchase Protection
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            Local pickup orders are not covered. Purchase Protection requires tracked shipping
            to verify delivery.
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            If you have an issue with this order, please contact the seller directly via{' '}
            <Link href="/messages" className="underline">
              Messages
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  const { data: existingClaim } = await supabase
    .from('purchase_protection_claims')
    .select('id, status')
    .eq('order_id', orderId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (existingClaim) {
    redirect(`/dashboard/claims/${existingClaim.id}`)
  }

  const { data: eligibility } = await supabase
    .from('protection_eligibility')
    .select('is_eligible, reason, window_closes')
    .eq('order_id', orderId)
    .maybeSingle()

  if (eligibility) {
    const windowActive = isProtectionWindowActive(eligibility.window_closes)
    if (!eligibility.is_eligible || !windowActive) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href={`/dashboard/orders/${orderId}`} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to order
              </Link>
            </Button>
          </div>
          <div className="rounded-xl border p-6 space-y-3">
            <p className="font-semibold">Not eligible for Purchase Protection</p>
            <p className="text-sm text-muted-foreground">
              {!windowActive
                ? 'The 30-day protection window has closed for this order.'
                : eligibility.reason}
            </p>
          </div>
        </div>
      )
    }
  }

  const listing = Array.isArray(orderRow.listings)
    ? orderRow.listings[0]
    : orderRow.listings

  const purchaseInfo = {
    id: orderRow.id,
    amount: Number(orderRow.amount),
    listing_title: listing?.title ? capitalizeWords(listing.title) : 'Your order',
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/orders/${orderId}`} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to order
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />
          <h1 className="text-2xl font-bold">File a protection claim</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          For order: <span className="font-medium text-foreground">{purchaseInfo.listing_title}</span>
        </p>
      </div>

      <ClaimForm purchase={purchaseInfo} />
    </div>
  )
}
