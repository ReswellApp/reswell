import { Suspense, type ComponentProps } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  SurfboardListingIdentity,
  SurfboardListingIdentityFallback,
  SurfboardListingShippedDetail,
  SurfboardListingSoldNotice,
  SurfboardListingSoldStatusNote,
} from "@/components/features/listings/surfboard-listing-pdp-identity"
import {
  SurfboardListingCartScarcityNote,
  SurfboardListingEngagementMetrics,
  SurfboardListingPlatformRating,
  SurfboardListingSellerReviews,
} from "@/components/features/listings/surfboard-listing-pdp-social"
import { capitalizeWords } from "@/lib/listing-labels"
import {
  loadListingDetailPageContext,
  type ListingDetailPageSharedProps,
} from "@/lib/listing-detail-page-load"
import { renderListingDetailWithGuestFallback } from "@/lib/listing-detail-page-safe-render"
import { loadSurfboardListingViewerState } from "@/lib/services/surfboardListingViewerState"
import { ShareButton } from "@/components/share-button"
import { ListingOwnerManageActions } from "@/components/features/listings/listing-owner-manage-actions"
import { computeListingEnrichmentGaps } from "@/lib/sell-flow/listing-enrichment"
import { Hourglass, Flag } from "lucide-react"
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { ImageGallery } from "@/components/image-gallery"
import { primaryListingVideo } from "@/lib/primary-listing-video"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { orderedListingGalleryImages } from "@/lib/listing-image-display"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import {
  ListingSoldDetailNotice,
  ListingSoldOwnerNotice,
} from "@/components/listing-sold-detail-notice"

import { TranslateableDescription } from "@/components/translateable-description"
import { ListingPdpDeliveryCaption } from "@/components/features/listings/listing-pdp-delivery-caption"
import {
  ListingAboutSellerSection,
  ListingBuyerProtectionTrustRibbon,
  ListingProtectionTrustRibbon,
  ListingSellerReviewsFallback,
} from "@/components/features/listings/listing-about-seller-section"
import { ListingFulfillmentAccordionItem } from "@/components/features/listings/listing-fulfillment-accordion-item"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"
import { ListingDetailEngagementMetrics } from "@/components/listing-detail-engagement-metrics"
import { ListingKlarnaAsLowAs } from "@/components/features/listings/listing-klarna-as-low-as"
import { ListingMobileBuySummary } from "@/components/features/listings/listing-mobile-buy-summary"
import {
  ListingDetailPeerPurchaseActionsFallback,
  ListingDetailPeerPurchaseActionsLoader,
} from "@/components/listing-detail-peer-purchase-actions-loader"
import { formatListingDimensionsLine } from "@/lib/listing-dimensions-display"
import { ListingBoardSpecTable } from "@/components/features/listings/listing-board-spec-table"
import { listingBoardSpecRows } from "@/lib/utils/listing-board-spec-rows"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import {
  publicListingCompareAtPriceUsd,
  publicListingListPriceUsd,
} from "@/lib/utils/public-listing-price"
import { formatDistanceToNow } from "date-fns"
import {
  SurfboardListingPdpCatalogStrips,
  SurfboardListingPdpCatalogStripsFallback,
} from "@/components/features/listings/surfboard-listing-pdp-catalog-strips"
import { MetaViewContentTracker } from "@/components/meta/meta-view-content-tracker"
import { isMetaCatalogEligibleListing } from "@/lib/meta/catalog-product"
import {
  canShowPeerListingPurchaseActions,
  isListingPurchasable,
} from "@/lib/listing-public-visibility"

type AboutSellerProfilesProp = ComponentProps<typeof ListingAboutSellerSection>["profiles"]

export async function SurfboardListingDetailPage(props: ListingDetailPageSharedProps) {
  return renderListingDetailWithGuestFallback(props, renderSurfboardListingDetailPage)
}

async function renderSurfboardListingDetailPage({
  listingParam,
  prefetchedListing,
  viewerUser,
}: ListingDetailPageSharedProps) {
  const { user, listing: boardRaw, canSellerRelist } = await loadListingDetailPageContext({
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
  const profilesRaw = board.profiles as Record<string, unknown> | Record<string, unknown>[] | null
  const p = Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw
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

  const sellerId = String(board.user_id ?? "")
  const isSold = board.status === "sold"
  const brandId = (board as { brand_id?: string | null }).brand_id?.trim() ?? ""
  const listPriceNum =
    typeof board.price === "number" ? board.price : Number.parseFloat(String(board.price)) || 0
  const isOwnListing = user?.id === board.user_id

  // Anonymous HTML never enters this branch (`anonymousPublicView` leaves user null).
  let isFavorited = false
  let buyerAgreedPriceUsd: number | null = null
  if (user) {
    const viewer = await loadSurfboardListingViewerState(
      board.id,
      sellerId,
      String(board.status ?? ""),
    )
    isFavorited = viewer.isFavorited
    buyerAgreedPriceUsd = viewer.buyerAgreedPriceUsd
  }

  const images = orderedListingGalleryImages(board.listing_images)

  const video = primaryListingVideo(
    (
      board as {
        listing_videos?: Array<{
          id: string
          url: string
          thumbnail_url?: string | null
          content_type?: string | null
          sort_order?: number | null
        }>
      }
    ).listing_videos,
  )

  const metaCatalogEligible = isMetaCatalogEligibleListing(board)

  const pickupOffered = board.local_pickup !== false
  const shippingOffered = !!board.shipping_available

  const purchaseVisibility = {
    status: String(board.status ?? ""),
    title: board.title as string | null | undefined,
    hidden_from_site: board.hidden_from_site as boolean | null | undefined,
    archived_at: board.archived_at as string | null | undefined,
  }
  const listingPurchasable = isListingPurchasable(purchaseVisibility)
  const canPeerPurchase = canShowPeerListingPurchaseActions({
    isOwnListing,
    listing: purchaseVisibility,
    fulfillmentAvailable: pickupOffered || shippingOffered,
  })

  const freeBrandLabel = (board as { brand?: string | null }).brand?.trim() ?? ""
  const modelForSpecs = (board as { model?: string | null }).model?.trim() ?? ""
  const brandModelId = (board as { brand_model_id?: string | null }).brand_model_id?.trim() ?? ""
  const listingTitle = capitalizeWords(board.title)
  const identityView = {
    freeBrandLabel,
    modelName: modelForSpecs,
    listingTitle,
  }
  const identityKey = {
    brandId,
    brandModelId,
  }
  const dimensionsLine = formatListingDimensionsLine({
    dimensions: (board as { dimensions?: string | null }).dimensions,
  })
  const boardSpecRows = listingBoardSpecRows({
    condition: board.condition,
    dimensions: (board as { dimensions?: string | null }).dimensions,
    construction: (board as { construction?: string | null }).construction,
    fin_system: (board as { fin_system?: string | null }).fin_system,
    fins_setup: (board as { fins_setup?: string | null }).fins_setup,
    fins_included: (board as { fins_included?: boolean | null }).fins_included,
  })

  /** Public sold/browse price — always original list price, never negotiated offer amounts. */
  const publicListPriceUsd = publicListingListPriceUsd(board.price)
  const compareAtPriceUsd = publicListingCompareAtPriceUsd(
    (board as { compare_at_price?: string | number | null }).compare_at_price,
    listPriceNum,
  )
  const buyerOffersOn =
    (board as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false
  const offerPct = effectiveMinimumOfferPct(
    board as { minimum_offer_pct?: number | null },
  )
  
  const hasFixedMinimumAmount = !!(board as { minimum_offer_amount?: string | number | null }).minimum_offer_amount
  const minOfferAmount = hasFixedMinimumAmount
    ? Math.round(parseFloat(String((board as { minimum_offer_amount?: string | number | null }).minimum_offer_amount ?? 0)) * 100) / 100
    : Math.round(listPriceNum * (offerPct / 100) * 100) / 100
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
          hideMinimumUntilViolated: hasFixedMinimumAmount,
        }
      : undefined

  const listingLocationLine =
    board.city && board.state
      ? `${board.city}, ${board.state}`
      : board.profiles?.location?.trim() || null

  const boardShippingCostMode =
    (board as { board_shipping_cost_mode?: "reswell" | "flat" | "free" | null })
      .board_shipping_cost_mode ?? null
  const shippingFlatRate = Math.max(0, Number.parseFloat(String(board.shipping_price ?? 0)) || 0)

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

  const sellerProfilePath = sellerProfileHref(board.profiles)
  const itemsSold = Number(board.profiles?.sales_count ?? 0)
  const offerToCart =
    isOwnListing && user
      ? { listingId: board.id, sellerUserId: user.id, listingTitle, listPrice: listPriceNum }
      : null

  const aboutSellerSection = (
    <ListingAboutSellerSection
      profiles={board.profiles as AboutSellerProfilesProp}
      listingImageFallbacks={[{ listing_images: board.listing_images }]}
      sellerProfileHref={sellerProfilePath}
      messageHrefAuthenticated={`/messages/new?user=${board.user_id}&listing=${board.id}`}
      messageHrefLoginRedirect={`/auth/login?redirect=${encodeURIComponent(listingDetailHref(board))}`}
      isLoggedIn={!!user}
      isOwnListing={isOwnListing}
      isSold={isSold}
      avgRating={0}
      reviewCount={0}
      itemsSold={itemsSold}
      previewReviews={[]}
      showTrustRibbon={false}
      reviewsSlot={
        <Suspense fallback={<ListingSellerReviewsFallback />}>
          <SurfboardListingSellerReviews
            sellerId={sellerId}
            listingId={board.id}
            isSold={isSold}
            itemsSold={itemsSold}
            sellerProfileHref={sellerProfilePath}
          />
        </Suspense>
      }
    />
  )

  return (
      <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-2 sm:pb-24 sm:pt-3 lg:pt-8">
        {metaCatalogEligible ? (
          <MetaViewContentTracker
            listingId={board.id}
            value={listPriceNum}
            contentName={listingTitle}
          />
        ) : null}
        <div className="container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6 lg:px-8 lg:!max-w-[min(100%,1320px)] xl:!max-w-[min(100%,1480px)] 2xl:!max-w-[min(100%,1680px)]">
          <div className="mb-3 min-w-0 max-w-full pt-0.5 max-lg:mb-4 lg:mb-8">
            <Suspense fallback={<SurfboardListingIdentityFallback variant="breadcrumbs" {...identityView} />}>
              <SurfboardListingIdentity variant="breadcrumbs" {...identityView} {...identityKey} />
            </Suspense>
          </div>

          {isSold && (
            <div className="mx-auto mb-6 w-full min-w-0 max-w-full lg:mb-8">
              <Suspense fallback={<ListingSoldDetailNotice />}>
                <SurfboardListingSoldNotice listingId={board.id} />
              </Suspense>
            </div>
          )}

          <div className="mx-auto grid w-full min-w-0 max-w-full gap-x-8 gap-y-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-rows-[auto_auto_auto] lg:[grid-template-areas:'gallery_details'_'about_details'_'similar_similar'] lg:items-start lg:gap-x-12 lg:gap-y-0 xl:gap-x-16">
            {/* Images */}
            <div className="min-w-0 max-lg:order-1 md:mx-auto md:max-w-[24rem] lg:[grid-area:gallery] lg:order-none lg:mx-0 lg:w-full lg:max-w-[26rem] lg:justify-self-start xl:max-w-[28rem]">
              {!(isSold && isOwnListing) && (
                <ListingPhotosPendingBanner imageCount={images.length} isOwner={isOwnListing} />
              )}
              <div className="relative isolate">
                <ImageGallery
                  images={images}
                  video={video}
                  title={capitalizeWords(board.title)}
                  sold={isSold}
                  compactMobile
                  dimensionsLine={dimensionsLine}
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
                            heartAccent="listingPdp"
                            className="h-11 w-11 min-h-11 min-w-11"
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
              <Suspense
                fallback={
                  <SurfboardListingIdentityFallback
                    variant="catalog"
                    className="mt-1.5 lg:hidden"
                    {...identityView}
                  />
                }
              >
                <SurfboardListingIdentity
                  variant="catalog"
                  className="mt-1.5 lg:hidden"
                  {...identityView}
                  {...identityKey}
                />
              </Suspense>
            </div>

            <div className="min-w-0 max-w-full max-lg:order-2 lg:hidden">
              <ListingMobileBuySummary
                listingId={board.id}
                isLoggedIn={!!user}
                priceUsd={isSold ? publicListPriceUsd : board.price}
                isSold={isSold}
                soldShipped={false}
                shippingPriceCaption={shippingPriceCaption}
                shippingOffered={shippingOffered}
                pickupOffered={pickupOffered}
                shippingCostMode={boardShippingCostMode}
                shippingFlatRate={shippingFlatRate}
                locationLine={listingLocationLine}
                showScarcity={canPeerPurchase && board.status === "active"}
                views={listingViews}
                offerToCart={offerToCart}
                engagement={
                  isSold ? undefined : (
                    <Suspense
                      fallback={
                        <ListingDetailEngagementMetrics
                          views={listingViews}
                          watchers={0}
                          cartHolderCount={0}
                          omitSocialCounts
                          className="text-[13px]"
                        />
                      }
                    >
                      <SurfboardListingEngagementMetrics
                        sellerId={sellerId}
                        listingId={board.id}
                        isSold={false}
                        views={listingViews}
                        offerToCart={offerToCart}
                        className="text-[13px]"
                      />
                    </Suspense>
                  )
                }
                scarcityNote={
                  canPeerPurchase && board.status === "active" ? (
                    <Suspense fallback={null}>
                      <SurfboardListingCartScarcityNote sellerId={sellerId} listingId={board.id} />
                    </Suspense>
                  ) : undefined
                }
                soldStatusNote={
                  isSold ? (
                    <Suspense fallback={null}>
                      <SurfboardListingSoldStatusNote listingId={board.id} />
                    </Suspense>
                  ) : undefined
                }
                createdAt={board.created_at}
                showPurchaseProtection={canPeerPurchase}
                agreedPriceUsd={buyerAgreedPriceUsd}
                compareAtPriceUsd={isSold ? null : compareAtPriceUsd}
                afterPrice={
                  boardSpecRows.length > 0 ? (
                    <ListingBoardSpecTable rows={boardSpecRows} />
                  ) : null
                }
              >
                {canPeerPurchase ? (
                  <Suspense fallback={<ListingDetailPeerPurchaseActionsFallback />}>
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
                  </Suspense>
                ) : null}
              </ListingMobileBuySummary>
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
                <Suspense
                  fallback={
                    <SurfboardListingIdentityFallback variant="catalog" className="mt-2" {...identityView} />
                  }
                >
                  <SurfboardListingIdentity variant="catalog" className="mt-2" {...identityView} {...identityKey} />
                </Suspense>
                {isSold ? (
                  <Suspense fallback={null}>
                    <SurfboardListingShippedDetail listingId={board.id} />
                  </Suspense>
                ) : null}
                {isSold ? (
                  <p className="font-headline mt-4 text-4xl font-semibold tracking-tight text-[#163060] tabular-nums xl:text-[2.5rem]">
                    Sold for ${publicListPriceUsd.toFixed(2)}
                  </p>
                ) : (
                  <>
                    <div className="mt-4">
                      <p className="text-4xl font-bold tracking-tight text-foreground tabular-nums xl:text-[2.625rem] xl:leading-none">
                        <ListingPriceWithMarkdown
                          priceUsd={listPriceNum}
                          compareAtPriceUsd={compareAtPriceUsd}
                          priceClassName="text-4xl font-bold tracking-tight text-foreground tabular-nums xl:text-[2.625rem] xl:leading-none"
                          compareClassName="text-xl font-medium text-muted-foreground line-through tabular-nums xl:text-2xl"
                        />
                      </p>
                      <ListingPdpDeliveryCaption
                        shippingOffered={shippingOffered}
                        pickupOffered={pickupOffered}
                        shippingPriceCaption={shippingPriceCaption}
                        locationLine={listingLocationLine}
                      />
                      {listingPurchasable ? (
                        <ListingKlarnaAsLowAs listingId={board.id} isLoggedIn={!!user} className="mt-2" />
                      ) : null}
                    </div>
                    {buyerAgreedPriceUsd != null ? (
                      <p className="mt-2 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
                        Your accepted price: ${buyerAgreedPriceUsd.toFixed(2)} at checkout
                      </p>
                    ) : null}
                  </>
                )}
                <ListingBoardSpecTable rows={boardSpecRows} className="mt-5" />
                {!isSold && !isOwnListing && listingPurchasable && board.status === "active" ? (
                  <p className="mt-4 flex items-start gap-2 text-[15px] text-foreground">
                    <Hourglass className="mt-0.5 h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      <span className="font-semibold">Only one available</span>
                      <span className="text-muted-foreground"> — grab it before it&apos;s gone</span>
                    </span>
                  </p>
                ) : null}
                {canPeerPurchase ? (
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
                    <Suspense fallback={<ListingDetailPeerPurchaseActionsFallback />}>
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
                    </Suspense>
                  </div>
                )}
              </div>

              {(listedRelative || !isSold) && (
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-neutral-200/90 pb-4 text-[14px] text-muted-foreground dark:border-neutral-700/70">
                  {listedRelative ? (
                    <span>
                      Listed: <span className="font-medium text-foreground/80">{listedRelative}</span>
                    </span>
                  ) : null}
                  {!isSold ? (
                    <Suspense
                      fallback={
                        <ListingDetailEngagementMetrics
                          views={listingViews}
                          watchers={0}
                          cartHolderCount={0}
                          omitSocialCounts
                          className="max-lg:hidden"
                        />
                      }
                    >
                      <SurfboardListingEngagementMetrics
                        sellerId={sellerId}
                        listingId={board.id}
                        isSold={false}
                        views={listingViews}
                        offerToCart={offerToCart}
                        className="max-lg:hidden"
                      />
                    </Suspense>
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

              <Suspense fallback={null}>
                <SurfboardListingPlatformRating
                  sellerId={sellerId}
                  listingId={board.id}
                  isSold={isSold}
                  className="mt-5"
                />
              </Suspense>

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
                    listingId={board.id}
                    canRelist={canSellerRelist}
                  />
                </div>
              )}

              {isOwnListing ? (
                <Suspense fallback={null}>
                  <ListingOwnerManageActions
                    listingId={board.id}
                    section="surfboards"
                    currentPriceUsd={listPriceNum}
                    currentCompareAtPriceUsd={compareAtPriceUsd}
                    listingStatus={String(board.status ?? "")}
                    hiddenFromSite={board.hidden_from_site === true}
                    enrichmentGaps={computeListingEnrichmentGaps({
                      section: "surfboards",
                      description: board.description,
                      dimensions: (board as { dimensions?: string | null }).dimensions,
                      shippingAvailable: board.shipping_available,
                      photoCount: images.length,
                    })}
                  />
                </Suspense>
              ) : null}
            </div>

            <div className="col-span-full min-w-0 max-w-full max-lg:order-3 lg:col-span-1 lg:[grid-area:about] lg:order-none lg:border-t lg:border-neutral-200/90 lg:pt-5 dark:lg:border-neutral-700/70 xl:pt-6">
              <Accordion
                type="multiple"
                defaultValue={["about", "shipping"]}
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

                <ListingFulfillmentAccordionItem
                  pickupOffered={pickupOffered}
                  shippingOffered={shippingOffered}
                  locationLine={listingLocationLine}
                  itemNoun="board"
                  shippingCostMode={boardShippingCostMode}
                  shippingFlatRate={shippingFlatRate}
                  inspectBeforePay
                />

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

          </div>

          <Suspense fallback={<SurfboardListingPdpCatalogStripsFallback />}>
            <SurfboardListingPdpCatalogStrips
              board={{
                id: board.id,
                user_id: board.user_id,
                price: board.price,
                board_type: board.board_type,
              }}
              viewerUser={user}
            />
          </Suspense>
        </div>
      </main>
  )
}
