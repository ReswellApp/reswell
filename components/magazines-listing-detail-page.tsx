import { notFound } from "next/navigation"
import Link from "next/link"
import { Hourglass } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ImageGallery } from "@/components/image-gallery"
import { FavoriteButton } from "@/components/favorite-button"
import { ShareButton } from "@/components/share-button"
import { TranslateableDescription } from "@/components/translateable-description"
import { ListingDetailPeerPurchaseActions } from "@/components/listing-detail-peer-purchase-actions"
import { ListingOwnerManageActions } from "@/components/features/listings/listing-owner-manage-actions"
import { ListingSoldDetailNotice } from "@/components/listing-sold-detail-notice"
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { listingTileFavoriteButtonChromeClassName } from "@/components/favorite-button-card-overlay"
import { capitalizeWords, formatCondition } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { loadListingDetailPageContext } from "@/lib/listing-detail-page-load"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"
import { MAGAZINES_SECTION } from "@/lib/magazine-listing-config"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"
import { cn } from "@/lib/utils"

type GalleryImage = {
  id: string
  url: string
  is_primary: boolean
  thumbnail_url?: string | null
  sort_order?: number | null
}

export async function MagazinesListingDetailPage({
  listingParam,
  prefetchedListing,
  viewerUser,
}: ListingDetailPageSharedProps) {
  const { supabase, user, listing: magazineRaw } = await loadListingDetailPageContext({
    listingParam,
    prefetchedListing,
    viewerUser,
    section: MAGAZINES_SECTION,
  })
  const magazine = magazineRaw as Record<string, unknown> | null

  if (!magazine) {
    notFound()
  }

  const isSold = magazine.status === "sold"
  const isOwnListing = user?.id === magazine.user_id
  const magazineHref = listingDetailHref({
    id: magazine.id as string,
    slug: magazine.slug as string | null,
  })
  const listingTitle = capitalizeWords(magazine.title as string)
  const listPriceNum =
    typeof magazine.price === "number"
      ? magazine.price
      : Number.parseFloat(String(magazine.price)) || 0
  const publicListPriceUsd = publicListingListPriceUsd(
    magazine.price as string | number | null | undefined,
  )
  const conditionWords = formatCondition(magazine.condition as string | null)
  const brandLabel = (magazine.brand as string | null)?.trim() || null
  const year =
    magazine.magazine_year != null && Number.isFinite(Number(magazine.magazine_year))
      ? String(magazine.magazine_year)
      : null

  const images: GalleryImage[] =
    (magazine.listing_images as GalleryImage[] | null)
      ?.slice()
      .sort(
        (a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ) || []

  let isFavorited = false
  if (user) {
    const { data: fav } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .eq("listing_id", magazine.id as string)
      .maybeSingle()
    isFavorited = Boolean(fav)
  }

  const canPeerPurchase =
    !isOwnListing &&
    !isSold &&
    (magazine.status === "active" || magazine.status === "pending_sale") &&
    magazine.shipping_available === true

  const specRows = [
    brandLabel ? { label: "Brand", value: brandLabel } : null,
    year ? { label: "Year", value: year } : null,
    conditionWords ? { label: "Condition", value: conditionWords } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-5 sm:pb-24 sm:pt-8">
      <div className="container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6 lg:px-8 lg:!max-w-[min(100%,1320px)]">
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-[13px] font-normal text-muted-foreground sm:text-[14px]">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                  <Link href="/magazines">Magazines</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                  {listingTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {isSold ? (
          <div className="mb-6">
            <ListingSoldDetailNotice shipped={false} />
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
          <div className="min-w-0">
            {!(isSold && isOwnListing) ? (
              <ListingPhotosPendingBanner imageCount={images.length} isOwner={isOwnListing} />
            ) : null}
            <div className="relative isolate">
              <ImageGallery
                images={images}
                title={listingTitle}
                sold={isSold}
                compactMobile
                heroOverlay={
                  <>
                    <ShareButton
                      title={listingTitle}
                      className="size-11 rounded-full border border-border/55 bg-background/90 shadow-sm backdrop-blur-md hover:bg-muted/40"
                      iconClassName="h-[18px] w-[18px]"
                    />
                    {!isOwnListing ? (
                      <FavoriteButton
                        listingId={magazine.id as string}
                        redirectPath={magazineHref}
                        initialFavorited={isFavorited}
                        isLoggedIn={!!user}
                        refreshAfterToggle
                        heartAccent="listingTile"
                        className={cn(
                          "h-11 w-11 min-h-11 min-w-11",
                          listingTileFavoriteButtonChromeClassName,
                        )}
                      />
                    ) : null}
                  </>
                }
              />
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <div>
              <h1 className="text-balance text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
                {listingTitle}
              </h1>
              {isSold ? (
                <p className="mt-4 font-headline text-3xl font-semibold tracking-tight text-[#163060] tabular-nums">
                  Sold for ${publicListPriceUsd.toFixed(2)}
                </p>
              ) : (
                <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                  ${listPriceNum.toFixed(2)}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">Shipping only</p>
            </div>

            {specRows.length > 0 ? (
              <dl className="grid gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:grid-cols-2">
                {specRows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {!isSold && !isOwnListing && magazine.status === "active" ? (
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Hourglass className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium">Only one available</span>
              </p>
            ) : null}

            {canPeerPurchase ? (
              <ListingDetailPeerPurchaseActions
                listingId={magazine.id as string}
                checkoutListingParam={(magazine.slug as string | null) ?? (magazine.id as string)}
                section="magazines"
                isLoggedIn={!!user}
              />
            ) : null}

            {isOwnListing ? (
              <ListingOwnerManageActions
                listingId={magazine.id as string}
                section={MAGAZINES_SECTION}
                currentPriceUsd={listPriceNum}
                listingStatus={magazine.status as string}
              />
            ) : null}

            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <h2 className="text-sm font-semibold">Description</h2>
              <TranslateableDescription
                className="mt-3 text-sm leading-relaxed text-foreground/90"
                text={(magazine.description as string) ?? ""}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
