"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toggleFavoriteListing } from "@/app/actions/favorites"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  listingId: string
  /** Redirect path when not logged in (e.g. /l/my-board-slug) */
  redirectPath?: string
  initialFavorited: boolean
  isLoggedIn: boolean
  onFavoritedChange?: (favorited: boolean) => void
}

export function FavoriteButton({
  listingId,
  redirectPath,
  initialFavorited,
  isLoggedIn,
  onFavoritedChange,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggleFavorite() {
    if (!isLoggedIn) {
      toast.error("Please sign in to save favorites")
      router.push(`/auth/login?redirect=${redirectPath || `/l/${listingId}`}`)
      return
    }

    setLoading(true)

    try {
      const result = await toggleFavoriteListing(listingId)
      if ("error" in result) {
        toast.error(
          result.error === "Unauthorized"
            ? "Please sign in to save favorites"
            : "Failed to update favorites",
        )
        if (result.error === "Unauthorized") {
          router.push(`/auth/login?redirect=${redirectPath || `/l/${listingId}`}`)
        }
        return
      }
      setFavorited(result.favorited)
      onFavoritedChange?.(result.favorited)
      toast.success(
        result.favorited ? "Added to favorites" : "Removed from favorites",
      )
    } catch {
      toast.error("Failed to update favorites")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleFavorite}
      disabled={loading}
      className={cn(
        "transition-colors border-0 shadow-none",
        favorited && "text-red-500 hover:text-red-600"
      )}
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
      <span className="sr-only">
        {favorited ? "Remove from favorites" : "Add to favorites"}
      </span>
    </Button>
  )
}
