import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { CheckoutAccountRequired } from "@/components/checkout-account-required"
import { CheckoutClient } from "@/components/checkout-client"
import type { CheckoutCopy, CheckoutListing, CheckoutSeller } from "@/components/checkout-types"
import { findListingByParam } from "@/lib/listing-query"
import { listingDetailHref } from "@/lib/listing-href"
import { capitalizeWords } from "@/lib/listing-labels"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getProfileAddresses } from "@/app/actions/addresses"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { privatePageMetadata } from "@/lib/site-metadata"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import {
  fetchCheckoutCartListingsForSeller,
  inferPeerCartSellerIdFromBuyerCart,
} from "@/lib/db/checkout-cart-bundle"
import {
  fetchAcceptedOfferById,
  findAcceptedOfferMatchingListings,
  loadAcceptedOfferCheckoutListings,
} from "@/lib/services/acceptedOfferCheckout"
import { applyAcceptedOfferToPeerCheckoutListings } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import type { PeerSurfboardCheckoutListingRow } from "@/lib/services/peerListingShippingQuote"
import { KlaviyoCheckoutStartedTracker } from "@/components/features/checkout/klaviyo-checkout-started-tracker"

export const dynamic = "force-dynamic"

export async function generateMetadata(props: {
  searchParams: Promise<{ listing?: string; from_cart?: string; offer?: string }>
}): Promise<Metadata> {
  const sp = await props.searchParams
  const path = sp.offer?.trim()
    ? `/checkout?offer=${encodeURIComponent(sp.offer.trim())}`
    : sp.from_cart === "1"
      ? "/checkout?from_cart=1"
      : sp.listing?.trim()
        ? `/checkout?listing=${encodeURIComponent(sp.listing.trim())}`
        : "/checkout"
  return privatePageMetadata({
    title: "Checkout — Reswell",
    description:
      "Confirm shipping or local pickup, review totals, and complete your surfboard purchase on Reswell.",
    path,
  })
}

function rowToCheckoutListing(row: Record<string, unknown>): CheckoutListing {
  return {
    ...(row as CheckoutListing),
    section: String((row as { section?: string | null }).section ?? "surfboards"),
  }
}

export default async function CheckoutPage(props: {
  searchParams: Promise<{ listing?: string; from_cart?: string; seller_id?: string; offer?: string }>
}) {
  const searchParams = await props.searchParams
  const fromCart = searchParams.from_cart === "1"
  const offerParam = searchParams.offer?.trim()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (offerParam) {
    const checkoutReturnPath = `/checkout?offer=${encodeURIComponent(offerParam)}`

    if (!user || isAnonymousSupabaseUser(user)) {
      redirect(`/auth/login?redirect=${encodeURIComponent(checkoutReturnPath)}`)
    }

    const offer = await fetchAcceptedOfferById(supabase, offerParam)
    if (!offer || offer.buyer_id !== user.id) {
      redirect("/messages?tab=offers")
    }

    const loaded = await loadAcceptedOfferCheckoutListings(supabase, offer)
    if (!loaded.ok) {
      redirect("/messages?tab=offers")
    }

    const checkoutListings = loaded.listings.map(rowToCheckoutListing)

    if (checkoutListings.some((l) => l.user_id === user.id)) {
      redirect("/messages?tab=offers")
    }

    const sellerId = offer.seller_id
    const { data: sellerRow } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, seller_slug, shop_name, is_shop")
      .eq("id", sellerId)
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

    const { addresses: initialAddresses, error: addressesError } = await getProfileAddresses()
    const { data: profileRow } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle()
    const buyerEmail =
      user.email?.trim() ||
      (typeof profileRow?.email === "string" ? profileRow.email.trim() : "") ||
      null

    const isBundle = checkoutListings.length > 1
    const copy: CheckoutCopy | undefined = isBundle
      ? {
          itemLineLabel: "Boards",
          inspectNoun: "boards",
          priceContextNoun: "bundle",
        }
      : undefined

    return (
      <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
        <Suspense fallback={null}>
          <KlaviyoCheckoutStartedTracker />
        </Suspense>
        <div className="container mx-auto max-w-2xl lg:max-w-6xl">
          <h1 className="sr-only">Checkout</h1>
          <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <Breadcrumb>
                <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                      <Link href="/">Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                      <Link href="/messages?tab=offers">Offers</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">Checkout</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>

          <CheckoutClient
            listings={checkoutListings}
            copy={copy}
            buyerEmail={buyerEmail}
            initialAddresses={addressesError ? [] : initialAddresses}
            seller={seller}
            offerId={offer.id}
          />
        </div>
      </main>
    )
  }

  if (fromCart) {
    const sellerIdParam = searchParams.seller_id?.trim()
    const checkoutBase =
      `/checkout?from_cart=1` + (sellerIdParam ? `&seller_id=${encodeURIComponent(sellerIdParam)}` : "")

    if (!user || isAnonymousSupabaseUser(user)) {
      redirect(`/auth/login?redirect=${encodeURIComponent(checkoutBase)}`)
    }

    let sellerId = sellerIdParam ?? ""
    if (!sellerId) {
      const inferred = await inferPeerCartSellerIdFromBuyerCart(supabase, user.id)
      if (!inferred.ok) {
        redirect("/cart")
      }
      sellerId = inferred.sellerId
      redirect(`/checkout?from_cart=1&seller_id=${encodeURIComponent(sellerId)}`)
    }

    const bundle = await fetchCheckoutCartListingsForSeller(supabase, user.id, sellerId)
    if ("error" in bundle) {
      redirect("/cart")
    }
    if (bundle.listings.length === 0) {
      redirect("/cart")
    }

    let checkoutListings = bundle.listings.map(rowToCheckoutListing)

    const pricedRows = await applyAcceptedOfferToPeerCheckoutListings(
      supabase,
      user.id,
      checkoutListings as unknown as PeerSurfboardCheckoutListingRow[],
    )
    checkoutListings = pricedRows.map(rowToCheckoutListing)

    const bundleSellerUid = checkoutListings[0]?.user_id?.trim()
    if (
      !bundleSellerUid ||
      bundleSellerUid !== sellerId ||
      checkoutListings.some((l) => (l.user_id ?? "").trim() !== bundleSellerUid)
    ) {
      redirect("/cart")
    }

    if (checkoutListings.some((l) => l.user_id === user.id)) {
      redirect("/cart")
    }

    const { data: sellerRow } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, seller_slug, shop_name, is_shop")
      .eq("id", sellerId)
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

    const { addresses: initialAddresses, error: addressesError } = await getProfileAddresses()

    const { data: profileRow } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle()

    const buyerEmail =
      user.email?.trim() ||
      (typeof profileRow?.email === "string" ? profileRow.email.trim() : "") ||
      null

    const copy: CheckoutCopy | undefined = undefined

    const matchedOffer = await findAcceptedOfferMatchingListings(
      supabase,
      user.id,
      checkoutListings.map((l) => l.id),
      sellerId,
    )

    return (
      <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
        <Suspense fallback={null}>
          <KlaviyoCheckoutStartedTracker />
        </Suspense>
        <div className="container mx-auto max-w-2xl lg:max-w-6xl">
          <h1 className="sr-only">Checkout</h1>
          <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <Breadcrumb>
                <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                      <Link href="/">Home</Link>
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
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">Checkout</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>

          <CheckoutClient
            listings={checkoutListings}
            copy={copy}
            buyerEmail={buyerEmail}
            initialAddresses={addressesError ? [] : initialAddresses}
            seller={seller}
            offerId={matchedOffer?.id ?? null}
          />
        </div>
      </main>
    )
  }

  const listingParam = searchParams.listing?.trim()
  if (!listingParam) {
    redirect("/boards")
  }

  const id = listingParam

  const { listing, redirectSlug } = await findListingByParam(supabase, id, {
    select:
      "id, slug, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price, city, state, listing_images ( url, thumbnail_url, is_primary )",
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

  const checkoutReturnPath = `/checkout?listing=${encodeURIComponent(listing.slug?.trim() ? listing.slug : listing.id)}`

  if (user && listing.user_id === user.id) {
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

  let checkoutListing = rowToCheckoutListing(listing as unknown as Record<string, unknown>)
  let matchedOfferId: string | null = null

  if (user && !isAnonymousSupabaseUser(user) && listing.user_id !== user.id) {
    const priced = await applyAcceptedOfferToPeerCheckoutListings(supabase, user.id, [
      checkoutListing as unknown as PeerSurfboardCheckoutListingRow,
    ])
    if (priced[0]) {
      checkoutListing = rowToCheckoutListing(priced[0] as unknown as Record<string, unknown>)
    }
    const matchedOffer = await findAcceptedOfferMatchingListings(
      supabase,
      user.id,
      [checkoutListing.id],
      listing.user_id,
    )
    matchedOfferId = matchedOffer?.id ?? null
  }

  const previewImpliedFulfillment: "pickup" | "shipping" = lp && sa ? "pickup" : !lp && sa ? "shipping" : "pickup"
  const previewNeedsShipping = previewImpliedFulfillment === "shipping"
  const previewResolved = resolvePayableAmount(checkoutListing, previewImpliedFulfillment)

  const previewTotals =
    previewResolved.ok
      ? {
          itemPrice: previewResolved.itemPrice,
          shipping: previewResolved.shipping,
          total: previewResolved.total,
        }
      : { itemPrice: 0, shipping: 0, total: 0 }

  const previewShippingSummaryRight = (() => {
    if (!previewNeedsShipping) {
      return <span className="text-neutral-500">Local pickup</span>
    }
    if (previewResolved.ok && previewResolved.shipping === 0) {
      return <span className="text-neutral-700">Free</span>
    }
    if (previewResolved.ok) {
      return <span className="tabular-nums text-neutral-900">${previewResolved.shipping.toFixed(2)}</span>
    }
    return <span className="text-neutral-400">—</span>
  })()

  const accountGate = !user || (user && isAnonymousSupabaseUser(user))

  if (accountGate) {
    return (
      <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
        <div className="container mx-auto max-w-2xl lg:max-w-6xl">
          <h1 className="sr-only">Checkout</h1>
          <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <Breadcrumb>
                <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
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
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">Checkout</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>

          <CheckoutAccountRequired
            listings={[checkoutListing]}
            seller={seller}
            checkoutReturnPath={checkoutReturnPath}
            previewTotals={previewTotals}
            shippingSummaryRight={previewShippingSummaryRight}
            needsShipping={previewNeedsShipping}
          />
        </div>
      </main>
    )
  }

  const { addresses: initialAddresses, error: addressesError } = await getProfileAddresses()

  const { data: profileRow } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle()

  const buyerEmail =
    user.email?.trim() ||
    (typeof profileRow?.email === "string" ? profileRow.email.trim() : "") ||
    null

  return (
    <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
      <Suspense fallback={null}>
        <KlaviyoCheckoutStartedTracker />
      </Suspense>
      <div className="container mx-auto max-w-2xl lg:max-w-6xl">
        <h1 className="sr-only">Checkout</h1>
        <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Breadcrumb>
              <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
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
                  <BreadcrumbPage className="font-normal text-[#5c6b89]">
                    Checkout
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <CheckoutClient
          listings={[checkoutListing]}
          copy={copy}
          buyerEmail={buyerEmail}
          initialAddresses={addressesError ? [] : initialAddresses}
          seller={seller}
          offerId={matchedOfferId}
        />
      </div>
    </main>
  )
}
