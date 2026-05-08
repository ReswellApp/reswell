"use client"

import { FavoriteButton } from "@/components/favorite-button"

interface FavoriteButtonCardOverlayProps {
  listingId: string
  initialFavorited: boolean
  isLoggedIn: boolean
  onFavoritedChange?: (favorited: boolean) => void
}

/** Listing-card favorite control: same `h-8 w-8` footprint as carousel arrows; stops click from navigating to listing. */
export function FavoriteButtonCardOverlay({
  listingId,
  initialFavorited,
  isLoggedIn,
  onFavoritedChange,
}: FavoriteButtonCardOverlayProps) {
  const listingCardFavoriteButtonClassName =
    "h-8 w-8 min-h-8 min-w-8"


  return (
    <div
      className="group/favorite pointer-events-auto absolute right-2 bottom-2 z-[25] flex h-8 w-8 shrink-0 items-center justify-center"
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
      />
    </div>
  )
}
