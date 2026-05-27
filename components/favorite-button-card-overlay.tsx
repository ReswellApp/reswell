"use client"

import { FavoriteButton } from "@/components/favorite-button"
import { cn } from "@/lib/utils"

/** White circular chrome behind listing-tile hearts (size applied separately). */
export const listingTileFavoriteButtonChromeClassName =
  "rounded-full border border-neutral-200/90 bg-white/90 shadow-sm backdrop-blur-none hover:bg-white/90 hover:border-neutral-200/90 hover:shadow-sm hover:backdrop-blur-none group-hover/favorite:bg-white/90 group-hover/favorite:border-neutral-200/90 group-hover/favorite:shadow-sm group-hover/favorite:backdrop-blur-none focus-visible:bg-white/90 focus-visible:border-neutral-200/90 focus-visible:shadow-sm focus-visible:backdrop-blur-none dark:bg-white/90 dark:hover:bg-white/90 dark:group-hover/favorite:bg-white/90 dark:focus-visible:bg-white/90"

interface FavoriteButtonCardOverlayProps {
  listingId: string
  initialFavorited: boolean
  isLoggedIn: boolean
  onFavoritedChange?: (favorited: boolean) => void
}

/** Listing-card favorite control: top-right over the photo; same `h-8 w-8` footprint as carousel arrows; stops click from navigating to listing. */
export function FavoriteButtonCardOverlay({
  listingId,
  initialFavorited,
  isLoggedIn,
  onFavoritedChange,
}: FavoriteButtonCardOverlayProps) {
  /** Slightly translucent white pill behind the heart; hover matches default (no blur ramp). */
  const listingCardFavoriteButtonClassName = cn(
    "h-8 w-8 min-h-8 min-w-8",
    listingTileFavoriteButtonChromeClassName,
  )

  return (
    <div
      className="group/favorite pointer-events-auto absolute right-2 top-2 z-[25] flex h-8 w-8 shrink-0 items-center justify-center"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <FavoriteButton
        listingId={listingId}
        initialFavorited={initialFavorited}
        isLoggedIn={isLoggedIn}
        onFavoritedChange={onFavoritedChange}
        className={listingCardFavoriteButtonClassName}
        heartAccent="listingTile"
      />
    </div>
  )
}
