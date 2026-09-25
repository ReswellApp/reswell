import type { ComponentProps } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Flag, Hourglass, Truck } from "lucide-react"
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
import { capitalizeWords } from "@/lib/listing-labels"
import {
  loadListingDetailPageContext,
  type ListingDetailPageSharedProps,
} from "@/lib/listing-detail-page-load"
import { renderListingDetailWithGuestFallback } from "@/lib/listing-detail-page-safe-render"
import { ShareButton } from "@/components/share-button"
import { ListingOwnerManageActions } from "@/components/features/listings/listing-owner-manage-actions"
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { ImageGallery } from "@/components/image-gallery"
import { primaryListingVideo } from "@/lib/primary-listing-video"
import { orderedListingGalleryImages } from "@/lib/listing-image-display"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { ListingBoardSpecTable } from "@/components/features/listings/listing-board-spec-table"
import { ListingCatalogIdentity } from "@/components/features/listings/listing-catalog-identity"
import { ListingPdpDeliveryCaption } from "@/components/features/listings/listing-pdp-delivery-caption"
import { listingConditionSpecRow } from "@/lib/utils/listing-board-spec-rows"
import { ListingRelatedContentSection } from "@/components/features/listings/listing-related-content-section"
import { fetchSimilarPeerListingsForListingPdp } from "@/lib/db/listing-detail-similar-peer"
import { FavoriteButton } from "@/components/favorite-button"
import { cn } from "@/lib/utils"
import {
  ListingSoldDetailNotice,
  ListingSoldOwnerNotice,
} from "@/components/listing-sold-detail-notice"
import { TranslateableDescription } from "@/components/translateable-description"
import {
  ListingAboutSellerSection,
  ListingBuyerProtectionTrustRibbon,
  ListingProtectionTrustRibbon,
} from "@/components/features/listings/listing-about-seller-section"
import { MAGAZINES_SECTION } from "@/lib/magazine-listing-config"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"
import { flatShippingUsdForPublicListing } from "@/lib/listing-fulfillment"
import { ListingDetailEngagementMetrics } from "@/components/listing-detail-engagement-metrics"
import { ListingKlarnaAsLowAs } from "@/components/features/listings/listing-klarna-as-low-as"
import {
  canShowPeerListingPurchaseActions,
  isListingPurchasable,
} from "@/lib/listing-public-visibility"
import { ListingMobileBuySummary } from "@/components/features/listings/listing-mobile-buy-summary"
import { ListingDetailPeerPurchaseActionsLoader } from "@/components/listing-detail-peer-purchase-actions-loader"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import {
  publicListingCompareAtPriceUsd,
  publicListingListPriceUsd,
} from "@/lib/utils/public-listing-price"
import {
  HomePeerListingScrollTile,
  HomeListingScrollRow,
  type HomePeerScrollListing,
} from "@/components/features/home"
import {
  HOME_PEER_LISTING_WITH_PROFILE_SELECT,
  hydrateHomePeerListingRows,
} from "@/lib/db/home-peer-listing-feed"
import {
  getCachedReswellPlatformReviewSummary,
  getCachedSellerReviewSummary,
} from "@/lib/cache/review-summaries"
import { listSellerReviewPreviews } from "@/lib/db/order-reviews"
import { ReswellPlatformRatingWidget } from "@/components/features/reswell/reswell-platform-rating-widget"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { getListingFavoriteCount } from "@/lib/db/listing-favorite-count"
import { formatDistanceToNow } from "date-fns"
import { MetaViewContentTracker } from "@/components/meta/meta-view-content-tracker"
import { isMetaCatalogEligibleListing, type MetaListingProductSource } from "@/lib/meta/catalog-product"

type AboutSellerProfilesProp = ComponentProps<typeof ListingAboutSellerSection>["profiles"]

type GalleryImage = {
  id: string
  url: string
  is_primary: boolean
  thumbnail_url?: string | null
  sort_order?: number | null
}

const SELLER_MAGAZINES_PDP_LIMIT = 12

export async function MagazinesListingDetailPage(props: ListingDetailPageSharedProps) {
  return renderListingDetailWithGuestFallback(props, renderMagazinesListingDetailPage)
}

async function renderMagazinesListingDetailPage({
  listingParam,
  prefetchedListing,
  viewerUser,
}: ListingDetailPageSharedProps) {
  const { supabase, user, listing: magazineRaw, canSellerRelist } = await loadListingDetailPageContext({
    listingParam,
    prefetchedListing,
    viewerUser,
    section: MAGAZINES_SECTION,
  })
  const magazine = magazineRaw as Record<string, any> | null

  if (!magazine) {
    notFound()
  }

  delete magazine.seller_purchase_price_usd

  const p = magazine.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    magazine.profiles = {
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

  const sellerId = magazine.user_id as string
  const isSold = magazine.status === "sold"
  const magazineHref = listingDetailHref({ id: magazine.id as string, slug: magazine.slug as string | null })

  const listPriceNum =
    typeof magazine.price === "number" ? magazine.price : Number.parseFloat(String(magazine.price)) || 0

  const [
    sellerReviewSummaryRes,
    sellerReviewPreviewRes,
    reswellPlatformReviewSummaryRes,
    sellerMagazinesRes,
    similarMagazinesRaw,
    [cartHolderCount, listingWatchersCount],
  ] = await Promise.all([
    getCachedSellerReviewSummary(sellerId),
    listSellerReviewPreviews(supabase, sellerId),
    getCachedReswellPlatformReviewSummary(),
    supabase
      .from("listings")
      .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
      .eq("user_id", sellerId)
      .eq("status", "active")
      .eq("section", MAGAZINES_SECTION)
      .eq("hidden_from_site", false)
      .neq("id", magazine.id)
      .order("created_at", { ascending: false })
      .limit(SELLER_MAGAZINES_PDP_LIMIT),
    fetchSimilarPeerListingsForListingPdp(supabase, {
      excludeListingId: magazine.id as string,
      section: MAGAZINES_SECTION,
      priceUsd: listPriceNum,
      facet: { column: "magazine_year", value: magazine.magazine_year as number | string | null },
    }),
    Promise.all([
      !isSold ? getListingCartHolderCount(supabase, magazine.id) : Promise.resolve(0),
      !isSold ? getListingFavoriteCount(supabase, magazine.id) : Promise.resolve(0),
    ]),
  ])

  const { avgRating: sellerAvgRating, reviewCount: sellerReviewCount } =
    sellerReviewSummaryRes
  const sellerReviewPreviews = sellerReviewPreviewRes.data ?? []
  const reswellPlatformReviewSummary = reswellPlatformReviewSummaryRes
  const sellerMagazines = hydrateHomePeerListingRows((sellerMagazinesRes.data ?? []) as Record<string, unknown>[])
  const similarMagazines = hydrateHomePeerListingRows(similarMagazinesRaw)

  const sellerMagazineIds = (sellerMagazines ?? []).map((f) => f.id)
  const similarMagazineIds = similarMagazines.map((r) => String(r.id))

  const [favoriteRowsRes] = await Promise.all([
    user
      ? supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)
          .in("listing_id", [magazine.id, ...sellerMagazineIds, ...similarMagazineIds])
      : Promise.resolve({ data: null }),
  ])

  const favoritedIds = new Set(
    (favoriteRowsRes.data ?? []).map((f: { listing_id: string }) => f.listing_id),
  )
  const isFavorited = favoritedIds.has(magazine.id)
  const sellerMagazineFavoritedIds = sellerMagazineIds.filter((id) => favoritedIds.has(id))
  const similarMagazineFavoritedIds = similarMagazineIds.filter((id) => favoritedIds.has(id))

  const images = orderedListingGalleryImages(magazine.listing_images as GalleryImage[] | null)

  const video = primaryListingVideo(
    (
      magazine as {
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

  const isOwnListing = user?.id === magazine.user_id

  const shippingOffered = !!magazine.shipping_available

  const purchaseVisibility = {
    status: String(magazine.status ?? ""),
    title: magazine.title as string | null | undefined,
    hidden_from_site: magazine.hidden_from_site as boolean | null | undefined,
    archived_at: magazine.archived_at as string | null | undefined,
  }
  const listingPurchasable = isListingPurchasable(purchaseVisibility)
  const canPeerPurchase = canShowPeerListingPurchaseActions({
    isOwnListing,
    listing: purchaseVisibility,
    fulfillmentAvailable: shippingOffered,
  })

  const specsBrandLabel = ((magazine.brand as string | null)?.trim() ?? "") || null
  const magazineYearRaw = magazine.magazine_year as number | string | null | undefined
  const magazineYear =
    typeof magazineYearRaw === "number" && Number.isFinite(magazineYearRaw)
      ? String(magazineYearRaw)
      : typeof magazineYearRaw === "string" && magazineYearRaw.trim()
        ? magazineYearRaw.trim()
        : null

  const listingTitle = capitalizeWords(magazine.title as string)
  const metaCatalogEligible = isMetaCatalogEligibleListing(
    magazine as unknown as MetaListingProductSource,
  )

  const publicListPriceUsd = publicListingListPriceUsd(magazine.price)
  const compareAtPriceUsd = publicListingCompareAtPriceUsd(
    (magazine as { compare_at_price?: string | number | null }).compare_at_price,
    listPriceNum,
  )

  const shippingFlatRate = flatShippingUsdForPublicListing(
    magazine.shipping_price,
    (magazine.board_shipping_cost_mode as "reswell" | "flat" | "free" | null) ?? null,
  )

  const listingLocationLine =
    magazine.city && magazine.state
      ? `${magazine.city}, ${magazine.state}`
      : (magazine.profiles as { location?: string | null } | null)?.location?.trim() || null

  const boardShippingCostMode =
    (magazine.board_shipping_cost_mode as "reswell" | "flat" | "free" | null) ?? null

  let shippingPriceCaption: string | null = null
  if (!isSold && shippingOffered) {
    if (boardShippingCostMode === "free") {
      shippingPriceCaption = "Free shipping included"
    } else if (boardShippingCostMode === "reswell") {
      shippingPriceCaption = "Shipping rate calculated at checkout"
    } else if (shippingFlatRate > 0) {
      shippingPriceCaption = `+ $${shippingFlatRate.toFixed(2)} shipping`
    } else if (boardShippingCostMode === "flat") {
      shippingPriceCaption =
        shippingFlatRate > 0
          ? `+ $${shippingFlatRate.toFixed(2)} shipping`
          : "Flat shipping at checkout"
    }
  }

  const listingViews = Number((magazine.views as number | null) ?? 0)
  let listedRelative: string | null = null
  if (magazine.created_at != null) {
    const d = new Date(magazine.created_at as string | number | Date)
    if (!Number.isNaN(d.getTime())) {
      listedRelative = formatDistanceToNow(d, { addSuffix: true })
    }
  }

  const softPanelClass =
    "rounded-2xl border border-border/50 bg-muted/30 px-4 py-4 dark:border-border dark:bg-muted/15"

  const showShareOnGalleryOverlay = true
  const showFavoriteOnGalleryOverlay = !isOwnListing

  const specRows = [
    listingConditionSpecRow(magazine.condition as string | null),
    magazineYear ? { label: "Year", value: magazineYear } : null,
  ].filter(Boolean) as { label: string; value: string; href?: string | null }[]

  const aboutSellerSection = (
    <ListingAboutSellerSection
      profiles={magazine.profiles as AboutSellerProfilesProp}
      listingImageFallbacks={[{ listing_images: magazine.listing_images }]}
      sellerProfileHref={sellerProfileHref(magazine.profiles)}
      messageHrefAuthenticated={`/messages/new?user=${magazine.user_id}&listing=${magazine.id}`}
      messageHrefLoginRedirect={`/auth/login?redirect=${encodeURIComponent(magazineHref)}`}
      isLoggedIn={!!user}
      isOwnListing={isOwnListing}
      isSold={isSold}
      avgRating={sellerAvgRating}
      reviewCount={sellerReviewCount}
      itemsSold={Number((magazine.profiles as { sales_count?: number } | null)?.sales_count ?? 0)}
      previewReviews={sellerReviewPreviews}
      showTrustRibbon={false}
    />
  )

  return (
    <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-2 sm:pb-24 sm:pt-3 lg:pt-8">
      {metaCatalogEligible ? (
        <MetaViewContentTracker
          listingId={magazine.id as string}
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
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                  <Link href="/magazines">Magazines</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                  {listingTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {isSold && (
          <div className="mx-auto mb-6 w-full min-w-0 max-w-full lg:mb-8">
            <ListingSoldDetailNotice shipped={false} />
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
                title={listingTitle}
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
                          listingId={magazine.id}
                          redirectPath={magazineHref}
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
              {listingTitle}
            </h1>
            <ListingCatalogIdentity
              brandName={specsBrandLabel}
              className="mt-1.5 lg:hidden"
            />
          </div>

          {/* Mobile price/actions block */}
          <div className="min-w-0 max-w-full max-lg:order-2 lg:hidden">
            <ListingMobileBuySummary
              listingId={magazine.id}
              isLoggedIn={!!user}
              priceUsd={isSold ? publicListPriceUsd : listPriceNum}
              isSold={isSold}
              shippingPriceCaption={shippingPriceCaption}
              shippingOffered={shippingOffered}
              pickupOffered={false}
              shippingCostMode={boardShippingCostMode}
              shippingFlatRate={shippingFlatRate}
              locationLine={listingLocationLine}
              showScarcity={canPeerPurchase && magazine.status === "active"}
              views={listingViews}
              watchers={listingWatchersCount}
              cartHolderCount={cartHolderCount}
              offerToCart={
                isOwnListing && user
                  ? { listingId: magazine.id, sellerUserId: user.id, listingTitle, listPrice: listPriceNum }
                  : null
              }
              createdAt={magazine.created_at}
              showPurchaseProtection={canPeerPurchase}
              compareAtPriceUsd={isSold ? null : compareAtPriceUsd}
              afterPrice={
                specRows.length > 0 ? <ListingBoardSpecTable rows={specRows} /> : null
              }
            >
              {canPeerPurchase ? (
                <ListingDetailPeerPurchaseActionsLoader
                  listingId={magazine.id}
                  checkoutListingParam={magazine.slug ?? magazine.id}
                  section="magazines"
                  isLoggedIn={!!user}
                />
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
                {listingTitle}
              </h1>
              <ListingCatalogIdentity
                brandName={specsBrandLabel}
                className="mt-2"
              />
              {isSold ? (
                <p className="font-headline mt-4 text-4xl font-semibold tracking-tight text-[#163060] tabular-nums xl:text-[2.5rem]">
                  Sold for ${publicListPriceUsd.toFixed(2)}
                </p>
              ) : (
                <>
                  <div className="mt-4">
                    <p className="text-4xl font-bold tracking-tight text-foreground tabular-nums xl:text-[2.625rem] xl:leading-none">
                      <ListingPriceWithMarkdown
                        priceUsd={isSold ? publicListPriceUsd : listPriceNum}
                        compareAtPriceUsd={compareAtPriceUsd}
                        priceClassName="text-4xl font-bold tracking-tight text-foreground tabular-nums xl:text-[2.625rem] xl:leading-none"
                        compareClassName="text-xl font-medium text-muted-foreground line-through tabular-nums xl:text-2xl"
                      />
                    </p>
                    <ListingPdpDeliveryCaption
                      shippingOffered={shippingOffered}
                      pickupOffered={false}
                      shippingPriceCaption={shippingPriceCaption}
                      locationLine={listingLocationLine}
                    />
                    {listingPurchasable ? (
                      <ListingKlarnaAsLowAs listingId={magazine.id} isLoggedIn={!!user} className="mt-2" />
                    ) : null}
                  </div>
                </>
              )}
              <ListingBoardSpecTable rows={specRows} className="mt-5" />
              {!isSold && !isOwnListing && listingPurchasable && magazine.status === "active" ? (
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
                  <ListingDetailPeerPurchaseActionsLoader
                    listingId={magazine.id}
                    checkoutListingParam={magazine.slug ?? magazine.id}
                    section="magazines"
                    isLoggedIn={!!user}
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
                    offerToCart={
                      isOwnListing && user
                        ? { listingId: magazine.id, sellerUserId: user.id, listingTitle, listPrice: listPriceNum }
                        : null
                    }
                    className="max-lg:hidden"
                  />
                ) : null}
              </div>
            )}

            <div className="mt-5 hidden lg:block">{aboutSellerSection}</div>

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

            <ReswellPlatformRatingWidget summary={reswellPlatformReviewSummary} className="mt-5" />

            {!isOwnListing ? (
              <div className="border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70">
                <Link
                  href={`/contact?topic=listing-report&listing=${encodeURIComponent(magazine.id)}`}
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
                  sectionLabel="listing"
                  listingId={magazine.id as string}
                  canRelist={canSellerRelist}
                />
              </div>
            )}

            {isOwnListing ? (
              <ListingOwnerManageActions
                listingId={magazine.id}
                section="magazines"
                currentPriceUsd={listPriceNum}
                  currentCompareAtPriceUsd={compareAtPriceUsd}
                listingStatus={String(magazine.status ?? "")}
                hiddenFromSite={magazine.hidden_from_site === true}
              />
            ) : null}
          </div>

          <div className="col-span-full min-w-0 max-w-full max-lg:order-3 lg:col-span-1 lg:[grid-area:about] lg:order-none lg:border-t lg:border-neutral-200/90 lg:pt-5 dark:lg:border-neutral-700/70 xl:pt-6">
            <Accordion type="multiple" defaultValue={["about", "shipping"]} className="w-full">
              <AccordionItem value="about" className="border-border/55">
                <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:text-foreground">
                  About this listing
                </AccordionTrigger>
                <AccordionContent className="pb-6 pt-0">
                  <div className="text-[16px] leading-[1.65] text-foreground">
                    <TranslateableDescription
                      text={(magazine.description as string) || ""}
                      className="text-foreground"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="shipping" className="border-border/55">
                <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                  Shipping
                </AccordionTrigger>
                <AccordionContent className="pb-6 pt-0">
                  <div className="space-y-3 text-[16px] leading-[1.65] text-foreground">
                    <p className="font-medium">{listingLocationLine ?? "Location not specified"}</p>
                    <p>
                      Shipped to you after checkout. Confirm your address with the seller in messages.
                    </p>
                    {shippingOffered ? (
                      <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          {boardShippingCostMode === "free"
                            ? "Free shipping"
                            : boardShippingCostMode === "reswell"
                              ? "Shipping calculated at checkout"
                              : shippingFlatRate > 0
                                ? `Flat $${shippingFlatRate.toFixed(2)} shipping`
                                : "Shipping calculated at checkout"}
                        </span>
                      </p>
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
                      listingId={magazine.id}
                      listingSlug={magazine.slug}
                      sellerId={magazine.user_id}
                      listingTitle={listingTitle}
                      isLoggedIn={!!user}
                      section="magazines"
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

            {similarMagazines.length > 0 ? (
              <div className="col-span-full min-w-0 max-w-full max-lg:order-5 lg:[grid-area:similar] lg:order-none">
                <section className="mt-10 border-t border-neutral-200/90 pt-8 dark:border-neutral-700/70">
                  <h2 className="mb-8 text-2xl font-bold text-foreground">Similar magazines</h2>
                  <HomeListingScrollRow uniformCardHeights>
                    {similarMagazines.map((row) => (
                      <HomePeerListingScrollTile
                        key={String(row.id)}
                        listing={row as unknown as HomePeerScrollListing}
                        userId={user?.id ?? null}
                        isFavorited={similarMagazineFavoritedIds.includes(String(row.id))}
                      />
                    ))}
                  </HomeListingScrollRow>
                </section>
              </div>
            ) : null}
        </div>

        <ListingRelatedContentSection listingId={magazine.id as string} variant="embedded" />

        {sellerMagazines && sellerMagazines.length > 0 && (
          <section className="mt-16 min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
            <h2 className="mb-8 text-2xl font-bold text-foreground">More magazines from this seller</h2>
            <HomeListingScrollRow uniformCardHeights>
              {sellerMagazines.map((item) => (
                <HomePeerListingScrollTile
                  key={item.id}
                  listing={item}
                  userId={user?.id ?? null}
                  isFavorited={sellerMagazineFavoritedIds.includes(item.id)}
                />
              ))}
            </HomeListingScrollRow>
          </section>
        )}
      </div>
    </main>
  )
}
