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
  initialFavorited: boolean
  isLoggedIn: boolean
}

export function FavoriteButton({
  listingId,
  initialFavorited,
  isLoggedIn,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function toggleFavorite() {
    if (!isLoggedIn) {
      toast.error("Please sign in to save favorites")
      router.push(`/auth/login?redirect=/used/${listingId}`)
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
      variant="outline"
      size="icon"
      onClick={toggleFavorite}
      disabled={loading}
      className={cn(
        "transition-colors",
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
