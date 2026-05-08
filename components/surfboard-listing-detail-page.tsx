import type { ComponentProps } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { formatCondition, formatBoardType, capitalizeWords } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import {
  getCachedPublicSurfboardListing,
  SURFBOARD_LISTING_SELECT,
} from "@/lib/listing-detail-cache"
import { ShareButton } from "@/components/share-button"
import { EndListingButton } from "@/components/end-listing-button"
import { Info, Hourglass, Flag, ShoppingCart } from "lucide-react"
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { ImageGallery } from "@/components/image-gallery"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { surfboardsBrowseRootLabel } from "@/lib/site-category-directory"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import {
  ListingSoldDetailNotice,
  ListingSoldOwnerNotice,
} from "@/components/listing-sold-detail-notice"

import { TranslateableDescription } from "@/components/translateable-description"
import { boardFulfillmentDetailLabels } from "@/lib/listing-fulfillment"
import { findListingByParam } from "@/lib/listing-query"
import {
  ListingAboutSellerSection,
  ListingBuyerProtectionTrustRibbon,
  ListingProtectionTrustRibbon,
} from "@/components/features/listings/listing-about-seller-section"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { getBrandById } from "@/lib/brands/server"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"
import { ListingDetailPeerPurchaseActions } from "@/components/listing-detail-peer-purchase-actions"
import { fetchAcceptedOfferForBuyerListing } from "@/lib/db/offers"
import { ListingBoardDimensionsBlock } from "@/components/listing-board-dimensions-section"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { HomePeerListingScrollTile, HomeListingScrollRow, type HomePeerScrollListing } from "@/components/features/home"
import { fetchSimilarSurfboardsForListingPdp } from "@/lib/db/listing-detail-similar-surfboards"
import {
  boardsBrowseBoardTypeLabel,
  browseTypeParamFromBoardType,
} from "@/lib/marketplace-slug-metadata"
import { formatDistanceToNow } from "date-fns"
import { ListingPdpRecentSections } from "@/components/features/listings/listing-pdp-recent-sections"
import { QuickEditListingPriceDialog } from "@/components/features/listings/quick-edit-listing-price-dialog"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { getListingFavoriteCount } from "@/lib/db/listing-favorite-count"

type AboutSellerProfilesProp = ComponentProps<typeof ListingAboutSellerSection>["profiles"]

export async function SurfboardListingDetailPage({
  listingParam,
}: {
  listingParam: string
}) {
  const supabase = await createClient()

  let { listing: board } = await getCachedPublicSurfboardListing(listingParam)
  if (!board) {
    const r = await findListingByParam(supabase, listingParam, {
      select: SURFBOARD_LISTING_SELECT,
      section: "surfboards",
      includeHiddenListings: true,
    })
    board = r.listing
  }

  if (!board) {
    notFound()
  }

  delete (board as Record<string, unknown>).seller_purchase_price_usd

  // Ensure seller profile never contains private data (email, etc.) before sending to client
  const p = board.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    board.profiles = {
      id: p.id,
      seller_slug: p.seller_slug,
      is_shop: p.is_shop,
      shop_name: p.shop_name,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      location: p.location,
      created_at: p.created_at,
      shop_verified: p.shop_verified,
      sales_count: p.sales_count,
    }
  }

  const { data: sellerReviewRatings } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_id", board.user_id)

  const reviewRatings = (sellerReviewRatings ?? []).map((r) => r.rating)
  const sellerReviewCount = reviewRatings.length
  const sellerAvgRating =
    sellerReviewCount > 0
      ? reviewRatings.reduce((sum, r) => sum + r, 0) / sellerReviewCount
      : 0

  const { data: sellerReviewPreviewRows } = await supabase
    .from("reviews")
    .select(
      "id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey ( display_name )",
    )
    .eq("reviewed_id", board.user_id)
    .order("created_at", { ascending: false })
    .limit(8)

  const sellerReviewPreviews = sellerReviewPreviewRows ?? []

  // Get seller's other boards (same fields as standard peer tiles)
  const { data: sellerBoards } = await supabase
    .from("listings")
    .select(
      `
      *,
      listing_images (url, thumbnail_url, sort_order, is_primary),
      categories (name)
    `,
    )
    .eq("user_id", board.user_id)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .neq("id", board.id)
    .order("created_at", { ascending: false })

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  const sellerBoardIds = (sellerBoards ?? []).map((b) => b.id)
  let sellerBoardFavoritedIds: string[] = []
  if (user && sellerBoardIds.length > 0) {
    const { data: sellerBoardFavs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", sellerBoardIds)
    sellerBoardFavoritedIds = (sellerBoardFavs ?? []).map((f) => f.listing_id)
  }

  // Check if favorited
  let isFavorited = false
  if (user) {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", board.id)
      .single()
    isFavorited = !!favorite
  }

  const images = board.listing_images?.sort((a: { is_primary: boolean; sort_order?: number }, b: { is_primary: boolean; sort_order?: number }) => 
    (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  ) || []

  const isOwnListing = user?.id === board.user_id
  const isSold = board.status === "sold"

  const pickupOffered = board.local_pickup !== false
  const shippingOffered = !!board.shipping_available

  const canPeerPurchase =
    !isOwnListing &&
    !isSold &&
    (board.status === "active" || board.status === "pending_sale") &&
    (pickupOffered || shippingOffered)

  const brandId = (board as { brand_id?: string | null }).brand_id?.trim() ?? ""
  const indexBrand = brandId ? await getBrandById(supabase, brandId) : null

  const rawBoardType = board.board_type?.trim() || null
  const typeCrumb = boardsBrowseBoardTypeLabel(rawBoardType ?? undefined)
  const browseBoardTypeParam = browseTypeParamFromBoardType(rawBoardType)
  const listingTitle = capitalizeWords(board.title)

  const listPriceNum =
    typeof board.price === "number" ? board.price : Number.parseFloat(String(board.price)) || 0
  const buyerOffersOn =
    (board as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false
  const offerPct = effectiveMinimumOfferPct(
    board as { minimum_offer_pct?: number | null },
  )
  const minOfferAmount = Math.round(listPriceNum * (offerPct / 100) * 100) / 100
  const acceptOffers = buyerOffersOn

  const similarBoardsRaw = await fetchSimilarSurfboardsForListingPdp(supabase, {
    excludeListingId: board.id,
    boardType: rawBoardType,
    priceUsd: listPriceNum,
  })
  const similarBoardIds = similarBoardsRaw.map((r) => String(r.id))

  let similarBoardFavoritedIds: string[] = []
  if (user && similarBoardIds.length > 0) {
    const { data: similarFavs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", similarBoardIds)
    similarBoardFavoritedIds = (similarFavs ?? []).map((f) => f.listing_id)
  }

  const primaryImageRaw =
    (images[0] as { thumbnail_url?: string | null; url?: string | null } | undefined)
      ?.thumbnail_url ||
    (images[0] as { url?: string | null } | undefined)?.url ||
    null
  const primaryImageUrl = primaryImageRaw ? proxiedListingImageSrc(primaryImageRaw) : null

  const makeOfferConfig =
    canPeerPurchase && acceptOffers && listPriceNum > 0
      ? {
          listingTitle,
          listPrice: listPriceNum,
          minOfferAmount,
          minOfferPct: offerPct,
          primaryImageUrl,
          canPick: pickupOffered,
          canShip: shippingOffered,
          shippingFlatRate: Math.max(0, Number.parseFloat(String(board.shipping_price ?? 0)) || 0),
        }
      : undefined

  let buyerAgreedPriceUsd: number | null = null
  if (user && !isOwnListing && board.status === "active") {
    const accepted = await fetchAcceptedOfferForBuyerListing(supabase, user.id, board.id)
    if (accepted && accepted.seller_id === board.user_id) {
      const n = Math.round(parseFloat(String(accepted.current_amount)) * 100) / 100
      if (Number.isFinite(n) && n > 0) buyerAgreedPriceUsd = n
    }
  }

  const listingLocationLine =
    board.city && board.state
      ? `${board.city}, ${board.state}`
      : board.profiles?.location?.trim() || null

  const boardShippingCostMode =
    (board as { board_shipping_cost_mode?: "reswell" | "flat" | "free" | null })
      .board_shipping_cost_mode ?? null
  const shippingFlatRate = Math.max(0, Number.parseFloat(String(board.shipping_price ?? 0)) || 0)

  const fulfillmentLabels = boardFulfillmentDetailLabels(
    board.local_pickup,
    board.shipping_available,
    board.shipping_price,
    boardShippingCostMode,
  )
  const specSubline = (
    [board.board_type ? formatBoardType(board.board_type) : null, ...fulfillmentLabels].filter(Boolean) as string[]
  ).join(" · ")

  const conditionWords = formatCondition(board.condition)

  let shippingPriceCaption: string | null = null
  if (!isSold) {
    if (!shippingOffered && pickupOffered) {
      shippingPriceCaption = "Local pickup · no shipping charge"
    } else if (shippingOffered && boardShippingCostMode === "free") {
      shippingPriceCaption = "Free shipping included"
    } else if (shippingOffered && shippingFlatRate > 0) {
      shippingPriceCaption = `+ $${shippingFlatRate.toFixed(2)} shipping`
    } else if (shippingOffered && boardShippingCostMode === "reswell") {
      shippingPriceCaption = "Shipping rate calculated at checkout"
    }
  }

  const listingViews = Number((board as { views?: number | null }).views ?? 0)
  const [cartHolderCount, listingWatchersCount] = await Promise.all([
    !isSold ? getListingCartHolderCount(supabase, board.id) : Promise.resolve(0),
    !isSold ? getListingFavoriteCount(supabase, board.id) : Promise.resolve(0),
  ])
  let listedRelative: string | null = null
  if (board.created_at != null) {
    const d = new Date(board.created_at as string | number | Date)
    if (!Number.isNaN(d.getTime())) {
      listedRelative = formatDistanceToNow(d, { addSuffix: true })
    }
  }

  const softPanelClass =
    "rounded-2xl border border-border/50 bg-muted/30 px-4 py-4 dark:border-border dark:bg-muted/15"

  const favoriteNextToOffer = !!(canPeerPurchase && makeOfferConfig)
  /** Share stays on image except when inline with Make an offer row (favorite goes on image corner). */
  const showShareOnGalleryOverlay = isOwnListing || !favoriteNextToOffer
  const showFavoriteOnGalleryOverlay = !isOwnListing

  return (
      <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-5 sm:pb-24 sm:pt-8">
        <div className="container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6 lg:!max-w-[min(100%,1320px)] xl:!max-w-[min(100%,1480px)] 2xl:!max-w-[min(100%,1680px)]">
          <div className="mb-5 min-w-0 max-w-full pt-0.5 lg:mb-8">
            <Breadcrumb>
              <BreadcrumbList className="gap-1 text-[13px] font-normal tracking-wide text-muted-foreground sm:gap-1.5 sm:text-[14px]">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
                {typeCrumb ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                        <Link href="/boards">{surfboardsBrowseRootLabel}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                        <Link
                          href={
                            browseBoardTypeParam
                              ? `/boards?type=${encodeURIComponent(browseBoardTypeParam)}`
                              : "/boards"
                          }
                        >
                          {typeCrumb}
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                        {listingTitle}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                        <Link href="/boards">{surfboardsBrowseRootLabel}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                        {listingTitle}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {isSold && (
            <div className="mx-auto mb-6 w-full min-w-0 max-w-full lg:mb-8">
              <ListingSoldDetailNotice />
            </div>
          )}

          <div className="mb-5 min-w-0 max-w-full space-y-3 lg:hidden">
            <h1 className="text-balance text-[1.625rem] font-bold leading-snug tracking-[-0.02em] text-foreground">
              {capitalizeWords(board.title)}
            </h1>
            {conditionWords ? (
              <span className="inline-block border-b border-dashed border-muted-foreground/55 pb-0.5 text-[14px] text-muted-foreground">
                Used – {conditionWords}
              </span>
            ) : null}
            {specSubline ? (
              <p className="text-[14px] leading-snug text-muted-foreground">{specSubline}</p>
            ) : null}
            {isSold ? (
              <p className="font-headline text-3xl font-semibold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
                Sold for ${board.price.toFixed(2)}
              </p>
            ) : (
              <>
                <div>
                  <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums sm:text-4xl">
                    ${board.price.toFixed(2)}
                  </p>
                  {shippingPriceCaption ? (
                    <p className="mt-1 text-[15px] text-muted-foreground">{shippingPriceCaption}</p>
                  ) : null}
                </div>
                {buyerAgreedPriceUsd != null ? (
                  <p className="text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
                    Your accepted price: ${buyerAgreedPriceUsd.toFixed(2)} at checkout
                  </p>
                ) : null}
              </>
            )}
            {!isSold && !isOwnListing && board.status === "active" ? (
              <p className="flex items-start gap-2 pt-1 text-[15px] text-foreground">
                <Hourglass className="mt-0.5 h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <span className="font-semibold">Only one available</span>
                  <span className="text-muted-foreground"> — grab it before it&apos;s gone</span>
                </span>
              </p>
            ) : null}
            {!isSold && !isOwnListing ? (
              <p className="text-[14px] leading-snug text-muted-foreground">
                Eligible checkout is covered by our{" "}
                <Link href="/protection-policy" className="text-foreground underline decoration-dashed underline-offset-2 hover:no-underline">
                  Purchase Protection
                </Link>
                . Fees may apply — see policy for coverage and exclusions.
              </p>
            ) : null}
          </div>

          <div className="mx-auto grid w-full min-w-0 max-w-full gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:grid-rows-[auto_auto] lg:[grid-template-areas:'gallery_details'_'about_details'] lg:items-start lg:gap-x-12 lg:gap-y-0 xl:gap-x-16">
            {/* Images */}
            <div className="relative min-w-0 max-lg:order-1 lg:[grid-area:gallery] lg:order-none">
              {!(isSold && isOwnListing) && (
                <ListingPhotosPendingBanner imageCount={images.length} isOwner={isOwnListing} />
              )}
              <div className="relative isolate">
                <div className="absolute right-2 top-2 z-[15] flex gap-2 sm:right-3 sm:top-3 md:right-4 md:top-4">
                  {showShareOnGalleryOverlay ? (
                    <ShareButton
                      title={listingTitle}
                      className="size-11 rounded-full border border-border/55 bg-background/90 shadow-sm backdrop-blur-md hover:bg-muted/40"
                      iconClassName="h-[18px] w-[18px]"
                    />
                  ) : null}
                  {showFavoriteOnGalleryOverlay ? (
                    <FavoriteButton
                      listingId={board.id}
                      redirectPath={listingDetailHref(board)}
                      initialFavorited={isFavorited}
                      isLoggedIn={!!user}
                      refreshAfterToggle
                      className="flex size-[44px] items-center justify-center rounded-full border border-black/[0.08] bg-white/95 shadow-sm backdrop-blur-sm hover:bg-white dark:border-white/[0.12] dark:bg-background/95 dark:hover:bg-background"
                      iconClassName="h-[18px] w-[18px]"
                    />
                  ) : null}
                </div>
                <ImageGallery images={images} title={capitalizeWords(board.title)} sold={isSold} />
              </div>
              {canPeerPurchase && (
                <div className="mt-5 lg:hidden">
                  <ListingDetailPeerPurchaseActions
                    listingId={board.id}
                    checkoutListingParam={board.slug ?? board.id}
                    section="surfboards"
                    isLoggedIn={!!user}
                    makeOffer={makeOfferConfig}
                    agreedCheckoutItemUsd={buyerAgreedPriceUsd}
                    offerRowTrailingSlot={
                      favoriteNextToOffer ? (
                        <ShareButton
                          title={listingTitle}
                          className="flex size-[52px] shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[#f2f3f5] shadow-none hover:bg-[#e8e9ec] dark:border-white/[0.12] dark:bg-secondary dark:hover:bg-secondary/80"
                          iconClassName="h-[18px] w-[18px]"
                        />
                      ) : undefined
                    }
                  />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 space-y-5 max-lg:order-3 lg:[grid-area:details] lg:order-none lg:pt-1">
              <div className="hidden lg:block">
                <h1 className="text-balance text-[2rem] font-bold leading-snug tracking-[-0.025em] text-foreground xl:text-[2.125rem]">
                  {capitalizeWords(board.title)}
                </h1>
                <div className="mt-3 flex flex-col gap-2">
                  {conditionWords ? (
                    <span className="inline-block w-fit border-b border-dashed border-muted-foreground/55 pb-0.5 text-[14px] text-muted-foreground">
                      Used – {conditionWords}
                    </span>
                  ) : null}
                  {specSubline ? (
                    <p className="text-[14px] text-muted-foreground">{specSubline}</p>
                  ) : null}
                </div>
                {isSold ? (
                  <p className="font-headline mt-4 text-4xl font-semibold tracking-tight text-emerald-600 tabular-nums xl:text-[2.5rem] dark:text-emerald-400">
                    Sold for ${board.price.toFixed(2)}
                  </p>
                ) : (
                  <>
                    <div className="mt-4">
                      <p className="text-4xl font-bold tracking-tight text-foreground tabular-nums xl:text-[2.625rem] xl:leading-none">
                        ${board.price.toFixed(2)}
                      </p>
                      {shippingPriceCaption ? (
                        <p className="mt-1.5 text-[15px] text-muted-foreground">{shippingPriceCaption}</p>
                      ) : null}
                    </div>
                    {buyerAgreedPriceUsd != null ? (
                      <p className="mt-2 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
                        Your accepted price: ${buyerAgreedPriceUsd.toFixed(2)} at checkout
                      </p>
                    ) : null}
                  </>
                )}
                {!isSold && !isOwnListing && board.status === "active" ? (
                  <p className="mt-4 flex items-start gap-2 text-[15px] text-foreground">
                    <Hourglass className="mt-0.5 h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      <span className="font-semibold">Only one available</span>
                      <span className="text-muted-foreground"> — grab it before it&apos;s gone</span>
                    </span>
                  </p>
                ) : null}
                {!isSold && !isOwnListing ? (
                  <p className="mt-3 text-[14px] leading-snug text-muted-foreground">
                    Eligible checkout is covered by our{" "}
                    <Link href="/protection-policy" className="text-foreground underline decoration-dashed underline-offset-2 hover:no-underline">
                      Purchase Protection
                    </Link>
                    . Fees may apply — see policy for coverage and exclusions.
                  </p>
                ) : null}
                {canPeerPurchase && (
                  <div className="mt-5">
                    <ListingDetailPeerPurchaseActions
                      listingId={board.id}
                      checkoutListingParam={board.slug ?? board.id}
                      section="surfboards"
                      isLoggedIn={!!user}
                      makeOffer={makeOfferConfig}
                      agreedCheckoutItemUsd={buyerAgreedPriceUsd}
                      offerRowTrailingSlot={
                        favoriteNextToOffer ? (
                          <ShareButton
                            title={listingTitle}
                            className="flex size-[52px] shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[#f2f3f5] shadow-none hover:bg-[#e8e9ec] dark:border-white/[0.12] dark:bg-secondary dark:hover:bg-secondary/80"
                            iconClassName="h-[18px] w-[18px]"
                          />
                        ) : undefined
                      }
                    />
                  </div>
                )}
              </div>

              {(listedRelative || !isSold || cartHolderCount > 0) && (
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-neutral-200/90 pb-4 text-[14px] text-muted-foreground dark:border-neutral-700/70">
                  {listedRelative ? (
                    <span>
                      Listed: <span className="font-medium text-foreground/80">{listedRelative}</span>
                    </span>
                  ) : null}
                  {!isSold ? (
                    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span>
                        Views:{" "}
                        <span className="font-medium tabular-nums text-foreground/80">
                          {Number.isFinite(listingViews) ? listingViews : 0}
                        </span>
                      </span>
                      <span>
                        Watchers:{" "}
                        <span className="font-medium tabular-nums text-foreground/80">
                          {Number.isFinite(listingWatchersCount) ? listingWatchersCount : 0}
                        </span>
                      </span>
                      {cartHolderCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                          <span className="font-medium text-foreground/80">
                            {cartHolderCount === 1
                              ? "In someone’s cart"
                              : `In ${cartHolderCount} buyers’ carts`}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              )}

              <div className="mt-5">
                <ListingAboutSellerSection
                  profiles={board.profiles as AboutSellerProfilesProp}
                  sellerProfileHref={sellerProfileHref(board.profiles)}
                  messageHrefAuthenticated={`/messages?user=${board.user_id}&listing=${board.id}`}
                  messageHrefLoginRedirect={`/auth/login?redirect=${encodeURIComponent(listingDetailHref(board))}`}
                  isLoggedIn={!!user}
                  isOwnListing={isOwnListing}
                  isSold={isSold}
                  avgRating={sellerAvgRating}
                  reviewCount={sellerReviewCount}
                  itemsSold={Number(board.profiles?.sales_count ?? 0)}
                  previewReviews={sellerReviewPreviews}
                  showTrustRibbon={false}
                />
              </div>

              <ListingProtectionTrustRibbon
                viewerRole={isOwnListing ? "seller" : "buyer"}
                className="mt-5 border-b border-neutral-200/90 pb-5 dark:border-neutral-700/70"
              />

              {!isOwnListing ? (
                <div className="border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70">
                  <Link
                    href={`/contact?topic=listing-report&listing=${encodeURIComponent(board.id)}`}
                    className="inline-flex items-center gap-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Report listing to Reswell
                  </Link>
                </div>
              ) : null}

              {isOwnListing && isSold && (
                <div className={softPanelClass}>
                  <ListingSoldOwnerNotice
                    dashboardListingsHref="/dashboard/listings"
                    sectionLabel="board"
                  />
                </div>
              )}

              {isOwnListing && !isSold && (
                <div className="border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70">
                  <div className="flex min-w-0 flex-col items-start gap-2">
                    <p className="text-[14px] text-muted-foreground">Your listing</p>
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <Button asChild className="rounded-full">
                        <Link prefetch={false} href={`/sell?edit=${board.id}`}>
                          Edit listing
                        </Link>
                      </Button>
                      <QuickEditListingPriceDialog
                        listingId={board.id}
                        currentPriceUsd={listPriceNum}
                        triggerClassName="rounded-full border-border/60 shadow-none"
                      />
                      <EndListingButton
                        listingId={board.id}
                        triggerClassName="rounded-full border-border/60 shadow-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-full mt-8 border-t border-neutral-200/90 pt-6 dark:border-neutral-700/70 max-lg:order-2 lg:col-span-1 lg:[grid-area:about] lg:order-none lg:mt-0 lg:border-t lg:border-neutral-200/90 lg:pt-5 dark:lg:border-neutral-700/70 xl:pt-6">
              <Accordion
                type="multiple"
                defaultValue={["about", "specs", "shipping"]}
                className="w-full"
              >
                <AccordionItem value="about" className="border-border/55">
                  <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:text-foreground">
                    About this listing
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pt-0">
                    <div className="text-[16px] leading-[1.65] text-foreground">
                      <TranslateableDescription text={board.description || ""} className="text-foreground" />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="specs" className="border-border/55">
                  <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                    Board specs
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-6 pt-0">
                    <ListingBoardDimensionsBlock
                      listingId={board.id}
                      className="!rounded-none !border-0 !bg-transparent !px-0 !py-0 shadow-none dark:!bg-transparent"
                      dimensions={{
                        length_feet: board.length_feet,
                        length_inches: board.length_inches,
                        width: board.width,
                        thickness: board.thickness,
                        volume: board.volume,
                        length_inches_display: (board as { length_inches_display?: string | null })
                          .length_inches_display,
                        width_inches_display: (board as { width_inches_display?: string | null })
                          .width_inches_display,
                        thickness_inches_display: (board as { thickness_inches_display?: string | null })
                          .thickness_inches_display,
                        volume_display: (board as { volume_display?: string | null }).volume_display,
                      }}
                    />
                    {indexBrand ? (
                      <div className="border-t border-border/50 pt-4">
                        <p className="text-[14px] font-medium uppercase tracking-wide text-foreground">
                          Brand
                        </p>
                        <p className="mt-1.5 text-[16px] font-medium text-foreground">
                          <Link
                            href={`${BRANDS_BASE}/${indexBrand.slug}`}
                            className="text-foreground underline-offset-4 hover:underline"
                          >
                            {indexBrand.name}
                          </Link>
                        </p>
                      </div>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="shipping" className="border-border/55">
                  <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                    Shipping &amp; pickup
                  </AccordionTrigger>
                  <AccordionContent className="space-y-0 pb-6 pt-0">
                    <div>
                      <p className="text-[14px] font-medium uppercase tracking-wide text-foreground">
                        Location
                      </p>
                      <p className="mt-1.5 text-[16px] font-medium text-foreground">
                        {listingLocationLine ?? "Location not specified"}
                      </p>
                    </div>
                    <p className="mt-4 text-[16px] leading-relaxed text-foreground">
                      {pickupOffered && shippingOffered &&
                        "Approximate area for pickup, or the seller can ship this board to you."}
                      {pickupOffered && !shippingOffered &&
                        "Approximate pickup area for meeting the seller and inspecting the board."}
                      {!pickupOffered &&
                        shippingOffered &&
                        "Seller ships this board. Use checkout to pay, then confirm your shipping address in messages."}
                    </p>
                    <ul className="mt-4 space-y-2.5 text-[16px] leading-snug text-foreground">
                      <li className="flex gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                        <span>Check for cracks, dings, and delamination before you pay.</span>
                      </li>
                      <li className="flex gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                        <span>Bring a friend for local pickups when you can.</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {!isOwnListing && !isSold ? (
                  <AccordionItem value="contact" className="border-border/55">
                    <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                      Contact seller
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 pt-0">
                      <ContactSellerForm
                        listingId={board.id}
                        listingSlug={board.slug}
                        sellerId={board.user_id}
                        listingTitle={capitalizeWords(board.title)}
                        isLoggedIn={!!user}
                        section="surfboards"
                        shippingAvailable={shippingOffered}
                        hideSectionTitle
                      />
                    </AccordionContent>
                  </AccordionItem>
                ) : null}
              </Accordion>
              {!isOwnListing ? (
                <div className="mt-10 w-full min-w-0 border-t border-neutral-200/90 pt-8 dark:border-neutral-700/70">
                  <ListingBuyerProtectionTrustRibbon />
                </div>
              ) : null}
              {similarBoardsRaw.length > 0 ? (
                <section className="mt-10 border-t border-neutral-200/90 pt-8 dark:border-neutral-700/70">
                  <h2 className="mb-8 text-2xl font-bold text-foreground">Similar boards</h2>
                  <HomeListingScrollRow uniformCardHeights>
                    {similarBoardsRaw.map((row) => (
                      <HomePeerListingScrollTile
                        key={String(row.id)}
                        listing={row as unknown as HomePeerScrollListing}
                        userId={user?.id ?? null}
                        isFavorited={similarBoardFavoritedIds.includes(String(row.id))}
                      />
                    ))}
                  </HomeListingScrollRow>
                </section>
              ) : null}
            </div>
          </div>

          {/* Seller's other boards — full-width horizontal scroll row */}
          {sellerBoards && sellerBoards.length > 0 && (
            <section className="mt-16 min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
              <h2 className="mb-8 px-4 text-2xl font-bold text-foreground sm:px-6 lg:px-8">
                More boards from this seller
              </h2>
              <HomeListingScrollRow uniformCardHeights viewportFullWidth>
                {sellerBoards.map((item) => (
                  <HomePeerListingScrollTile
                    key={item.id}
                    listing={item}
                    userId={user?.id ?? null}
                    isFavorited={sellerBoardFavoritedIds.includes(item.id)}
                  />
                ))}
              </HomeListingScrollRow>
            </section>
          )}

          <ListingPdpRecentSections
            key={board.id}
            currentListingId={board.id}
            viewerUserId={user?.id ?? null}
            moreListings={[]}
            padStripWithRecommendations={false}
          />
        </div>
      </main>
  )
}
