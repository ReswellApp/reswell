import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DisputeDetailClient } from './dispute-detail-client'
import { capitalizeWords } from '@/lib/listing-labels'
import type { Dispute, DisputeMessage, DisputeEvidence } from '@/lib/disputes/types'

type Props = { params: Promise<{ id: string }> }

export default async function DisputeDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/disputes/${id}`)
  }

  const { data: disputeData, error } = await supabase
    .from('disputes')
    .select(
      `
      *,
      purchases (
        id,
        amount,
        listings ( title, slug, section )
      )
    `
    )
    .eq('id', id)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .maybeSingle()

  if (error || !disputeData) {
    notFound()
  }

  const [{ data: messages }, { data: evidence }] = await Promise.all([
    supabase
      .from('dispute_messages')
      .select('id, sender_id, sender_role, message, attachments, created_at')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('dispute_evidence')
      .select('id, uploaded_by, type, url, caption, created_at')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
  ])

  // Determine viewer role
  const viewerRole: 'buyer' | 'seller' =
    disputeData.buyer_id === user.id ? 'buyer' : 'seller'

  // Extract order info
  const purchase = Array.isArray(disputeData.purchases)
    ? disputeData.purchases[0]
    : disputeData.purchases
  const listing = purchase
    ? Array.isArray(purchase.listings)
      ? purchase.listings[0]
      : purchase.listings
    : null

  const order = purchase
    ? {
        id: purchase.id,
        amount: Number(purchase.amount),
        shipping_cost: null,
        listing_title: listing?.title ? capitalizeWords(listing.title) : 'Order',
        listing_slug: listing?.slug ?? null,
        listing_section: listing?.section ?? null,
      }
    : null

  // Strip purchases from dispute to pass clean type
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { purchases: _purchases, ...dispute } = disputeData as typeof disputeData & { purchases: unknown }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link
          href="/dashboard/disputes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> All disputes
        </Link>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight">
              {order?.listing_title ?? 'Dispute'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dispute #{id.slice(0, 8).toUpperCase()}
              {order && (
                <>
                  {' '}·{' '}
                  <Link
                    href={`/dashboard/purchases/${order.id}`}
                    className="underline hover:no-underline"
                  >
                    View order
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <DisputeDetailClient
        dispute={dispute as Dispute}
        messages={(messages ?? []) as DisputeMessage[]}
        evidence={(evidence ?? []) as DisputeEvidence[]}
        order={order}
        viewerRole={viewerRole}
        viewerId={user.id}
      />
    </div>
  )
}
