import type { ComponentProps } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Flag, Hourglass, ShoppingCart, Truck } from "lucide-react"
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
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
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
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"
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
import { SURFPACKS_SECTION, surfpackSizeLabel } from "@/lib/surfpack-listing-config"

type AboutSellerProfilesProp = ComponentProps<typeof ListingAboutSellerSection>["profiles"]

type GalleryImage = {
  id: string
  url: string
  is_primary: boolean
  thumbnail_url?: string | null
  sort_order?: number | null
}

const SELLER_SURFPACKS_PDP_LIMIT = 12

export async function SurfpacksListingDetailPage({
  listingParam,
  prefetchedListing,
  viewerUser,
}: ListingDetailPageSharedProps) {
  const { supabase, user, listing: surfpackRaw } = await loadListingDetailPageContext({
    listingParam,
    prefetchedListing,
    viewerUser,
    section: SURFPACKS_SECTION,
  })
  const surfpack = surfpackRaw as Record<string, any> | null

  if (!surfpack) {
    notFound()
  }

  delete surfpack.seller_purchase_price_usd

  const p = surfpack.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    surfpack.profiles = {
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

  const sellerId = surfpack.user_id as string
  const isSold = surfpack.status === "sold"
  const surfpackHref = listingDetailHref({ id: surfpack.id as string, slug: surfpack.slug as string | null })

  const brandId = (surfpack.brand_id as string | null)?.trim() ?? ""

  // Wave 1: everything that depends only on the listing row runs in parallel.
  const [
    sellerReviewSummaryRes,
    sellerReviewPreviewRes,
    reswellPlatformReviewSummaryRes,
    sellerSurfpacksRes,
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
      .eq("section", SURFPACKS_SECTION)
      .eq("hidden_from_site", false)
      .neq("id", surfpack.id)
      .order("created_at", { ascending: false })
      .limit(SELLER_SURFPACKS_PDP_LIMIT),
    brandId ? getBrandById(supabase, brandId) : Promise.resolve(null),
    Promise.all([
      !isSold ? getListingCartHolderCount(supabase, surfpack.id) : Promise.resolve(0),
      !isSold ? getListingFavoriteCount(supabase, surfpack.id) : Promise.resolve(0),
    ]),
  ])

  const { avgRating: sellerAvgRating, reviewCount: sellerReviewCount } =
    sellerReviewSummaryRes
  const sellerReviewPreviews = sellerReviewPreviewRes.data ?? []
  const reswellPlatformReviewSummary = reswellPlatformReviewSummaryRes
  const sellerSurfpacks = sellerSurfpacksRes.data

  const sellerSurfpackIds = (sellerSurfpacks ?? []).map((f) => f.id)

  // Wave 2: viewer-dependent lookups in parallel, favorites coalesced into one query.
  const [favoriteRowsRes, acceptedOffer] = await Promise.all([
    user
      ? supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)
          .in("listing_id", [surfpack.id, ...sellerSurfpackIds])
      : Promise.resolve({ data: null }),
    user && user.id !== surfpack.user_id && surfpack.status === "active"
      ? fetchAcceptedOfferForBuyerListing(supabase, user.id, surfpack.id)
      : Promise.resolve(null),
  ])

  const favoritedIds = new Set(
    (favoriteRowsRes.data ?? []).map((f: { listing_id: string }) => f.listing_id),
  )
  const isFavorited = favoritedIds.has(surfpack.id)
  const sellerSurfpackFavoritedIds = sellerSurfpackIds.filter((id) => favoritedIds.has(id))

  const images: GalleryImage[] =
    (surfpack.listing_images as GalleryImage[] | null)
      ?.slice()
      .sort(
        (a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ) || []

  const isOwnListing = user?.id === surfpack.user_id

  const pickupOffered = surfpack.local_pickup !== false
  const shippingOffered = !!surfpack.shipping_available

  const canPeerPurchase =
    !isOwnListing &&
    !isSold &&
    (surfpack.status === "active" || surfpack.status === "pending_sale") &&
    (pickupOffered || shippingOffered)

  const freeBrandLabel = (surfpack.brand as string | null)?.trim() ?? ""
  const specsBrandLabel = (indexBrand?.name ?? freeBrandLabel).trim() || null
  const specsBrandHref = indexBrand ? `${BRANDS_BASE}/${indexBrand.slug}` : null
  const modelForSpecs = (surfpack.model as string | null)?.trim() || null

  const sizeLabel = surfpackSizeLabel(surfpack.surfpack_size as string | null)

  const listingTitle = capitalizeWords(surfpack.title as string)

  const listPriceNum =
    typeof surfpack.price === "number" ? surfpack.price : Number.parseFloat(String(surfpack.price)) || 0
  const publicListPriceUsd = publicListingListPriceUsd(surfpack.price)
  const buyerOffersOn = (surfpack.buyer_offers_enabled as boolean | null) !== false
  const offerPct = effectiveMinimumOfferPct(surfpack as { minimum_offer_pct?: number | null })
  const minOfferAmount = Math.round(listPriceNum * (offerPct / 100) * 100) / 100
  const acceptOffers = buyerOffersOn

  const primaryImageRaw =
    (images[0] as { thumbnail_url?: string | null; url?: string | null } | undefined)
      ?.thumbnail_url ||
    (images[0] as { url?: string | null } | undefined)?.url ||
    null
  const primaryImageUrl = primaryImageRaw ? proxiedListingImageSrc(primaryImageRaw) : null

  const shippingFlatRate = Math.max(0, Number.parseFloat(String(surfpack.shipping_price ?? 0)) || 0)

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
        }
      : undefined

  let buyerAgreedPriceUsd: number | null = null
  if (acceptedOffer && acceptedOffer.seller_id === surfpack.user_id) {
    const n = Math.round(parseFloat(String(acceptedOffer.current_amount)) * 100) / 100
    if (Number.isFinite(n) && n > 0) buyerAgreedPriceUsd = n
  }

  const listingLocationLine =
    surfpack.city && surfpack.state
      ? `${surfpack.city}, ${surfpack.state}`
      : (surfpack.profiles as { location?: string | null } | null)?.location?.trim() || null

  const boardShippingCostMode =
    (surfpack.board_shipping_cost_mode as "reswell" | "flat" | "free" | null) ?? null

  const fulfillmentLabels = boardFulfillmentDetailLabels(
    surfpack.local_pickup,
    surfpack.shipping_available,
    surfpack.shipping_price,
    boardShippingCostMode,
  )
  const specSubline = fulfillmentLabels.length > 0 ? fulfillmentLabels.join(" · ") : null

  const conditionWords = formatCondition(surfpack.condition as string | null)

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

  const mobileProductMetaItems = [
    conditionWords ? `Used – ${conditionWords}` : null,
  ].filter(Boolean) as string[]

  const listingViews = Number((surfpack.views as number | null) ?? 0)
  let listedRelative: string | null = null
  if (surfpack.created_at != null) {
    const d = new Date(surfpack.created_at as string | number | Date)
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
      profiles={surfpack.profiles as AboutSellerProfilesProp}
      listingImageFallbacks={[{ listing_images: surfpack.listing_images }]}
      sellerProfileHref={sellerProfileHref(surfpack.profiles)}
      messageHrefAuthenticated={`/messages/new?user=${surfpack.user_id}&listing=${surfpack.id}`}
      messageHrefLoginRedirect={`/auth/login?redirect=${encodeURIComponent(surfpackHref)}`}
      isLoggedIn={!!user}
      isOwnListing={isOwnListing}
      isSold={isSold}
      avgRating={sellerAvgRating}
      reviewCount={sellerReviewCount}
      itemsSold={Number((surfpack.profiles as { sales_count?: number } | null)?.sales_count ?? 0)}
      previewReviews={sellerReviewPreviews}
      showTrustRibbon={false}
    />
  )

  return (
    <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-5 sm:pb-24 sm:pt-8">
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
                  <Link href="/surfpacks">Surfpacks</Link>
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

        <div className="mx-auto grid w-full min-w-0 max-w-full gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:grid-rows-[auto_auto_auto] lg:[grid-template-areas:'gallery_details'_'about_details'_'similar_similar'] lg:items-start lg:gap-x-12 lg:gap-y-0 xl:gap-x-16">
          {/* Images */}
          <div className="min-w-0 max-lg:order-1 lg:[grid-area:gallery] lg:order-none lg:w-full lg:max-w-[29rem] lg:justify-self-start xl:max-w-[32rem]">
            {!(isSold && isOwnListing) && (
              <ListingPhotosPendingBanner imageCount={images.length} isOwner={isOwnListing} />
            )}
            <div className="relative isolate">
              <ImageGallery
                images={images}
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
                          listingId={surfpack.id}
                          redirectPath={surfpackHref}
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
              {listingTitle}
            </h1>
          </div>

          {/* Mobile price/actions block */}
          <div className="min-w-0 max-w-full max-lg:order-2 lg:hidden">
            {isSold ? (
              <p className="mt-2 font-headline text-3xl font-semibold tracking-tight text-[#163060] tabular-nums">
                Sold for ${publicListPriceUsd.toFixed(2)}
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums sm:text-4xl">
                  ${listPriceNum.toFixed(2)}
                </p>
                {buyerAgreedPriceUsd != null ? (
                  <p className="mt-1.5 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
                    Your accepted price: ${buyerAgreedPriceUsd.toFixed(2)} at checkout
                  </p>
                ) : null}
              </div>
            )}
            {mobileProductMetaItems.length > 0 ? (
              <div className="mt-3 space-y-2 border-y border-border/50 py-2.5 text-[14px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground">
                  {mobileProductMetaItems.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {!isSold && !isOwnListing && surfpack.status === "active" ? (
              <p className="mt-3 flex items-center gap-1.5 text-[14px] text-foreground">
                <Hourglass className="h-[14px] w-[14px] shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium">Only one available</span>
              </p>
            ) : null}
            {canPeerPurchase ? (
              <div className="mt-5">
                <ListingDetailPeerPurchaseActions
                  listingId={surfpack.id}
                  checkoutListingParam={surfpack.slug ?? surfpack.id}
                  section="surfpacks"
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
                      ${listPriceNum.toFixed(2)}
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
              {!isSold && !isOwnListing && surfpack.status === "active" ? (
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
                  <ListingDetailPeerPurchaseActions
                    listingId={surfpack.id}
                    checkoutListingParam={surfpack.slug ?? surfpack.id}
                    section="surfpacks"
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
                  href={`/contact?topic=listing-report&listing=${encodeURIComponent(surfpack.id)}`}
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
                />
              </div>
            )}

            {isOwnListing && !isSold ? (
              <ListingOwnerManageActions
                listingId={surfpack.id}
                section="surfpacks"
                currentPriceUsd={listPriceNum}
                listingStatus={String(surfpack.status ?? "")}
                hiddenFromSite={surfpack.hidden_from_site === true}
              />
            ) : null}
          </div>

          <div className="col-span-full mt-8 min-w-0 max-w-full border-t border-neutral-200/90 pt-6 dark:border-neutral-700/70 max-lg:order-3 lg:col-span-1 lg:[grid-area:about] lg:order-none lg:mt-0 lg:border-t lg:border-neutral-200/90 lg:pt-5 dark:lg:border-neutral-700/70 xl:pt-6">
            <Accordion type="multiple" defaultValue={["about", "specs", "shipping"]} className="w-full">
              <AccordionItem value="about" className="border-border/55">
                <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:text-foreground">
                  About this listing
                </AccordionTrigger>
                <AccordionContent className="pb-6 pt-0">
                  <div className="text-[16px] leading-[1.65] text-foreground">
                    <TranslateableDescription
                      text={(surfpack.description as string) || ""}
                      className="text-foreground"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {specRows.length > 0 ? (
                <AccordionItem value="specs" className="border-border/55">
                  <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                    Surfpack specs
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

              <AccordionItem value="shipping" className="border-border/55">
                <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
                  Shipping &amp; pickup
                </AccordionTrigger>
                <AccordionContent className="pb-6 pt-0">
                  <div className="space-y-3 text-[16px] leading-[1.65] text-foreground">
                    <p className="font-medium">{listingLocationLine ?? "Location not specified"}</p>
                    <p>
                      {pickupOffered && shippingOffered &&
                        "Pickup near this area, or the seller can ship to you at checkout."}
                      {pickupOffered && !shippingOffered &&
                        "Local pickup only — meet the seller near this area to inspect the surfpack."}
                      {!pickupOffered && shippingOffered &&
                        "Shipped to you after checkout. Confirm your address with the seller in messages."}
                    </p>
                    {shippingOffered ? (
                      <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          {boardShippingCostMode === "free"
                            ? "Free shipping"
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
                      listingId={surfpack.id}
                      listingSlug={surfpack.slug}
                      sellerId={surfpack.user_id}
                      listingTitle={listingTitle}
                      isLoggedIn={!!user}
                      section="surfpacks"
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

        {sellerSurfpacks && sellerSurfpacks.length > 0 && (
          <section className="mt-16 min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
            <h2 className="mb-8 text-2xl font-bold text-foreground">More surfpacks from this seller</h2>
            <HomeListingScrollRow uniformCardHeights>
              {sellerSurfpacks.map((item) => (
                <HomePeerListingScrollTile
                  key={item.id}
                  listing={item}
                  userId={user?.id ?? null}
                  isFavorited={sellerSurfpackFavoritedIds.includes(item.id)}
                />
              ))}
            </HomeListingScrollRow>
          </section>
        )}
      </div>
    </main>
  )
}
