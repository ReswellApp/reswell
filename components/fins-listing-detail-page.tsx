import type { ComponentProps } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Flag, Hourglass } from "lucide-react"
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
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { ImageGallery } from "@/components/image-gallery"
import { primaryListingVideo } from "@/lib/primary-listing-video"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import { cn } from "@/lib/utils"
import {
  ListingSoldDetailNotice,
  ListingSoldOwnerNotice,
} from "@/components/listing-sold-detail-notice"
import { TranslateableDescription } from "@/components/translateable-description"
import { boardFulfillmentDetailLabels } from "@/lib/listing-fulfillment"
import {
  ListingAboutSellerSection,
  ListingBuyerProtectionTrustRibbon,
  ListingProtectionTrustRibbon,
} from "@/components/features/listings/listing-about-seller-section"
import { ListingFulfillmentAccordionItem } from "@/components/features/listings/listing-fulfillment-accordion-item"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { getBrandById } from "@/lib/brands/server"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"
import { ListingDetailEngagementMetrics } from "@/components/listing-detail-engagement-metrics"
import { ListingKlarnaAsLowAs } from "@/components/features/listings/listing-klarna-as-low-as"
import { ListingMobileBuySummary } from "@/components/features/listings/listing-mobile-buy-summary"
import { ListingDetailPeerPurchaseActionsLoader } from "@/components/listing-detail-peer-purchase-actions-loader"
import { MetaViewContentTracker } from "@/components/meta/meta-view-content-tracker"
import { isMetaCatalogEligibleListing } from "@/lib/meta/catalog-product"
import { fetchAcceptedOfferForBuyerListing } from "@/lib/db/offers"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import {
  publicListingCompareAtPriceUsd,
  publicListingListPriceUsd,
} from "@/lib/utils/public-listing-price"
import {
  HomePeerListingScrollTile,
  HomeListingScrollRow,
} from "@/components/features/home"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"
import {
  getCachedReswellPlatformReviewSummary,
  getCachedSellerReviewSummary,
} from "@/lib/cache/review-summaries"
import { ReswellPlatformRatingWidget } from "@/components/features/reswell/reswell-platform-rating-widget"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { getListingFavoriteCount } from "@/lib/db/listing-favorite-count"
import { formatDistanceToNow } from "date-fns"
import { FINS_SECTION, finSizeLabel, finSystemLabel } from "@/lib/fin-listing-config"
import { parseFinsSetupFromStorage, FIN_SETUP_LABELS } from "@/lib/listing-fin-setup-tags"

type AboutSellerProfilesProp = ComponentProps<typeof ListingAboutSellerSection>["profiles"]

type GalleryImage = {
  id: string
  url: string
  is_primary: boolean
  thumbnail_url?: string | null
  sort_order?: number | null
}

const SELLER_FINS_PDP_LIMIT = 12

/** Human-readable fin setup label(s) from the comma-serialized fins_setup value. */
function finSetupDisplay(raw: string | null | undefined): string | null {
  const slugs = parseFinsSetupFromStorage(raw)
  if (slugs.length === 0) return null
  return slugs.map((s) => FIN_SETUP_LABELS[s]).join(", ")
}

export async function FinsListingDetailPage({
  listingParam,
  prefetchedListing,
  viewerUser,
}: ListingDetailPageSharedProps) {
  const { supabase, user, listing: finRaw, canSellerRelist } = await loadListingDetailPageContext({
    listingParam,
    prefetchedListing,
    viewerUser,
    section: FINS_SECTION,
  })
  const fin = finRaw as Record<string, any> | null

  if (!fin) {
    notFound()
  }

  delete fin.seller_purchase_price_usd

  const p = fin.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    fin.profiles = {
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

  const sellerId = fin.user_id as string
  const isSold = fin.status === "sold"
  const finHref = listingDetailHref({ id: fin.id as string, slug: fin.slug as string | null })
  const brandId = (fin.brand_id as string | null)?.trim() ?? ""

  // Wave 1: everything that depends only on the listing row runs in parallel.
  const [
    sellerReviewSummaryRes,
    sellerReviewPreviewRes,
    reswellPlatformReviewSummaryRes,
    sellerFinsRes,
    indexBrand,
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
      .eq("section", FINS_SECTION)
      .eq("hidden_from_site", false)
      .neq("id", fin.id)
      .order("created_at", { ascending: false })
      .limit(SELLER_FINS_PDP_LIMIT),
    brandId ? getBrandById(supabase, brandId) : Promise.resolve(null),
    Promise.all([
      !isSold ? getListingCartHolderCount(supabase, fin.id) : Promise.resolve(0),
      !isSold ? getListingFavoriteCount(supabase, fin.id) : Promise.resolve(0),
    ]),
  ])

  const { avgRating: sellerAvgRating, reviewCount: sellerReviewCount } =
    sellerReviewSummaryRes
  const sellerReviewPreviews = sellerReviewPreviewRes.data ?? []
  const reswellPlatformReviewSummary = reswellPlatformReviewSummaryRes
  const sellerFins = sellerFinsRes.data

  const sellerFinIds = (sellerFins ?? []).map((f) => f.id)
  const isOwnListingViewer = user?.id === fin.user_id

  // Wave 2: viewer-dependent lookups in parallel, favorites coalesced into one query.
  const [favoriteRowsRes, acceptedOffer] = await Promise.all([
    user
      ? supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)
          .in("listing_id", [fin.id, ...sellerFinIds])
      : Promise.resolve({ data: null }),
    user && !isOwnListingViewer && fin.status === "active"
      ? fetchAcceptedOfferForBuyerListing(supabase, user.id, fin.id)
      : Promise.resolve(null),
  ])

  const favoritedIds = new Set(
    (favoriteRowsRes.data ?? []).map((f: { listing_id: string }) => f.listing_id),
  )
  const isFavorited = favoritedIds.has(fin.id)
  const sellerFinFavoritedIds = sellerFinIds.filter((id) => favoritedIds.has(id))

  const images: GalleryImage[] =
    (fin.listing_images as GalleryImage[] | null)
      ?.slice()
      .sort(
        (a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ) || []

  const video = primaryListingVideo(
    (
      fin as {
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

  const isOwnListing = user?.id === fin.user_id

  const pickupOffered = fin.local_pickup !== false
  const shippingOffered = !!fin.shipping_available

  const canPeerPurchase =
    !isOwnListing &&
    !isSold &&
    (fin.status === "active" || fin.status === "pending_sale") &&
    (pickupOffered || shippingOffered)

  const freeBrandLabel = (fin.brand as string | null)?.trim() ?? ""
  const specsBrandLabel = (indexBrand?.name ?? freeBrandLabel).trim() || null
  const specsBrandHref = indexBrand ? `${BRANDS_BASE}/${indexBrand.slug}` : null
  const modelForSpecs = (fin.model as string | null)?.trim() || null

  const sizeLabel = finSizeLabel(fin.fin_size as string | null)
  const setupLabel = finSetupDisplay(fin.fins_setup as string | null)
  const systemLabel = finSystemLabel(fin.fin_system as string | null)

  const listingTitle = capitalizeWords(fin.title as string)
  const metaCatalogEligible = isMetaCatalogEligibleListing(fin)

  const listPriceNum =
    typeof fin.price === "number" ? fin.price : Number.parseFloat(String(fin.price)) || 0
  const publicListPriceUsd = publicListingListPriceUsd(fin.price)
  const compareAtPriceUsd = publicListingCompareAtPriceUsd(
    (fin as { compare_at_price?: string | number | null }).compare_at_price,
    listPriceNum,
  )
  const buyerOffersOn = (fin.buyer_offers_enabled as boolean | null) !== false
  const offerPct = effectiveMinimumOfferPct(fin as { minimum_offer_pct?: number | null })
  const minOfferAmount = Math.round(listPriceNum * (offerPct / 100) * 100) / 100
  const acceptOffers = buyerOffersOn

  const primaryImageRaw =
    (images[0] as { thumbnail_url?: string | null; url?: string | null } | undefined)
      ?.thumbnail_url ||
    (images[0] as { url?: string | null } | undefined)?.url ||
    null
  const primaryImageUrl = primaryImageRaw ? proxiedListingImageSrc(primaryImageRaw) : null

  const shippingFlatRate = Math.max(0, Number.parseFloat(String(fin.shipping_price ?? 0)) || 0)

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
          shippingFlatRate,
          shippingCostMode:
            (fin.board_shipping_cost_mode as "reswell" | "flat" | "free" | null) ?? null,
        }
      : undefined

  let buyerAgreedPriceUsd: number | null = null
  if (acceptedOffer && acceptedOffer.seller_id === fin.user_id) {
    const n = Math.round(parseFloat(String(acceptedOffer.current_amount)) * 100) / 100
    if (Number.isFinite(n) && n > 0) buyerAgreedPriceUsd = n
  }

  const listingLocationLine =
    fin.city && fin.state
      ? `${fin.city}, ${fin.state}`
      : (fin.profiles as { location?: string | null } | null)?.location?.trim() || null

  const boardShippingCostMode =
    (fin.board_shipping_cost_mode as "reswell" | "flat" | "free" | null) ?? null

  const fulfillmentLabels = boardFulfillmentDetailLabels(
    fin.local_pickup,
    fin.shipping_available,
    fin.shipping_price,
    boardShippingCostMode,
  )
  const specSubline = fulfillmentLabels.length > 0 ? fulfillmentLabels.join(" · ") : null

  const conditionWords = formatCondition(fin.condition as string | null)

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
    }
  }

  const listingViews = Number((fin.views as number | null) ?? 0)
  let listedRelative: string | null = null
  if (fin.created_at != null) {
    const d = new Date(fin.created_at as string | number | Date)
    if (!Number.isNaN(d.getTime())) {
      listedRelative = formatDistanceToNow(d, { addSuffix: true })
    }
  }

  const softPanelClass =
    "rounded-2xl border border-border/50 bg-muted/30 px-4 py-4 dark:border-border dark:bg-muted/15"

  const favoriteNextToOffer = !!(canPeerPurchase && makeOfferConfig)
  const showShareOnGalleryOverlay = isOwnListing || !favoriteNextToOffer
  const showFavoriteOnGalleryOverlay = !isOwnListing

  const specRows = [
    sizeLabel ? { label: "Size", value: sizeLabel } : null,
    setupLabel ? { label: "Fin setup", value: setupLabel } : null,
    systemLabel ? { label: "Fin system", value: systemLabel } : null,
    specsBrandLabel
      ? {
          label: "Brand",
          value: specsBrandLabel,
          href: specsBrandHref,
        }
      : null,
    modelForSpecs ? { label: "Model", value: modelForSpecs } : null,
  ].filter(Boolean) as { label: string; value: string; href?: string | null }[]

  const aboutSellerSection = (
    <ListingAboutSellerSection
      profiles={fin.profiles as AboutSellerProfilesProp}
      listingImageFallbacks={[{ listing_images: fin.listing_images }]}
      sellerProfileHref={sellerProfileHref(fin.profiles)}
      messageHrefAuthenticated={`/messages/new?user=${fin.user_id}&listing=${fin.id}`}
      messageHrefLoginRedirect={`/auth/login?redirect=${encodeURIComponent(finHref)}`}
      isLoggedIn={!!user}
      isOwnListing={isOwnListing}
      isSold={isSold}
      avgRating={sellerAvgRating}
      reviewCount={sellerReviewCount}
      itemsSold={Number((fin.profiles as { sales_count?: number } | null)?.sales_count ?? 0)}
      previewReviews={sellerReviewPreviews}
      showTrustRibbon={false}
    />
  )

  return (
    <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-2 sm:pb-24 sm:pt-3 lg:pt-8">
      {metaCatalogEligible ? (
        <MetaViewContentTracker
          listingId={fin.id}
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
                  <Link href="/fins">Fins</Link>
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
                          listingId={fin.id}
                          redirectPath={finHref}
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
          </div>

          {/* Mobile price/actions block */}
          <div className="min-w-0 max-w-full max-lg:order-2 lg:hidden">
            <ListingMobileBuySummary
              listingId={fin.id}
              isLoggedIn={!!user}
              condition={fin.condition as string | null}
              priceUsd={isSold ? publicListPriceUsd : listPriceNum}
              isSold={isSold}
              shippingPriceCaption={shippingPriceCaption}
              shippingOffered={shippingOffered}
              pickupOffered={pickupOffered}
              shippingCostMode={boardShippingCostMode}
              shippingFlatRate={shippingFlatRate}
              locationLine={listingLocationLine}
              showScarcity={!isSold && !isOwnListing && fin.status === "active"}
              views={listingViews}
              watchers={listingWatchersCount}
              cartHolderCount={cartHolderCount}
              offerToCart={
                isOwnListing && user
                  ? { listingId: fin.id, sellerUserId: user.id, listingTitle, listPrice: listPriceNum }
                  : null
              }
              createdAt={fin.created_at}
              showPurchaseProtection={!isSold && !isOwnListing}
              agreedPriceUsd={buyerAgreedPriceUsd}
                compareAtPriceUsd={isSold ? null : compareAtPriceUsd}
            >
              {canPeerPurchase ? (
                <ListingDetailPeerPurchaseActionsLoader
                  listingId={fin.id}
                  checkoutListingParam={fin.slug ?? fin.id}
                  section="fins"
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
                    {shippingPriceCaption ? (
                      <p className="mt-1.5 text-[15px] text-muted-foreground">{shippingPriceCaption}</p>
                    ) : null}
                    <ListingKlarnaAsLowAs listingId={fin.id} isLoggedIn={!!user} className="mt-2" />
                  </div>
                  {buyerAgreedPriceUsd != null ? (
                    <p className="mt-2 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
                      Your accepted price: ${buyerAgreedPriceUsd.toFixed(2)} at checkout
                    </p>
                  ) : null}
                </>
              )}
              {!isSold && !isOwnListing && fin.status === "active" ? (
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
                  .
                </p>
              ) : null}
              {canPeerPurchase && (
                <div className="mt-5">
                  <ListingDetailPeerPurchaseActionsLoader
                    listingId={fin.id}
                    checkoutListingParam={fin.slug ?? fin.id}
                    section="fins"
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
                    offerToCart={
                      isOwnListing && user
                        ? { listingId: fin.id, sellerUserId: user.id, listingTitle, listPrice: listPriceNum }
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
                  href={`/contact?topic=listing-report&listing=${encodeURIComponent(fin.id)}`}
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
                  listingId={fin.id as string}
                  canRelist={canSellerRelist}
                />
              </div>
            )}

            {isOwnListing && !isSold ? (
              <ListingOwnerManageActions
                listingId={fin.id}
                section="fins"
                currentPriceUsd={listPriceNum}
                  currentCompareAtPriceUsd={compareAtPriceUsd}
                listingStatus={String(fin.status ?? "")}
                hiddenFromSite={fin.hidden_from_site === true}
              />
            ) : null}
          </div>

          <div className="col-span-full min-w-0 max-w-full max-lg:order-3 lg:col-span-1 lg:[grid-area:about] lg:order-none lg:border-t lg:border-neutral-200/90 lg:pt-5 dark:lg:border-neutral-700/70 xl:pt-6">
            <Accordion type="multiple" defaultValue={["about", "specs", "shipping"]} className="w-full">
              <AccordionItem value="about" className="border-border/55">
                <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:text-foreground">
                  About this listing
                </AccordionTrigger>
                <AccordionContent className="pb-6 pt-0">
                  <div className="text-[16px] leading-[1.65] text-foreground">
                    <TranslateableDescription
                      text={(fin.description as string) || ""}
                      className="text-foreground"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {specRows.length > 0 ? (
                <AccordionItem value="specs" className="border-border/55">
                  <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                    Fin specs
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pt-0">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                      {specRows.map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border/40 pb-2">
                          <dt className="text-[14px] text-muted-foreground">{row.label}</dt>
                          <dd className="text-right text-[15px] font-medium text-foreground">
                            {row.href ? (
                              <Link href={row.href} className="underline decoration-dashed underline-offset-2 hover:no-underline">
                                {row.value}
                              </Link>
                            ) : (
                              row.value
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              <ListingFulfillmentAccordionItem
                pickupOffered={pickupOffered}
                shippingOffered={shippingOffered}
                locationLine={listingLocationLine}
                itemNoun="fins"
                shippingCostMode={boardShippingCostMode}
                shippingFlatRate={shippingFlatRate}
              />

              {!isOwnListing && !isSold ? (
                <AccordionItem value="contact" className="border-border/55">
                  <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                    Contact seller
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pt-0">
                    <ContactSellerForm
                      listingId={fin.id}
                      listingSlug={fin.slug}
                      sellerId={fin.user_id}
                      listingTitle={listingTitle}
                      isLoggedIn={!!user}
                      section="fins"
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

        {sellerFins && sellerFins.length > 0 && (
          <section className="mt-16 min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
            <h2 className="mb-8 text-2xl font-bold text-foreground">More fins from this seller</h2>
            <HomeListingScrollRow uniformCardHeights>
              {sellerFins.map((item) => (
                <HomePeerListingScrollTile
                  key={item.id}
                  listing={item}
                  userId={user?.id ?? null}
                  isFavorited={sellerFinFavoritedIds.includes(item.id)}
                />
              ))}
            </HomeListingScrollRow>
          </section>
        )}
      </div>
    </main>
  )
}
