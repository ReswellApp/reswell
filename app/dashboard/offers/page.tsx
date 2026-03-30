import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Tag, Clock, ArrowRight } from 'lucide-react'
import { capitalizeWords } from '@/lib/listing-labels'
import type { OfferStatus } from '@/lib/offers/types'

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
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
  return `${Math.floor(ms / 60_000)}m`
}

function statusBadgeVariant(status: OfferStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACCEPTED' || status === 'COMPLETED') return 'default'
  if (status === 'DECLINED' || status === 'EXPIRED' || status === 'WITHDRAWN') return 'destructive'
  if (status === 'COUNTERED') return 'secondary'
  return 'outline'
}

const ACTIVE_STATUSES = ['PENDING', 'COUNTERED', 'ACCEPTED']

type OfferRow = {
  id: string
  status: OfferStatus
  current_amount: number
  initial_amount: number
  counter_count: number
  expires_at: string
  created_at: string
  buyer_id: string
  seller_id: string
  listing_id: string
  listings: {
    id: string
    title: string
    slug: string | null
    price: number
    section: string
    listing_images: Array<{ url: string; is_primary: boolean | null }> | null
  } | null
}

function primaryImage(images: Array<{ url: string; is_primary: boolean | null }> | null | undefined) {
  if (!images?.length) return null
  return (images.find((i) => i.is_primary) ?? images[0]).url
}

function OfferCard({
  offer,
  perspective,
  otherPartyName,
}: {
  offer: OfferRow
  perspective: 'buyer' | 'seller'
  otherPartyName: string
}) {
  const listing = Array.isArray(offer.listings) ? offer.listings[0] : offer.listings
  const img = primaryImage(listing?.listing_images ?? null)
  const askingPrice = listing ? Number(listing.price) : 0
  const isActive = ACTIVE_STATUSES.includes(offer.status)
  const listingSlug = listing?.slug ?? offer.listing_id
  const listingSection = listing?.section ?? 'used'

  const needsAction =
    (perspective === 'seller' && offer.status === 'PENDING') ||
    (perspective === 'buyer' && offer.status === 'COUNTERED') ||
    (perspective === 'buyer' && offer.status === 'ACCEPTED')

  return (
    <Link
      href={`/offers/${offer.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className={`h-full transition-colors hover:bg-muted/40 hover:border-primary/25 ${needsAction ? 'border-amber-300 dark:border-amber-700' : ''}`}>
        <CardContent className="p-4">
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="relative h-14 w-14 flex-shrink-0 rounded-md border bg-muted overflow-hidden">
              {img ? (
                <Image src={img} alt="" fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium line-clamp-1">
                  {listing ? capitalizeWords(listing.title) : 'Listing removed'}
                </p>
                <Badge variant={statusBadgeVariant(offer.status)} className="text-xs shrink-0">
                  {offer.status}
                </Badge>
              </div>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold">{fmt(offer.current_amount)}</span>
                {askingPrice > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {pctOfAsking(offer.current_amount, askingPrice)}% of {fmt(askingPrice)}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>{perspective === 'buyer' ? `Seller: ${otherPartyName}` : `Buyer: ${otherPartyName}`}</span>
                {isActive && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {offer.status === 'ACCEPTED' ? 'Pay in' : 'Expires in'} {timeLeft(offer.expires_at)}
                  </span>
                )}
              </div>

              {needsAction && (
                <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  Action needed
                  <ArrowRight className="h-3 w-3" />
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function OffersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const offerSelect = `
    id, status, current_amount, initial_amount, counter_count,
    expires_at, created_at, buyer_id, seller_id, listing_id,
    listings (
      id, title, slug, price, section,
      listing_images (url, is_primary)
    )
  `

  // Offers received (as seller)
  const { data: receivedRaw } = await supabase
    .from('offers')
    .select(offerSelect)
    .eq('seller_id', user.id)
    .order('expires_at', { ascending: true })

  // Offers sent (as buyer)
  const { data: sentRaw } = await supabase
    .from('offers')
    .select(offerSelect)
    .eq('buyer_id', user.id)
    .order('expires_at', { ascending: true })

  const received = (receivedRaw ?? []) as unknown as OfferRow[]
  const sent = (sentRaw ?? []) as unknown as OfferRow[]

  // Load other parties' profiles
  const buyerIds = [...new Set(received.map((o) => o.buyer_id))]
  const sellerIds = [...new Set(sent.map((o) => o.seller_id))]
  const allIds = [...new Set([...buyerIds, ...sellerIds])]

  const { data: profilesData } = allIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', allIds)
    : { data: [] }

  const profileMap = new Map(
    (profilesData ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name?.trim() || 'User'])
  )

  const receivedActive = received.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const receivedPast = received.filter((o) => !ACTIVE_STATUSES.includes(o.status))
  const sentActive = sent.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const sentPast = sent.filter((o) => !ACTIVE_STATUSES.includes(o.status))

  const totalActive = receivedActive.length + sentActive.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Offers</h1>
        <p className="text-muted-foreground mt-1">
          Manage your offers — both as a buyer and a seller.
          {totalActive > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              {totalActive} need{totalActive === 1 ? 's' : ''} attention.
            </span>
          )}
        </p>
      </div>

      <Tabs defaultValue="received">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="received" className="flex-1 sm:flex-none gap-1.5">
            Received
            {receivedActive.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
                {receivedActive.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1 sm:flex-none gap-1.5">
            Sent
            {sentActive.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
                {sentActive.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── RECEIVED (seller) ───────────────────────────────────── */}
        <TabsContent value="received" className="space-y-6 mt-6">
          {received.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4 max-w-sm">
                  No offers on your listings yet. Make sure &ldquo;Accept offers&rdquo; is enabled on your listings.
                </p>
                <Button asChild>
                  <Link href="/dashboard/listings">View my listings</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {receivedActive.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Active — sorted by expiry
                  </h2>
                  <div className="space-y-3">
                    {receivedActive.map((offer) => (
                      <OfferCard
                        key={offer.id}
                        offer={offer}
                        perspective="seller"
                        otherPartyName={profileMap.get(offer.buyer_id) ?? 'Buyer'}
                      />
                    ))}
                  </div>
                </section>
              )}

              {receivedPast.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Past offers
                  </h2>
                  <div className="space-y-3">
                    {receivedPast.slice(0, 20).map((offer) => (
                      <OfferCard
                        key={offer.id}
                        offer={offer}
                        perspective="seller"
                        otherPartyName={profileMap.get(offer.buyer_id) ?? 'Buyer'}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </TabsContent>

        {/* ── SENT (buyer) ────────────────────────────────────────── */}
        <TabsContent value="sent" className="space-y-6 mt-6">
          {sent.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4 max-w-sm">
                  You haven&apos;t made any offers yet. Find gear you love and make an offer!
                </p>
                <Button asChild>
                  <Link href="/used">Browse used gear</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {sentActive.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Active
                  </h2>
                  <div className="space-y-3">
                    {sentActive.map((offer) => (
                      <OfferCard
                        key={offer.id}
                        offer={offer}
                        perspective="buyer"
                        otherPartyName={profileMap.get(offer.seller_id) ?? 'Seller'}
                      />
                    ))}
                  </div>
                </section>
              )}

              {sentPast.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Past offers
                  </h2>
                  <div className="space-y-3">
                    {sentPast.slice(0, 20).map((offer) => (
                      <OfferCard
                        key={offer.id}
                        offer={offer}
                        perspective="buyer"
                        otherPartyName={profileMap.get(offer.seller_id) ?? 'Seller'}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
