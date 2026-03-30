import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DisputeForm } from './dispute-form'
import { capitalizeWords } from '@/lib/listing-labels'

type Props = { params: Promise<{ orderId: string }> }

export default async function OpenDisputePage({ params }: Props) {
  const { orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/disputes/new/${orderId}`)
  }

  const { data: purchase } = await supabase
    .from('purchases')
    .select(
      `
      id,
      amount,
      fulfillment_method,
      status,
      listings (
        id,
        title,
        slug,
        section,
        board_type
      )
    `
    )
    .eq('id', orderId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (!purchase) {
    notFound()
  }

  if (purchase.fulfillment_method === 'pickup') {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/purchases"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to purchases
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/50 dark:bg-amber-900/20">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            Local pickup orders are not covered
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            The Reswell dispute system covers shipped orders only. For local pickup issues,
            please contact the seller directly.
          </p>
        </div>
      </div>
    )
  }

  // Check for existing dispute
  const { data: existing } = await supabase
    .from('disputes')
    .select('id')
    .eq('order_id', orderId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (existing) {
    redirect(`/dashboard/disputes/${existing.id}`)
  }

  const listing = Array.isArray(purchase.listings)
    ? purchase.listings[0]
    : purchase.listings

  const order = {
    id: purchase.id,
    amount: Number(purchase.amount),
    shipping_cost: null,
    listing_title: listing?.title ? capitalizeWords(listing.title) : 'Your order',
    listing_slug: listing?.slug ?? null,
    listing_section: listing?.section ?? null,
    // Large item = surfboard section or has a board_type
    is_large_item:
      (listing as { section?: string } | null)?.section === 'surfboards' ||
      !!(listing as { board_type?: string } | null)?.board_type,
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href={`/dashboard/purchases/${orderId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Back to order
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <h1 className="text-2xl font-bold font-mono tracking-tight">Open a dispute</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          For: <span className="text-foreground font-medium">{order.listing_title}</span>
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Reswell protects both buyers and sellers. If a refund is issued, the seller
          gets their item back first.
        </p>
      </div>

      <DisputeForm order={order} />
    </div>
  )
}
