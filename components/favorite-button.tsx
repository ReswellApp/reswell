"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
  const supabase = createClient()

  async function toggleFavorite() {
    if (!isLoggedIn) {
      toast.error("Please sign in to save favorites")
      router.push(`/auth/login?redirect=${redirectPath || `/l/${listingId}`}`)
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      if (favorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listingId)

        if (error) throw error
        setFavorited(false)
        onFavoritedChange?.(false)
        toast.success("Removed from favorites")
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            listing_id: listingId,
          })

        if (error) throw error
        setFavorited(true)
        onFavoritedChange?.(true)
        toast.success("Added to favorites")
      }
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
