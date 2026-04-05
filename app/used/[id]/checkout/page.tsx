import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { BoardCheckoutClient } from "@/components/board-checkout-client"
import { findListingByParam } from "@/lib/listing-query"

const USED_CHECKOUT_COPY = {
  itemLineLabel: "Item",
  inspectNoun: "item",
  priceContextNoun: "item",
} as const

export default async function UsedCheckoutPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ offer_id?: string }>
}) {
  const { id } = await props.params
  const { offer_id } = await props.searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/used/${id}/checkout`)}`)
  }

  const { listing, redirectSlug, canonicalPath } = await findListingByParam(
    supabase,
    id,
    {
      select:
        "id, slug, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price",
      section: "used",
    },
  )

  if (!listing || (listing.status !== "active" && listing.status !== "pending_sale")) {
    notFound()
  }

  if (canonicalPath) {
    redirect(`${canonicalPath}/checkout${offer_id ? `?offer_id=${offer_id}` : ''}`)
  }

  if (redirectSlug) {
    redirect(`/used/${redirectSlug}/checkout${offer_id ? `?offer_id=${offer_id}` : ''}`)
  }

  const usedSlug = listing.slug || listing.id

  if (listing.user_id === user.id) {
    redirect(`/used/${usedSlug}`)
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    notFound()
  }

  // Load accepted offer if offer_id param is present
  let acceptedOfferAmount: number | null = null
  let acceptedOfferId: string | null = null

  if (offer_id) {
    const { data: offer } = await supabase
      .from("offers")
      .select("id, status, current_amount, buyer_id, listing_id, expires_at")
      .eq("id", offer_id)
      .eq("listing_id", listing.id)
      .eq("buyer_id", user.id)
      .eq("status", "ACCEPTED")
      .single()

    if (offer) {
      // Check it hasn't expired (24hr payment window)
      const expired = new Date(offer.expires_at).getTime() < Date.now()
      if (!expired) {
        acceptedOfferAmount = Number(offer.current_amount)
        acceptedOfferId = offer.id
      }
    }
  }

  return (
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-lg">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
            <Link href={`/used/${usedSlug}`} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to listing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold mb-1">Checkout</h1>
          <p className="text-muted-foreground mb-6">{capitalizeWords(listing.title)}</p>

          {acceptedOfferAmount !== null && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-3 text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">Offer accepted — negotiated price applied</p>
              <div className="mt-1 space-y-0.5 text-emerald-700 dark:text-emerald-400">
                <div className="flex justify-between">
                  <span>Original price</span>
                  <span className="line-through">${Number(listing.price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Your offer</span>
                  <span>${acceptedOfferAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-500">
                  <span>You saved</span>
                  <span>${(Number(listing.price) - acceptedOfferAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <BoardCheckoutClient
            listing={{
              ...listing,
              // Override listing price with agreed offer amount when present
              price: acceptedOfferAmount ?? listing.price,
            }}
            copy={USED_CHECKOUT_COPY}
            offerId={acceptedOfferId ?? undefined}
          />
        </div>
      </main>
  )
}
