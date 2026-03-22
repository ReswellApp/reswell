import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { BoardCheckoutClient } from "@/components/board-checkout-client"
import { findListingByParam } from "@/lib/listing-query"

export default async function BoardCheckoutPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/boards/${id}/checkout`)}`)
  }

  const { listing, redirectSlug } = await findListingByParam(
    supabase,
    id,
    {
      select: "id, slug, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price",
      section: "surfboards",
    },
  )

  if (!listing || listing.status !== "active") {
    notFound()
  }

  if (redirectSlug) {
    redirect(`/boards/${redirectSlug}/checkout`)
  }

  const boardSlug = listing.slug || listing.id

  if (listing.user_id === user.id) {
    redirect(`/boards/${boardSlug}`)
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    notFound()
  }

  return (
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-lg">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
            <Link href={`/boards/${boardSlug}`} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to listing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold mb-1">Checkout</h1>
          <p className="text-muted-foreground mb-6">
            {capitalizeWords(listing.title)}
          </p>
          <BoardCheckoutClient listing={listing} />
        </div>
      </main>
  )
}
