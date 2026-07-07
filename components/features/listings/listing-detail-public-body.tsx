import { SurfboardListingDetailPage } from "@/components/surfboard-listing-detail-page"
import { FinsListingDetailPage } from "@/components/fins-listing-detail-page"
import { WetsuitsListingDetailPage } from "@/components/wetsuits-listing-detail-page"
import { BoardbagsListingDetailPage } from "@/components/boardbags-listing-detail-page"
import { SurfpacksListingDetailPage } from "@/components/surfpacks-listing-detail-page"
import { LeashesListingDetailPage } from "@/components/leashes-listing-detail-page"
import { ApparelListingDetailPage } from "@/components/apparel-listing-detail-page"
import { AccessoriesListingDetailPage } from "@/components/accessories-listing-detail-page"
import { MagazinesListingDetailPage } from "@/components/magazines-listing-detail-page"
import { ShopListingDetailPage } from "@/components/shop-listing-detail-page"
import { ListingViewTracker } from "@/components/features/listings/listing-view-tracker"
import { ListingPdpProductJsonLd } from "@/components/features/listings/listing-pdp-product-json-ld"
import { isGoogleMerchantPeerSection } from "@/lib/google-merchant/config"
import type { GoogleMerchantListingRow } from "@/lib/google-merchant/map-listing-to-product-input"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

type PublicListingRow = Record<string, unknown> & {
  id: string
  section: string
}

export type { PublicListingRow }

export function ListingDetailPublicBody({
  listing,
  listingParam,
  sectionProps,
}: {
  listing: PublicListingRow
  listingParam: string
  sectionProps: ListingDetailPageSharedProps
}) {
  const cachedPublicProps: ListingDetailPageSharedProps = {
    ...sectionProps,
    prefetchedListing: listing.section === "new" ? undefined : listing,
    anonymousPublicView: sectionProps.anonymousPublicView ?? false,
  }

  return (
    <>
      {isGoogleMerchantPeerSection(listing.section) ? (
        <ListingPdpProductJsonLd listing={listing as GoogleMerchantListingRow} />
      ) : null}
      <ListingViewTracker listingId={listing.id} />
      {(() => {
        switch (listing.section) {
          case "surfboards":
            return <SurfboardListingDetailPage {...cachedPublicProps} />
          case "fins":
            return <FinsListingDetailPage {...cachedPublicProps} />
          case "wetsuits":
            return <WetsuitsListingDetailPage {...cachedPublicProps} />
          case "boardbags":
            return <BoardbagsListingDetailPage {...cachedPublicProps} />
          case "surfpacks":
            return <SurfpacksListingDetailPage {...cachedPublicProps} />
          case "leashes":
            return <LeashesListingDetailPage {...cachedPublicProps} />
          case "apparel":
            return <ApparelListingDetailPage {...cachedPublicProps} />
          case "accessories":
            return <AccessoriesListingDetailPage {...cachedPublicProps} />
          case "magazines":
            return <MagazinesListingDetailPage {...cachedPublicProps} />
          case "new":
            return <ShopListingDetailPage listingParam={listingParam} prefetchedListing={listing} />
          default:
            return null
        }
      })()}
    </>
  )
}
