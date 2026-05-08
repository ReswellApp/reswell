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
      className="group/favorite pointer-events-auto absolute right-2 top-2 z-[25] flex h-14 w-14 shrink-0 items-start justify-end"
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
