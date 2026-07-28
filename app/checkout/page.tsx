import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { CheckoutAccountRequired } from "@/components/checkout-account-required"
import { CheckoutClient } from "@/components/checkout-client"
import type { CheckoutListing } from "@/components/checkout-types"
import { findListingByParam } from "@/lib/listing-query"
import { isBlockedOwnListingPurchase } from "@/lib/cart-eligibility"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { resolveMixedCheckoutSellerId } from "@/lib/mixed-checkout"
import { listingDetailHref } from "@/lib/listing-href"
import { capitalizeWords } from "@/lib/listing-labels"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import {
  fetchCheckoutBuyerContext,
  fetchCheckoutSellerAndBuyerContext,
  fetchCheckoutSellerProfile,
} from "@/lib/db/checkout-page"
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
  lockedFulfillmentFromOfferAndListings,
} from "@/lib/services/acceptedOfferCheckout"
import { applyAcceptedOfferToPeerCheckoutListings } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { KlaviyoCheckoutStartedTracker } from "@/components/features/checkout/klaviyo-checkout-started-tracker"
import { assertBuyerMayPurchaseListingsExclusiveWindow } from "@/lib/services/listingBuyerExclusiveWindow"
import { peerCheckoutCopyFromSections } from "@/lib/peer-listing-item-nouns"

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
      "Confirm shipping or local pickup, review totals, and complete your purchase on Reswell.",
    path,
  })
}

function rowToCheckoutListing(
  row: Record<string, unknown>,
  quantity = 1,
): CheckoutListing {
  return {
    ...(row as CheckoutListing),
    section: String((row as { section?: string | null }).section ?? "surfboards"),
    quantity: Math.max(1, Math.floor(quantity)),
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
      redirect("/messages/offers")
    }

    const loaded = await loadAcceptedOfferCheckoutListings(supabase, offer)
    if (!loaded.ok) {
      redirect("/messages/offers")
    }

    const checkoutListings = loaded.listings.map(rowToCheckoutListing)

    if (checkoutListings.some((l) => l.user_id === user.id)) {
      redirect("/messages/offers")
    }

    const exclusiveCheck = await assertBuyerMayPurchaseListingsExclusiveWindow(
      supabase,
      checkoutListings.map((l) => l.id),
      user.id,
    )
    if (!exclusiveCheck.ok) {
      redirect("/messages/offers")
    }

    const sellerId = offer.seller_id
    const { seller, buyer } = await fetchCheckoutSellerAndBuyerContext(supabase, sellerId, user)
    const { addresses: initialAddresses, addressesError, buyerEmail, legalFullName } = buyer

    const copy = peerCheckoutCopyFromSections(
      checkoutListings.map((l) => l.section),
      checkoutListings.length,
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
                      <Link href="/messages/offers">Offers</Link>
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
            legalFullName={legalFullName}
            initialAddresses={addressesError ? [] : initialAddresses}
            seller={seller}
            offerId={offer.id}
            lockedFulfillment={loaded.fulfillment}
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
    if (bundle.lines.length === 0) {
      redirect("/cart")
    }

    const qtyById = new Map(bundle.lines.map((l) => [l.listing.id, l.quantity]))
    let checkoutListings = bundle.lines.map((l) => rowToCheckoutListing(l.listing, l.quantity))

    const pricedRows = await applyAcceptedOfferToPeerCheckoutListings(
      supabase,
      user.id,
      checkoutListings as unknown as PeerSurfboardCheckoutListingRow[],
    )
    checkoutListings = pricedRows.map((row) =>
      rowToCheckoutListing(row as unknown as Record<string, unknown>, qtyById.get(row.id) ?? 1),
    )

    const mixedSeller = resolveMixedCheckoutSellerId(
      checkoutListings.map((l) => ({
        id: l.id,
        user_id: l.user_id,
        section: l.section,
      })),
    )
    if (!mixedSeller.ok || mixedSeller.sellerId !== sellerId) {
      redirect("/cart")
    }

    if (checkoutListings.some((l) => isBlockedOwnListingPurchase(l, user.id))) {
      redirect("/cart")
    }

    const peerListingIds = checkoutListings
      .filter((l) => isPeerListingSection(l.section))
      .map((l) => l.id)
    if (peerListingIds.length > 0) {
      const exclusiveCheck = await assertBuyerMayPurchaseListingsExclusiveWindow(
        supabase,
        peerListingIds,
        user.id,
      )
      if (!exclusiveCheck.ok) {
        redirect("/cart")
      }
    }

    const orderSellerId = mixedSeller.sellerId
    const [{ seller, buyer }, matchedOffer] = await Promise.all([
      fetchCheckoutSellerAndBuyerContext(supabase, orderSellerId, user),
      findAcceptedOfferMatchingListings(
        supabase,
        user.id,
        peerListingIds,
        orderSellerId,
      ),
    ])
    const { addresses: initialAddresses, addressesError, buyerEmail, legalFullName } = buyer

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
            buyerEmail={buyerEmail}
            legalFullName={legalFullName}
            initialAddresses={addressesError ? [] : initialAddresses}
            seller={seller}
            offerId={matchedOffer?.id ?? null}
            lockedFulfillment={
              matchedOffer
                ? lockedFulfillmentFromOfferAndListings(
                    matchedOffer.fulfillment,
                    checkoutListings,
                  )
                : null
            }
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
    select: `
      ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT},
      stock_quantity,
      listing_images ( url, thumbnail_url, is_primary )
    `.trim(),
    section: undefined,
  })

  if (!listing || (listing.status !== "active" && listing.status !== "pending_sale")) {
    notFound()
  }

  if (redirectSlug) {
    const params = new URLSearchParams()
    params.set("listing", redirectSlug)
    redirect(`/checkout?${params.toString()}`)
  }

  const checkoutReturnPath = `/checkout?listing=${encodeURIComponent(listing.slug?.trim() ? listing.slug : listing.id)}`

  if (user && isBlockedOwnListingPurchase(listing, user.id)) {
    redirect(listingDetailHref(listing))
  }

  if (!isPeerListingSection(listing.section) && !isReswellShopListing(listing.section)) {
    notFound()
  }

  if (isReswellShopListing(listing.section)) {
    const stock = Math.max(0, Math.floor(Number((listing as { stock_quantity?: number }).stock_quantity) || 0))
    if (stock < 1) {
      redirect(listingDetailHref(listing))
    }
  }

  if (
    isPeerListingSection(listing.section) &&
    user &&
    !isAnonymousSupabaseUser(user)
  ) {
    const exclusiveCheck = await assertBuyerMayPurchaseListingsExclusiveWindow(
      supabase,
      [listing.id],
      user.id,
    )
    if (!exclusiveCheck.ok) {
      redirect(listingDetailHref(listing))
    }
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    notFound()
  }

  const seller = await fetchCheckoutSellerProfile(supabase, listing.user_id)

  const listingTitle = capitalizeWords(listing.title)

  let checkoutListing = rowToCheckoutListing(listing as unknown as Record<string, unknown>)
  let matchedOfferId: string | null = null
  let matchedOfferFulfillment: "pickup" | "shipping" | null = null

  if (
    isPeerListingSection(listing.section) &&
    user &&
    !isAnonymousSupabaseUser(user) &&
    listing.user_id !== user.id
  ) {
    const [priced, matchedOffer] = await Promise.all([
      applyAcceptedOfferToPeerCheckoutListings(supabase, user.id, [
        checkoutListing as unknown as PeerSurfboardCheckoutListingRow,
      ]),
      findAcceptedOfferMatchingListings(supabase, user.id, [checkoutListing.id], listing.user_id),
    ])
    if (priced[0]) {
      checkoutListing = rowToCheckoutListing(priced[0] as unknown as Record<string, unknown>)
    }
    matchedOfferId = matchedOffer?.id ?? null
    matchedOfferFulfillment = matchedOffer
      ? lockedFulfillmentFromOfferAndListings(matchedOffer.fulfillment, [
          checkoutListing,
        ])
      : null
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

  const { addresses: initialAddresses, addressesError, buyerEmail, legalFullName } =
    await fetchCheckoutBuyerContext(
    supabase,
    user,
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
          buyerEmail={buyerEmail}
          legalFullName={legalFullName}
          initialAddresses={addressesError ? [] : initialAddresses}
          seller={seller}
          offerId={matchedOfferId}
          lockedFulfillment={matchedOfferFulfillment}
        />
      </div>
    </main>
  )
}
