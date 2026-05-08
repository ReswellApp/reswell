"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
  /** Refetch server components after a successful toggle (e.g. PDP watchers count). */
  refreshAfterToggle?: boolean
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
  refreshAfterToggle = false,
}: FavoriteButtonProps) {
  const router = useRouter()
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
      if (refreshAfterToggle) {
        router.refresh()
      }
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
        "transition-[background-color,color,opacity] duration-200 ease-in-out",
        variant === "ghost" &&
          "relative h-11 w-11 min-h-[44px] min-w-[44px] rounded-full border border-transparent bg-transparent text-neutral-800 shadow-none hover:border-white/80 hover:bg-white/75 hover:text-neutral-950 hover:shadow-[0_2px_12px_rgba(0,0,0,0.1)] hover:backdrop-blur-md group-hover/favorite:border-white/80 group-hover/favorite:bg-white/75 group-hover/favorite:text-neutral-950 group-hover/favorite:shadow-[0_2px_12px_rgba(0,0,0,0.1)] group-hover/favorite:backdrop-blur-md focus-visible:border-white/80 focus-visible:bg-white/75 focus-visible:text-neutral-950 focus-visible:shadow-[0_2px_12px_rgba(0,0,0,0.1)] focus-visible:backdrop-blur-md dark:text-neutral-100 dark:hover:border-white/70 dark:hover:bg-white/75 dark:hover:text-neutral-900 dark:group-hover/favorite:border-white/70 dark:group-hover/favorite:bg-white/75 dark:group-hover/favorite:text-neutral-900 dark:focus-visible:border-white/70 dark:focus-visible:bg-white/75 dark:focus-visible:text-neutral-900 [&_svg]:pointer-events-auto",
        favorited &&
          "text-red-500 hover:text-red-600 group-hover/favorite:text-red-600 dark:text-red-500 dark:hover:text-red-600 dark:group-hover/favorite:text-red-600",
        className,
      )}
    >
      {variant === "ghost" ? (
        <>
          {/* Hit target for full circular control: SVG is pointer-events-none and the heart outline leaves a transparent hole, so events must hit this layer instead of the listing beneath. */}
          <span className="absolute inset-0 z-0 rounded-full" aria-hidden />
          <Heart className={cn("relative z-10 h-4 w-4", favorited && "fill-current", iconClassName)} />
        </>
      ) : (
        <Heart className={cn("h-4 w-4", favorited && "fill-current", iconClassName)} />
      )}
    </Button>
  )
}
