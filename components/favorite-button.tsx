"use client"

import { useState } from "react"

import { toggleFavoriteListing } from "@/app/actions/favorites"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Heart } from "lucide-react"
import { toast } from "sonner"

interface FavoriteButtonProps {
  listingId: string
  /** Redirect path when not logged in (e.g. /l/my-board-slug) */
  redirectPath?: string
  initialFavorited: boolean
  isLoggedIn: boolean
  onFavoritedChange?: (favorited: boolean) => void
  /** Override or extend wrapper styling. Defaults to a borderless ghost-icon button. */
  className?: string
  /** Override the heart icon classes (handy when sizing for an outlined CTA-row button). */
  iconClassName?: string
  /** Render as an outlined icon button matching the CTA row instead of the borderless default. */
  variant?: "ghost" | "outline"
}

export function FavoriteButton({
  listingId,
  redirectPath,
  initialFavorited,
  isLoggedIn,
  onFavoritedChange,
  className,
  iconClassName,
  variant = "ghost",
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)
  const openSignIn = useSignInGate()

  async function toggleFavorite() {
    if (!isLoggedIn) {
      openSignIn(redirectPath ?? `/l/${listingId}`)
      return
    }

    setLoading(true)

    try {
      const result = await toggleFavoriteListing(listingId)
      if ("error" in result) {
        if (result.error === "Unauthorized") {
          openSignIn(redirectPath ?? `/l/${listingId}`)
          return
        }
        toast.error("Failed to update favorites")
        return
      }
      setFavorited(result.favorited)
      onFavoritedChange?.(result.favorited)
    } catch {
      toast.error("Failed to update favorites")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      onClick={() => void toggleFavorite()}
      disabled={loading}
      aria-label="Favorites button"
      aria-pressed={favorited}
      className={cn(
        "transition-colors",
        variant === "ghost" && "border-0 shadow-none",
        favorited && "text-red-500 hover:text-red-600",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-current", iconClassName)} />
    </Button>
  )
}
