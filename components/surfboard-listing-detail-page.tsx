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
import { formatCondition, capitalizeWords } from "@/lib/listing-labels"
import {
  loadListingDetailPageContext,
  type ListingDetailPageSharedProps,
} from "@/lib/listing-detail-page-load"
import { ShareButton } from "@/components/share-button"
import { ListingOwnerManageActions } from "@/components/features/listings/listing-owner-manage-actions"
import { Hourglass, Flag, Truck } from "lucide-react"
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { ImageGallery } from "@/components/image-gallery"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { surfboardsBrowseRootLabel } from "@/lib/site-category-directory"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import { listingTileFavoriteButtonChromeClassName } from "@/components/favorite-button-card-overlay"
import { cn } from "@/lib/utils"
import {
  ListingSoldDetailNotice,
  ListingSoldOwnerNotice,
} from "@/components/listing-sold-detail-notice"

import { TranslateableDescription } from "@/components/translateable-description"
import { boardFulfillmentDetailLabels } from "@/lib/listing-fulfillment"
import { getCachedSoldSurfboardUsedShippingFulfillment } from "@/lib/cache/marketplace-sold-feed"
import {
  ListingAboutSellerSection,
  ListingBuyerProtectionTrustRibbon,
  ListingProtectionTrustRibbon,
} from "@/components/features/listings/listing-about-seller-section"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { getBrandById } from "@/lib/brands/server"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"
import { ListingDetailEngagementMetrics } from "@/components/listing-detail-engagement-metrics"
import { ListingDetailPeerPurchaseActionsLoader } from "@/components/listing-detail-peer-purchase-actions-loader"
import { fetchAcceptedOfferForBuyerListing } from "@/lib/db/offers"
import { ListingBoardDimensionsBlock } from "@/components/listing-board-dimensions-section"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"
import { HomePeerListingScrollTile, HomeListingScrollRow, type HomePeerScrollListing } from "@/components/features/home"
import { fetchSimilarSurfboardsForListingPdp } from "@/lib/db/listing-detail-similar-surfboards"
import {
  boardsBrowseBoardTypeLabel,
  browseTypeParamFromBoardType,
} from "@/lib/marketplace-slug-metadata"
import { formatDistanceToNow } from "date-fns"
import { ListingPdpRecentSections } from "@/components/features/listings/listing-pdp-recent-sections"
import { fetchSignedInPdpRecentlyViewedSurfboards } from "@/lib/services/pdp-recent-strip-listings"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { getListingFavoriteCount } from "@/lib/db/listing-favorite-count"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"
import {
  getCachedReswellPlatformReviewSummary,
  getCachedSellerReviewSummary,
} from "@/lib/cache/review-summaries"
import { ReswellPlatformRatingWidget } from "@/components/features/reswell/reswell-platform-rating-widget"
import { MetaViewContentTracker } from "@/components/meta/meta-view-content-tracker"
import { isMetaCatalogEligibleListing } from "@/lib/meta/catalog-product"

type AboutSellerProfilesProp = ComponentProps<typeof ListingAboutSellerSection>["profiles"]

const SELLER_BOARDS_PDP_LIMIT = 12

export async function SurfboardListingDetailPage({
  listingParam,
  prefetchedListing,
  viewerUser,
}: ListingDetailPageSharedProps) {
  const { supabase, user, listing: boardRaw } = await loadListingDetailPageContext({
    listingParam,
    prefetchedListing,
    viewerUser,
    section: "surfboards",
    usePublicCache: true,
  })

  if (!boardRaw) {
    notFound()
  }

  const board = boardRaw as any

  delete board.seller_purchase_price_usd

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

  const sellerId = board.user_id
  const isSold = board.status === "sold"
  const brandId = (board as { brand_id?: string | null }).brand_id?.trim() ?? ""
  const rawBoardType = board.board_type?.trim() || null
  const listPriceNum =
    typeof board.price === "number" ? board.price : Number.parseFloat(String(board.price)) || 0

  // Wave 1: everything that depends only on the listing row runs in parallel.
  const [
    sellerReviewSummaryRes,
    sellerReviewPreviewRes,
    reswellPlatformReviewSummaryRes,
    sellerBoardsRes,
    soldUsedShipping,
    indexBrand,
    similarBoardsRaw,
    [cartHolderCount, listingWatchersCount],
  ] = await Promise.all([
    getCachedSellerReviewSummary(sellerId),
    supabase
      .from("reviews")
      .select(
        "id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey ( display_name )",
      )
      .eq("reviewed_id", sellerId)
      .order("created_at", { ascending: false })
      .limit(8),
    getCachedReswellPlatformReviewSummary(),
    supabase
      .from("listings")
      .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
      .eq("user_id", sellerId)
      .eq("status", "active")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false)
      .neq("id", board.id)
      .order("created_at", { ascending: false })
      .limit(SELLER_BOARDS_PDP_LIMIT),
    isSold
      ? getCachedSoldSurfboardUsedShippingFulfillment(board.id)
      : Promise.resolve(false as const),
    brandId ? getBrandById(supabase, brandId) : Promise.resolve(null),
    fetchSimilarSurfboardsForListingPdp(supabase, {
      excludeListingId: board.id,
      boardType: rawBoardType,
      priceUsd: listPriceNum,
    }),
    Promise.all([
      !isSold ? getListingCartHolderCount(supabase, board.id) : Promise.resolve(0),
      !isSold ? getListingFavoriteCount(supabase, board.id) : Promise.resolve(0),
    ]),
  ])

  const { avgRating: sellerAvgRating, reviewCount: sellerReviewCount } =
    sellerReviewSummaryRes
  const sellerReviewPreviews = sellerReviewPreviewRes.data ?? []
  const reswellPlatformReviewSummary = reswellPlatformReviewSummaryRes
  const sellerBoards = sellerBoardsRes.data

  const sellerBoardIds = (sellerBoards ?? []).map((b) => b.id)
  const similarBoardIds = similarBoardsRaw.map((r) => String(r.id))
  const isOwnListing = user?.id === board.user_id

  // Wave 2: everything that depends on the viewer runs in parallel,
  // with all favorite lookups coalesced into a single query.
  const [favoriteRowsRes, acceptedOffer, dbRecentListings] = await Promise.all([
    user
      ? supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)
          .in("listing_id", [board.id, ...sellerBoardIds, ...similarBoardIds])
      : Promise.resolve({ data: null }),
    user && !isOwnListing && board.status === "active"
      ? fetchAcceptedOfferForBuyerListing(supabase, user.id, board.id)
      : Promise.resolve(null),
    user
      ? fetchSignedInPdpRecentlyViewedSurfboards(supabase, user.id, board.id)
      : Promise.resolve(undefined),
  ])

  const favoritedIds = new Set(
    (favoriteRowsRes.data ?? []).map((f: { listing_id: string }) => f.listing_id),
  )
  const isFavorited = favoritedIds.has(board.id)
  const sellerBoardFavoritedIds = sellerBoardIds.filter((id) => favoritedIds.has(id))
  const similarBoardFavoritedIds = similarBoardIds.filter((id) => favoritedIds.has(id))

  const images = board.listing_images?.sort((a: { is_primary: boolean; sort_order?: number }, b: { is_primary: boolean; sort_order?: number }) => 
    (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  ) || []

  const metaCatalogEligible = isMetaCatalogEligibleListing(board)

  const pickupOffered = board.local_pickup !== false
  const shippingOffered = !!board.shipping_available

  const canPeerPurchase =
    !isOwnListing &&
    !isSold &&
    (board.status === "active" || board.status === "pending_sale") &&
    (pickupOffered || shippingOffered)

  const freeBrandLabel = (board as { brand?: string | null }).brand?.trim() ?? ""
  const modelForSpecs = (board as { model?: string | null }).model?.trim() ?? ""
  const boardSpecsBrandLabel = (indexBrand?.name ?? freeBrandLabel).trim() || null
  const boardSpecsBrandHref = indexBrand ? `${BRANDS_BASE}/${indexBrand.slug}` : null

  const typeCrumb = boardsBrowseBoardTypeLabel(rawBoardType ?? undefined)
  const browseBoardTypeParam = browseTypeParamFromBoardType(rawBoardType)
  const listingTitle = capitalizeWords(board.title)

  /** Public sold/browse price — always original list price, never negotiated offer amounts. */
  const publicListPriceUsd = publicListingListPriceUsd(board.price)
  const buyerOffersOn =
    (board as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false
  const offerPct = effectiveMinimumOfferPct(
    board as { minimum_offer_pct?: number | null },
  )
  const minOfferAmount = Math.round(listPriceNum * (offerPct / 100) * 100) / 100
  const acceptOffers = buyerOffersOn

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
          shippingCostMode:
            (board.board_shipping_cost_mode as "reswell" | "flat" | "free" | null) ?? null,
        }
      : undefined

  let buyerAgreedPriceUsd: number | null = null
  if (acceptedOffer && acceptedOffer.seller_id === board.user_id) {
    const n = Math.round(parseFloat(String(acceptedOffer.current_amount)) * 100) / 100
    if (Number.isFinite(n) && n > 0) buyerAgreedPriceUsd = n
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
  const specSubline =
    fulfillmentLabels.length > 0 ? fulfillmentLabels.join(" · ") : null

  const conditionWords = formatCondition(board.condition)

  let shippingPriceCaption: string | null = null
  if (!isSold) {
    if (!shippingOffered && pickupOffered) {
      shippingPriceCaption = "Local pickup · shipping not offered"
    } else if (shippingOffered && boardShippingCostMode === "free") {
      shippingPriceCaption = "Free shipping included"
    } else if (shippingOffered && shippingFlatRate > 0) {
      shippingPriceCaption = `+ $${shippingFlatRate.toFixed(2)} shipping`
    } else if (shippingOffered && boardShippingCostMode === "reswell") {
      shippingPriceCaption = "Shipping rate calculated at checkout"
    } else if (shippingOffered && boardShippingCostMode === "flat") {
      shippingPriceCaption =
        shippingFlatRate > 0
          ? `+ $${shippingFlatRate.toFixed(2)} shipping`
          : "Flat shipping at checkout"
    }
  }

  const mobileFulfillmentChips = ((): string[] => {
    if (!shippingOffered && pickupOffered) return ["Local pickup", "Shipping not offered"]
    if (shippingOffered && !pickupOffered) {
      if (boardShippingCostMode === "free") return ["Free shipping"]
      if (shippingFlatRate > 0) return [`Ships (+$${shippingFlatRate.toFixed(2)})`]
      if (boardShippingCostMode === "reswell") return ["Shipping at checkout"]
      if (boardShippingCostMode === "flat") {
        return shippingFlatRate > 0
          ? [`Ships (+$${shippingFlatRate.toFixed(2)})`]
          : ["Flat shipping"]
      }
      return ["Ships"]
    }
    if (shippingOffered && pickupOffered) {
      const shipPart =
        boardShippingCostMode === "free"
          ? "Free shipping"
          : shippingFlatRate > 0
            ? `+$${shippingFlatRate.toFixed(2)} shipping`
            : boardShippingCostMode === "reswell"
              ? "Shipping at checkout"
              : boardShippingCostMode === "flat"
                ? "Flat shipping"
                : "Shipping"
      return ["Local pickup", shipPart]
    }
    return []
  })()

  const mobileProductMetaItems = [
    conditionWords ? `Used – ${conditionWords}` : null,
  ].filter(Boolean) as string[]

  const listingViews = Number((board as { views?: number | null }).views ?? 0)
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

  const aboutSellerSection = (
    <ListingAboutSellerSection
      profiles={board.profiles as AboutSellerProfilesProp}
      listingImageFallbacks={[{ listing_images: board.listing_images }]}
      sellerProfileHref={sellerProfileHref(board.profiles)}
      messageHrefAuthenticated={`/messages/new?user=${board.user_id}&listing=${board.id}`}
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
  )

  return (
      <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-5 sm:pb-24 sm:pt-8">
        {metaCatalogEligible ? (
          <MetaViewContentTracker
            listingId={board.id}
            value={listPriceNum}
            contentName={listingTitle}
          />
        ) : null}
        <div className="container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6 lg:px-8 lg:!max-w-[min(100%,1320px)] xl:!max-w-[min(100%,1480px)] 2xl:!max-w-[min(100%,1680px)]">
          <div className="mb-3 min-w-0 max-w-full pt-0.5 max-lg:mb-4 lg:mb-8">
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
              <ListingSoldDetailNotice shipped={soldUsedShipping} />
            </div>
          )}

          <div className="mx-auto grid w-full min-w-0 max-w-full gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:grid-rows-[auto_auto_auto] lg:[grid-template-areas:'gallery_details'_'about_details'_'similar_similar'] lg:items-start lg:gap-x-12 lg:gap-y-0 xl:gap-x-16">
            {/* Images */}
            <div className="min-w-0 max-lg:order-1 lg:[grid-area:gallery] lg:order-none lg:w-full lg:max-w-[29rem] lg:justify-self-start xl:max-w-[32rem]">
              {!(isSold && isOwnListing) && (
                <ListingPhotosPendingBanner imageCount={images.length} isOwner={isOwnListing} />
              )}
              <div className="relative isolate">
                <ImageGallery
                  images={images}
                  title={capitalizeWords(board.title)}
                  sold={isSold}
                  compactMobile
                  heroOverlay={
                    <>
                      {showShareOnGalleryOverlay ? (
                        <ShareButton
                          title={listingTitle}
                          className="size-11 rounded-full border border-border/55 bg-background/90 shadow-sm backdrop-blur-md hover:bg-muted/40"
                          iconClassName="h-[18px] w-[18px]"
                        />
                      ) : null}
                      {showFavoriteOnGalleryOverlay ? (
                        <div className="group/favorite flex h-14 w-14 shrink-0 items-start justify-end">
                          <FavoriteButton
                            listingId={board.id}
                            redirectPath={listingDetailHref(board)}
                            initialFavorited={isFavorited}
                            isLoggedIn={!!user}
                            refreshAfterToggle
                            heartAccent="listingTile"
                            className={cn(
                              "h-11 w-11 min-h-11 min-w-11",
                              listingTileFavoriteButtonChromeClassName,
                            )}
                          />
                        </div>
                      ) : null}
                    </>
                  }
                />
              </div>
              <h1 className="mt-3 min-w-0 text-balance text-[1.375rem] font-bold leading-snug tracking-[-0.02em] text-foreground max-lg:line-clamp-2 lg:hidden">
                {capitalizeWords(board.title)}
              </h1>
            </div>

            <div className="min-w-0 max-w-full max-lg:order-2 lg:hidden">
              {isSold ? (
                <p className="mt-2 font-headline text-3xl font-semibold tracking-tight text-[#163060] tabular-nums">
                  Sold for ${publicListPriceUsd.toFixed(2)}
                </p>
              ) : (
                <div className="mt-2">
                  <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums sm:text-4xl">
                    ${board.price.toFixed(2)}
                  </p>
                  {buyerAgreedPriceUsd != null ? (
                    <p className="mt-1.5 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
                      Your accepted price: ${buyerAgreedPriceUsd.toFixed(2)} at checkout
                    </p>
                  ) : null}
                </div>
              )}
              <ListingDetailEngagementMetrics
                views={listingViews}
                watchers={listingWatchersCount}
                cartHolderCount={cartHolderCount}
                isSold={isSold}
                className="mt-2 lg:hidden"
              />
              {(mobileProductMetaItems.length > 0 ||
                (isSold ? soldUsedShipping : mobileFulfillmentChips.length > 0)) ? (
                <div className="mt-3 space-y-2 border-y border-border/50 py-2.5 text-[14px]">
                  {mobileProductMetaItems.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground">
                      {mobileProductMetaItems.map((item, index) => (
                        <span key={item} className="inline-flex items-center gap-3">
                          {index > 0 ? <span aria-hidden className="h-3.5 w-px shrink-0 bg-border" /> : null}
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {isSold && soldUsedShipping ? (
                    <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>This board was shipped</span>
                    </p>
                  ) : mobileFulfillmentChips.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                      {mobileFulfillmentChips.map((item, index) => (
                        <span key={item} className="inline-flex items-center gap-3">
                          {index > 0 ? <span aria-hidden className="h-3.5 w-px shrink-0 bg-border" /> : null}
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!isSold && !isOwnListing && board.status === "active" ? (
                <p className="mt-3 flex items-center gap-1.5 text-[14px] text-foreground">
                  <Hourglass className="h-[14px] w-[14px] shrink-0 text-muted-foreground" aria-hidden />
                  <span className="font-medium">Only one available</span>
                </p>
              ) : null}
              {!isSold && !isOwnListing ? (
                <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
                  Covered by{" "}
                  <Link href="/protection-policy" className="text-foreground underline decoration-dashed underline-offset-2 hover:no-underline">
                    Purchase Protection
                  </Link>{" "}
                  on eligible checkout.
                </p>
              ) : null}
              {canPeerPurchase ? (
                <div className="mt-5">
                  <ListingDetailPeerPurchaseActionsLoader
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
              ) : null}
              <div className="mt-5 border-t border-neutral-200/90 pt-5 dark:border-neutral-700/70 lg:hidden">
                {aboutSellerSection}
              </div>
            </div>

            {/* Details */}
            <div className="min-w-0 space-y-5 max-lg:order-4 lg:[grid-area:details] lg:order-none lg:pt-1">
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
                  {isSold && soldUsedShipping ? (
                    <p className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>This board was shipped</span>
                    </p>
                  ) : specSubline ? (
                    <p className="text-[14px] text-muted-foreground">{specSubline}</p>
                  ) : null}
                </div>
                {isSold ? (
                  <p className="font-headline mt-4 text-4xl font-semibold tracking-tight text-[#163060] tabular-nums xl:text-[2.5rem]">
                    Sold for ${publicListPriceUsd.toFixed(2)}
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
                    <ListingDetailPeerPurchaseActionsLoader
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
                    <ListingDetailEngagementMetrics
                      views={listingViews}
                      watchers={listingWatchersCount}
                      cartHolderCount={cartHolderCount}
                      isSold={isSold}
                      className="max-lg:hidden"
                    />
                  ) : null}
                </div>
              )}

              <div className="mt-5 hidden lg:block">
                {aboutSellerSection}
              </div>

              {!isOwnListing ? (
                <ListingBuyerProtectionTrustRibbon className="mt-5 border-b border-neutral-200/90 pb-5 dark:border-neutral-700/70 lg:hidden" />
              ) : null}

              <ListingProtectionTrustRibbon
                viewerRole={isOwnListing ? "seller" : "buyer"}
                className={
                  isOwnListing
                    ? "mt-5 border-b border-neutral-200/90 pb-5 dark:border-neutral-700/70"
                    : "mt-5 hidden border-b border-neutral-200/90 pb-5 dark:border-neutral-700/70 lg:block"
                }
              />

              <ReswellPlatformRatingWidget
                summary={reswellPlatformReviewSummary}
                className="mt-5"
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

              {isOwnListing && !isSold ? (
                <ListingOwnerManageActions
                  listingId={board.id}
                  section="surfboards"
                  currentPriceUsd={listPriceNum}
                  listingStatus={String(board.status ?? "")}
                  hiddenFromSite={board.hidden_from_site === true}
                />
              ) : null}
            </div>

            <div className="col-span-full mt-8 min-w-0 max-w-full border-t border-neutral-200/90 pt-6 dark:border-neutral-700/70 max-lg:order-3 lg:col-span-1 lg:[grid-area:about] lg:order-none lg:mt-0 lg:border-t lg:border-neutral-200/90 lg:pt-5 dark:lg:border-neutral-700/70 xl:pt-6">
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
                        dimensions: (board as { dimensions?: string | null }).dimensions,
                      }}
                      brandLabel={boardSpecsBrandLabel}
                      brandHref={boardSpecsBrandHref}
                      modelLabel={modelForSpecs || null}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="shipping" className="border-border/55">
                  <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                    Shipping &amp; pickup
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pt-0">
                    <div className="space-y-3 text-[16px] leading-[1.65] text-foreground">
                      <p className="font-medium">
                        {listingLocationLine ?? "Location not specified"}
                      </p>
                      <p>
                        {pickupOffered && shippingOffered &&
                          "Pickup near this area, or the seller can ship to you at checkout."}
                        {pickupOffered && !shippingOffered &&
                          "Local pickup only — meet the seller near this area to inspect the board."}
                        {!pickupOffered &&
                          shippingOffered &&
                          "Shipped to you after checkout. Confirm your address with the seller in messages."}
                      </p>
                      {pickupOffered ? (
                        <p>Inspect for cracks, dings, or delamination before you pay.</p>
                      ) : null}
                    </div>
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
                <div className="mt-10 hidden w-full min-w-0 border-t border-neutral-200/90 pt-8 dark:border-neutral-700/70 lg:block">
                  <ListingBuyerProtectionTrustRibbon />
                </div>
              ) : null}
            </div>

            {similarBoardsRaw.length > 0 ? (
              <div className="col-span-full min-w-0 max-w-full max-lg:order-5 lg:[grid-area:similar] lg:order-none">
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
              </div>
            ) : null}
          </div>

          {/* Seller's other boards — full-width horizontal scroll row */}
          {sellerBoards && sellerBoards.length > 0 && (
            <section className="mt-16 min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
              <h2 className="mb-8 text-2xl font-bold text-foreground">
                More boards from this seller
              </h2>
              <HomeListingScrollRow uniformCardHeights>
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
            initialDbRecentListings={dbRecentListings}
          />
        </div>
      </main>
  )
}
