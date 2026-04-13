import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { CheckoutClient, type CheckoutCopy } from "@/components/checkout-client"
import { findListingByParam } from "@/lib/listing-query"
import { listingDetailHref } from "@/lib/listing-href"
import { capitalizeWords } from "@/lib/listing-labels"
import { getProfileAddresses } from "@/app/actions/addresses"
import type { CheckoutSeller } from "@/components/checkout-client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

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

  const listingTitle = capitalizeWords(listing.title)

  return (
    <main className="flex-1 w-full bg-muted pt-8 pb-16 md:pb-20 lg:pb-24">
      <div className="container mx-auto max-w-2xl lg:max-w-6xl">
        <h1 className="sr-only">Checkout</h1>
        <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Breadcrumb>
              <BreadcrumbList className="flex-nowrap gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href={listingDetailHref(listing)}>{listingTitle}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href="/cart">Cart</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[min(100%,18rem)] truncate font-normal text-[#5c6b89] sm:max-w-md">
                    Checkout
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

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
