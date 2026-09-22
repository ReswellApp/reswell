import { Suspense } from "react"
import { ListingRelatedContentSection } from "@/components/features/listings/listing-related-content-section"
import { ListingDetailAdminBarGate } from "@/components/features/listings/listing-detail-admin-bar-gate"
import { ListingViewTracker } from "@/components/features/listings/listing-view-tracker"
import { ListingPdpProductJsonLd } from "@/components/features/listings/listing-pdp-product-json-ld"
import { isGoogleMerchantPeerSection } from "@/lib/google-merchant/config"
import type { GoogleMerchantListingRow } from "@/lib/google-merchant/map-listing-to-product-input"
import { asListingImageArray } from "@/lib/listing-image-display"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

type PublicListingRow = Record<string, unknown> & {
  id: string
  section: string
}

export type { PublicListingRow }

const EMBEDDED_RELATED_CONTENT_SECTIONS = new Set([
  "surfboards",
  "fins",
  "traction",
  "wetsuits",
  "apparel",
  "magazines",
  "boardbags",
  "leashes",
  "surfpacks",
])

function normalizePublicListingRow(listing: PublicListingRow): PublicListingRow {
  return {
    ...listing,
    listing_images: asListingImageArray(listing.listing_images),
    listing_videos: Array.isArray(listing.listing_videos) ? listing.listing_videos : [],
  }
}

/**
 * Section PDPs are async Server Components. `import()` per `listing.section` keeps
 * unused section trees (and their client islands) out of this route's graph.
 * `next/dynamic` is for Client Components and would wrap these in the wrong boundary.
 */
async function renderListingSectionPage(
  listing: PublicListingRow,
  listingParam: string,
  cachedPublicProps: ListingDetailPageSharedProps,
) {
  switch (listing.section) {
    case "surfboards": {
      const { SurfboardListingDetailPage } = await import(
        "@/components/surfboard-listing-detail-page"
      )
      return <SurfboardListingDetailPage {...cachedPublicProps} />
    }
    case "fins": {
      const { FinsListingDetailPage } = await import("@/components/fins-listing-detail-page")
      return <FinsListingDetailPage {...cachedPublicProps} />
    }
    case "wetsuits": {
      const { WetsuitsListingDetailPage } = await import(
        "@/components/wetsuits-listing-detail-page"
      )
      return <WetsuitsListingDetailPage {...cachedPublicProps} />
    }
    case "boardbags": {
      const { BoardbagsListingDetailPage } = await import(
        "@/components/boardbags-listing-detail-page"
      )
      return <BoardbagsListingDetailPage {...cachedPublicProps} />
    }
    case "surfpacks": {
      const { SurfpacksListingDetailPage } = await import(
        "@/components/surfpacks-listing-detail-page"
      )
      return <SurfpacksListingDetailPage {...cachedPublicProps} />
    }
    case "leashes": {
      const { LeashesListingDetailPage } = await import(
        "@/components/leashes-listing-detail-page"
      )
      return <LeashesListingDetailPage {...cachedPublicProps} />
    }
    case "apparel": {
      const { ApparelListingDetailPage } = await import(
        "@/components/apparel-listing-detail-page"
      )
      return <ApparelListingDetailPage {...cachedPublicProps} />
    }
    case "accessories": {
      const { AccessoriesListingDetailPage } = await import(
        "@/components/accessories-listing-detail-page"
      )
      return <AccessoriesListingDetailPage {...cachedPublicProps} />
    }
    case "magazines": {
      const { MagazinesListingDetailPage } = await import(
        "@/components/magazines-listing-detail-page"
      )
      return <MagazinesListingDetailPage {...cachedPublicProps} />
    }
    case "traction": {
      const { TractionListingDetailPage } = await import(
        "@/components/traction-listing-detail-page"
      )
      return <TractionListingDetailPage {...cachedPublicProps} />
    }
    case "new": {
      const { ShopListingDetailPage } = await import("@/components/shop-listing-detail-page")
      return <ShopListingDetailPage listingParam={listingParam} prefetchedListing={listing} />
    }
    default:
      return null
  }
}

export async function ListingDetailPublicBody({
  listing: listingRaw,
  listingParam,
  sectionProps,
}: {
  listing: PublicListingRow
  listingParam: string
  sectionProps: ListingDetailPageSharedProps
}) {
  const listing = normalizePublicListingRow(listingRaw)
  const cachedPublicProps: ListingDetailPageSharedProps = {
    ...sectionProps,
    prefetchedListing: listing.section === "new" ? undefined : listing,
    anonymousPublicView: sectionProps.anonymousPublicView ?? false,
  }

  const sectionPage = await renderListingSectionPage(listing, listingParam, cachedPublicProps)

  return (
    <>
      {isGoogleMerchantPeerSection(listing.section) ? (
        <ListingPdpProductJsonLd listing={listing as GoogleMerchantListingRow} />
      ) : null}
      <ListingViewTracker listingId={listing.id} />
      {sectionProps.anonymousPublicView === true ? null : (
        <Suspense fallback={null}>
          <ListingDetailAdminBarGate listing={listing} anonymousPublicView={false} />
        </Suspense>
      )}
      {sectionPage}
      {EMBEDDED_RELATED_CONTENT_SECTIONS.has(listing.section) ? null : (
        <Suspense fallback={null}>
          <ListingRelatedContentSection listingId={listing.id} />
        </Suspense>
      )}
    </>
  )
}
