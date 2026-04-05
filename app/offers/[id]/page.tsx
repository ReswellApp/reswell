import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Clock, Package } from 'lucide-react'
import { capitalizeWords } from '@/lib/listing-labels'
import { OfferThreadActions } from '@/components/offers/offer-thread-actions'
import { peerListingCheckoutHref } from '@/lib/listing-href'
import type { OfferAction, OfferStatus } from '@/lib/offers/types'

export const metadata: Metadata = { title: 'Offer Thread — Reswell' }

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function pctOfAsking(amount: number, asking: number) {
  return Math.round((amount / asking) * 100)
}

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const h = Math.floor(ms / 3_600_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h remaining`
  return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m remaining`
}

function actionLabel(action: OfferAction): string {
  const labels: Record<OfferAction, string> = {
    OFFER:    'Made an offer',
    COUNTER:  'Countered',
    ACCEPT:   'Accepted',
    DECLINE:  'Declined',
    WITHDRAW: 'Withdrew offer',
    MESSAGE:  'Sent a message',
  }
  return labels[action]
}

function actionColor(action: OfferAction): string {
  if (action === 'ACCEPT') return 'text-emerald-600 dark:text-emerald-400'
  if (action === 'DECLINE' || action === 'WITHDRAW') return 'text-red-500 dark:text-red-400'
  if (action === 'COUNTER') return 'text-amber-600 dark:text-amber-500'
  return 'text-foreground'
}

function statusBadgeVariant(status: OfferStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACCEPTED' || status === 'COMPLETED') return 'default'
  if (status === 'DECLINED' || status === 'EXPIRED' || status === 'WITHDRAWN') return 'destructive'
  if (status === 'COUNTERED') return 'secondary'
  return 'outline'
}

export default async function OfferThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/offers/${id}`)
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .select(`
      *,
      listings (
        id, title, slug, price, section,
        listing_images (url, is_primary, sort_order)
      ),
      offer_messages (
        id, sender_id, sender_role, action, amount, note, created_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !offer) notFound()

  const isBuyer = offer.buyer_id === user.id
  const isSeller = offer.seller_id === user.id

  if (!isBuyer && !isSeller) notFound()

  // Load profiles
  const profileIds = [offer.buyer_id, offer.seller_id].filter(Boolean)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', profileIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const buyerProfile = profileMap.get(offer.buyer_id)
  const sellerProfile = profileMap.get(offer.seller_id)

  const listing = Array.isArray(offer.listings) ? offer.listings[0] : offer.listings
  const messages = (offer.offer_messages ?? []).sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const askingPrice = listing ? Number(listing.price) : 0
  const primaryImage = listing?.listing_images
    ?.sort((a: { is_primary: boolean; sort_order?: number }, b: { is_primary: boolean; sort_order?: number }) =>
      (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
    )[0]?.url

  const listingSlug = listing?.slug ?? offer.listing_id
  const listingSection = listing?.section ?? 'used'
  const isActive = ['PENDING', 'COUNTERED', 'ACCEPTED'].includes(offer.status)
  const myRole = isBuyer ? 'BUYER' : 'SELLER'

  return (
    <main className="flex-1 py-8">
      <div className="container mx-auto max-w-2xl">
        {/* Back nav */}
        <Link
          href="/dashboard/offers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to offers
        </Link>

        {/* Listing summary card */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3 items-start">
              <div className="relative h-16 w-16 flex-shrink-0 rounded-md border bg-muted overflow-hidden">
                {primaryImage ? (
                  <Image src={primaryImage} alt="" fill className="object-cover" sizes="64px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${listingSection}/${listingSlug}`}
                  className="font-medium hover:underline line-clamp-1"
                >
                  {listing ? capitalizeWords(listing.title) : 'Listing removed'}
                </Link>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Asking price: <strong>{fmt(askingPrice)}</strong>
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={statusBadgeVariant(offer.status as OfferStatus)} className="text-xs">
                    {offer.status}
                  </Badge>
                  <span className="text-xs font-semibold">
                    {fmt(offer.current_amount)}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({pctOfAsking(offer.current_amount, askingPrice)}% of asking)
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {isActive && (
              <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {offer.status === 'ACCEPTED' ? 'Payment deadline:' : 'Expires:'}{' '}
                {timeLeft(offer.expires_at)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Offer thread */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Offer thread</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {messages.map((msg: {
                id: string
                sender_id: string
                sender_role: string
                action: OfferAction
                amount: number | null
                note: string | null
                created_at: string
              }, idx: number) => {
                const isMe = msg.sender_id === user.id
                const profile = profileMap.get(msg.sender_id)
                const displayName = profile?.display_name?.trim() ||
                  (msg.sender_role === 'BUYER' ? 'Buyer' : 'Seller')

                return (
                  <div key={msg.id} className={`px-4 py-3 ${idx === messages.length - 1 ? '' : ''}`}>
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={profile?.avatar_url ?? ''} />
                        <AvatarFallback className="text-xs">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {isMe ? 'You' : displayName}
                          </span>
                          <span className={`text-xs font-medium ${actionColor(msg.action)}`}>
                            {actionLabel(msg.action)}
                          </span>
                          {msg.amount && (
                            <span className="text-sm font-bold">
                              {fmt(msg.amount)}
                              <span className="text-xs font-normal text-muted-foreground ml-1">
                                ({pctOfAsking(msg.amount, askingPrice)}% of asking)
                              </span>
                            </span>
                          )}
                        </div>
                        {msg.note && (
                          <p className="text-sm text-muted-foreground mt-0.5 italic">
                            &ldquo;{msg.note}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Buyer', profile: buyerProfile, isMe: isBuyer },
            { label: 'Seller', profile: sellerProfile, isMe: isSeller },
          ].map(({ label, profile, isMe }) => (
            <div key={label} className="flex items-center gap-2 rounded-lg border p-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={profile?.avatar_url ?? ''} />
                <AvatarFallback className="text-xs">
                  {(profile?.display_name ?? label).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium truncate">
                  {isMe ? 'You' : (profile?.display_name?.trim() || label)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions — client component handles respond/checkout */}
        {isActive && (
          <>
            <Separator className="mb-6" />
            <OfferThreadActions
              offerId={offer.id}
              status={offer.status as OfferStatus}
              currentAmount={offer.current_amount}
              askingPrice={askingPrice}
              myRole={myRole}
              counterCount={offer.counter_count}
              listingSlug={listingSlug}
              listingSection={listingSection}
            />
          </>
        )}

        {offer.status === 'ACCEPTED' && (
          <Button size="lg" className="w-full" asChild>
            <Link href={peerListingCheckoutHref(listingSection, listingSlug, offer.id)}>
              Complete purchase — {fmt(offer.current_amount)}
            </Link>
          </Button>
        )}
      </div>
    </main>
  )
}
