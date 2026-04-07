import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { CheckoutClient, type CheckoutCopy } from "@/components/checkout-client"
import { findListingByParam } from "@/lib/listing-query"
import { listingDetailHref } from "@/lib/listing-href"
import { getProfileAddresses } from "@/app/actions/addresses"
import type { CheckoutSeller } from "@/components/checkout-client"

function listingCheckoutLoginRedirect(listingParam: string) {
  const params = new URLSearchParams()
  params.set("listing", listingParam)
  return `/checkout?${params.toString()}`
}

export default async function CheckoutPage(props: { searchParams: Promise<{ listing?: string }> }) {
  const { listing: listingParam } = await props.searchParams
  if (!listingParam?.trim()) {
    redirect("/boards")
  }

  const id = listingParam.trim()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(listingCheckoutLoginRedirect(id))}`)
  }

  const { listing, redirectSlug } = await findListingByParam(supabase, id, {
    select:
      "id, slug, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price, listing_images ( url, is_primary )",
    section: undefined,
  })

  if (!listing || (listing.status !== "active" && listing.status !== "pending_sale")) {
    notFound()
  }

  if (listing.section === "new") {
    redirect(listingDetailHref(listing))
  }

  if (redirectSlug) {
    const params = new URLSearchParams()
    params.set("listing", redirectSlug)
    redirect(`/checkout?${params.toString()}`)
  }

  if (listing.user_id === user.id) {
    redirect(listingDetailHref(listing))
  }

  if (listing.section !== "surfboards") {
    notFound()
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    notFound()
  }

  const copy: CheckoutCopy | undefined = undefined

  const { addresses: initialAddresses, error: addressesError } = await getProfileAddresses()

  const { data: sellerRow } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, seller_slug, shop_name, is_shop")
    .eq("id", listing.user_id)
    .maybeSingle()

  const seller: CheckoutSeller | null = sellerRow
    ? {
        display_name: sellerRow.display_name,
        avatar_url: sellerRow.avatar_url,
        seller_slug: sellerRow.seller_slug,
        shop_name: sellerRow.shop_name,
        is_shop: sellerRow.is_shop,
      }
    : null

  return (
    <main className="flex-1 py-8">
      <div className="container mx-auto max-w-5xl px-4">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
          <Link href={listingDetailHref(listing)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to listing
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight mb-8">Checkout</h1>

        <CheckoutClient
          listing={listing}
          copy={copy}
          buyerEmail={user.email ?? null}
          initialAddresses={addressesError ? [] : initialAddresses}
          seller={seller}
        />
      </div>
    </main>
  )
}
