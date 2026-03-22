import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
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
}) {
  const { id } = await props.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/used/${id}/checkout`)}`)
  }

  const { listing, redirectSlug } = await findListingByParam(
    supabase,
    id,
    {
      select:
        "id, slug, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price",
      section: "used",
    },
  )

  if (!listing || listing.status !== "active") {
    notFound()
  }

  if (redirectSlug) {
    redirect(`/used/${redirectSlug}/checkout`)
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
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
          <BoardCheckoutClient listing={listing} copy={USED_CHECKOUT_COPY} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
