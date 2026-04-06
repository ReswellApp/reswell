import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { BoardCheckoutClient, type PeerListingCheckoutCopy } from "@/components/board-checkout-client"
import { findListingByParam } from "@/lib/listing-query"
import { listingDetailHref } from "@/lib/listing-href"

const USED_CHECKOUT_COPY: PeerListingCheckoutCopy = {
  itemLineLabel: "Item",
  inspectNoun: "item",
  priceContextNoun: "item",
} as const

function listingCheckoutLoginRedirect(listingParam: string) {
  const params = new URLSearchParams()
  params.set("listing", listingParam)
  return `/checkout/listing?${params.toString()}`
}

export default async function PeerListingCheckoutPage(props: {
  searchParams: Promise<{ listing?: string }>
}) {
  const { listing: listingParam } = await props.searchParams
  if (!listingParam?.trim()) {
    redirect("/gear")
  }

  const id = listingParam.trim()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `/auth/login?redirect=${encodeURIComponent(listingCheckoutLoginRedirect(id))}`,
    )
  }

  const { listing, redirectSlug } = await findListingByParam(supabase, id, {
    select:
      "id, slug, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price",
    section: undefined,
  })

  if (
    !listing ||
    (listing.status !== "active" && listing.status !== "pending_sale")
  ) {
    notFound()
  }

  if (listing.section === "new") {
    redirect(listingDetailHref(listing))
  }

  if (redirectSlug) {
    const params = new URLSearchParams()
    params.set("listing", redirectSlug)
    redirect(`/checkout/listing?${params.toString()}`)
  }

  if (listing.user_id === user.id) {
    redirect(listingDetailHref(listing))
  }

  if (listing.section !== "used" && listing.section !== "surfboards") {
    notFound()
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    notFound()
  }

  const copy: PeerListingCheckoutCopy | undefined =
    listing.section === "used" ? USED_CHECKOUT_COPY : undefined

  return (
    <main className="flex-1 py-8">
      <div className="container mx-auto max-w-lg">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
          <Link href={listingDetailHref(listing)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to listing
          </Link>
        </Button>
        <h1 className="text-2xl font-bold mb-1">Checkout</h1>
        <p className="text-muted-foreground mb-6">{capitalizeWords(listing.title)}</p>

        <BoardCheckoutClient listing={listing} copy={copy} />
      </div>
    </main>
  )
}
