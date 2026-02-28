"use client"

import { FavoriteButton } from "@/components/favorite-button"

interface FavoriteButtonCardOverlayProps {
  listingId: string
  initialFavorited: boolean
  isLoggedIn: boolean
  onFavoritedChange?: (favorited: boolean) => void
}

/** Wrapper for using FavoriteButton on listing cards; stops click from navigating to listing. */
export function FavoriteButtonCardOverlay({
  listingId,
  initialFavorited,
  isLoggedIn,
  onFavoritedChange,
}: FavoriteButtonCardOverlayProps) {
  return (
    <div
      className="absolute right-2 top-2 z-10"
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
      />
    </div>
  )
}
