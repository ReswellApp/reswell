import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Tag } from 'lucide-react'
import { capitalizeWords } from '@/lib/listing-labels'
import { OfferSettingsForm } from '@/components/offers/offer-settings-form'

export default async function ListingOfferSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirect=/dashboard/listings')

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, price, user_id, status')
    .eq('id', id)
    .single()

  if (!listing || listing.user_id !== user.id) notFound()

  const { data: settings } = await supabase
    .from('offer_settings')
    .select('*')
    .eq('listing_id', id)
    .maybeSingle()

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href="/dashboard/listings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Offer Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {capitalizeWords(listing.title)} — ${Number(listing.price).toFixed(2)}
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offers & Negotiation</CardTitle>
          <CardDescription>
            Control how buyers can make offers on this listing. Set automatic thresholds
            to streamline your negotiation flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OfferSettingsForm
            listingId={id}
            askingPrice={Number(listing.price)}
            initialSettings={settings}
          />
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">How offers work</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Buyers can offer as low as 50% of your asking price</li>
            <li>Offers expire in 48 hours if not responded to</li>
            <li>You can accept, decline, or counter any offer</li>
            <li>Up to 3 rounds of counter-offers per negotiation</li>
            <li>When you accept, the buyer has 24 hours to pay at the agreed price</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
