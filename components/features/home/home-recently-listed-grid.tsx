import {
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home/home-peer-listing-scroll-tile"
import { HOME_RECENTLY_LISTED_GRID_DESKTOP_TILE_COUNT } from "@/lib/db/home-recently-listed-grid"
import { cn } from "@/lib/utils"

const HOME_RECENTLY_LISTED_GRID_IMAGE_SIZES =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 20vw"

export const homeRecentlyListedGridClassName = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"

/** Recently listed surfboards + fins — 16 tiles on mobile, 15 on desktop (5×3). */
export function HomeRecentlyListedGrid({
  listings,
  userId,
  favoritedIds,
  gridClassName = homeRecentlyListedGridClassName,
  imageSizes = HOME_RECENTLY_LISTED_GRID_IMAGE_SIZES,
  hideExtraDesktopTiles = true,
}: {
  listings: HomePeerScrollListing[]
  userId: string | null
  favoritedIds: string[]
  gridClassName?: string
  imageSizes?: string
  /** When true, hides tile 16+ on `lg` (homepage mobile/desktop split). */
  hideExtraDesktopTiles?: boolean
}) {
  if (listings.length === 0) return null

  return (
    <div className={gridClassName}>
      {listings.map((listing, tileIdx) => (
        <div
          key={listing.id}
          className={cn(
            hideExtraDesktopTiles &&
              tileIdx >= HOME_RECENTLY_LISTED_GRID_DESKTOP_TILE_COUNT &&
              "lg:hidden",
          )}
        >
          <HomePeerListingScrollTile
            layout="grid"
            listing={listing}
            userId={userId}
            isFavorited={favoritedIds.includes(listing.id)}
            imagePriority={tileIdx < 5}
            imageSizesOverride={imageSizes}
          />
        </div>
      ))}
    </div>
  )
}
