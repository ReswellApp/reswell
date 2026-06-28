import {
  homeMostViewedCompactTileWrapClass,
  homeMostViewedMosaicCellWrapClass,
  homeMostViewedMosaicDesktopGridClass,
  homeMostViewedMosaicMobileGridClass,
} from "@/lib/home-listing-scroll-styles"
import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import {
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home/home-peer-listing-scroll-tile"
import type { HomeMostViewedMosaicLayout } from "@/lib/services/homeMostViewedSection"
import { cn } from "@/lib/utils"

const HOME_MOST_VIEWED_COMPACT_IMAGE_SIZES = "(max-width: 639px) 38svw, 160px"

function MosaicListingTile({
  listing,
  userId,
  isFavorited,
  imagePriority = false,
}: {
  listing: HomePeerScrollListing
  userId: string | null
  isFavorited: boolean
  imagePriority?: boolean
}) {
  return (
    <div className={homeMostViewedMosaicCellWrapClass}>
      <HomePeerListingScrollTile
        listing={listing}
        userId={userId}
        isFavorited={isFavorited}
        compact
        imagePriority={imagePriority}
        imageSizesOverride={HOME_MOST_VIEWED_COMPACT_IMAGE_SIZES}
      />
    </div>
  )
}

/**
 * Compact most-viewed mosaic: uniform tiles in a 3×3 ring with the top-view listing centered,
 * plus a horizontal scroll row for additional listings.
 */
export function HomeMostViewedMosaic({
  layout,
  userId,
  favoritedIds,
}: {
  layout: HomeMostViewedMosaicLayout
  userId: string | null
  favoritedIds: string[]
}) {
  const { hero, satellites, scrollListings } = layout
  const [topLeft, topCenter, topRight, midLeft, midRight, bottomLeft] = satellites

  const isFavorited = (listing: HomePeerScrollListing) => favoritedIds.includes(listing.id)

  const mosaicListings = [hero, ...satellites]

  return (
    <div className="space-y-6">
      {/* Phone: uniform 2-column grid (no oversized hero). */}
      <div className={homeMostViewedMosaicMobileGridClass}>
        {mosaicListings.map((listing, idx) => (
          <MosaicListingTile
            key={listing.id}
            listing={listing}
            userId={userId}
            isFavorited={isFavorited(listing)}
            imagePriority={idx === 0}
          />
        ))}
      </div>

      {/* sm+: 3×3 — hero centered, same size as surrounding tiles. */}
      <div className={homeMostViewedMosaicDesktopGridClass}>
        {topLeft ? (
          <div className={cn(homeMostViewedMosaicCellWrapClass, "col-start-1 row-start-1")}>
            <MosaicListingTile
              listing={topLeft}
              userId={userId}
              isFavorited={isFavorited(topLeft)}
              imagePriority
            />
          </div>
        ) : null}
        {topCenter ? (
          <div className={cn(homeMostViewedMosaicCellWrapClass, "col-start-2 row-start-1")}>
            <MosaicListingTile listing={topCenter} userId={userId} isFavorited={isFavorited(topCenter)} />
          </div>
        ) : null}
        {topRight ? (
          <div className={cn(homeMostViewedMosaicCellWrapClass, "col-start-3 row-start-1")}>
            <MosaicListingTile listing={topRight} userId={userId} isFavorited={isFavorited(topRight)} />
          </div>
        ) : null}
        {midLeft ? (
          <div className={cn(homeMostViewedMosaicCellWrapClass, "col-start-1 row-start-2")}>
            <MosaicListingTile listing={midLeft} userId={userId} isFavorited={isFavorited(midLeft)} />
          </div>
        ) : null}
        <div className={cn(homeMostViewedMosaicCellWrapClass, "col-start-2 row-start-2")}>
          <MosaicListingTile
            listing={hero}
            userId={userId}
            isFavorited={isFavorited(hero)}
            imagePriority
          />
        </div>
        {midRight ? (
          <div className={cn(homeMostViewedMosaicCellWrapClass, "col-start-3 row-start-2")}>
            <MosaicListingTile listing={midRight} userId={userId} isFavorited={isFavorited(midRight)} />
          </div>
        ) : null}
        {bottomLeft ? (
          <div className={cn(homeMostViewedMosaicCellWrapClass, "col-start-1 row-start-3")}>
            <MosaicListingTile listing={bottomLeft} userId={userId} isFavorited={isFavorited(bottomLeft)} />
          </div>
        ) : null}
      </div>

      {scrollListings.length > 0 ? (
        <HomeListingScrollRow
          uniformCardHeights
          tileWrapClassName={homeMostViewedCompactTileWrapClass}
          rowGapClassName="gap-2"
        >
          {scrollListings.map((listing) => (
            <HomePeerListingScrollTile
              key={listing.id}
              listing={listing}
              userId={userId}
              isFavorited={isFavorited(listing)}
              compact
              imageSizesOverride={HOME_MOST_VIEWED_COMPACT_IMAGE_SIZES}
            />
          ))}
        </HomeListingScrollRow>
      ) : null}
    </div>
  )
}
