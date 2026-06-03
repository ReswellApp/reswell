"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { toast } from "sonner"
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { sellerProfileHref } from "@/lib/seller-slug"
import { followSeller, unfollowSeller } from "@/app/actions/follows"

interface FollowButtonProps {
  sellerId: string
  /** Public profile path uses `seller_slug` when present. */
  sellerSlug?: string | null
  sellerName?: string
  /** Show seller's city on the button label: "[+ Follow — San Diego]" */
  sellerCity?: string
  initialFollowing: boolean
  initialFollowerCount?: number
  isLoggedIn: boolean
  /** On the seller's own profile: hide button, optionally show count only */
  isOwnProfile?: boolean
  /** Show "· N followers" alongside the button */
  showCount?: boolean
  size?: "sm" | "default"
  className?: string
  /** Stretch to match sibling outline buttons in a shared flex row (e.g. listing seller actions). */
  fillRow?: boolean
  /** Compact marketplace tile styling (e.g. `/sellers` directory cards). */
  appearance?: "default" | "directory" | "profileHero"
}

export function FollowButton({
  sellerId,
  sellerSlug,
  sellerName,
  sellerCity,
  initialFollowing,
  initialFollowerCount = 0,
  isLoggedIn,
  isOwnProfile = false,
  showCount = false,
  size = "default",
  className,
  fillRow = false,
  appearance = "default",
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [loading, setLoading] = useState(false)
  const [hovering, setHovering] = useState(false)
  const openSignIn = useSignInGate()

  // On own profile: show follower count only (no button)
  if (isOwnProfile) {
    return (
      <span className="text-sm text-muted-foreground">
        {followerCount.toLocaleString()} follower{followerCount !== 1 ? "s" : ""}
      </span>
    )
  }

  async function handleClick() {
    if (!isLoggedIn) {
      openSignIn(sellerProfileHref({ seller_slug: sellerSlug }))
      return
    }

    // Optimistic UI — toggle immediately, revert on error
    const wasFollowing = following
    setFollowing(!wasFollowing)
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1))
    setLoading(true)

    try {
      const data = wasFollowing
        ? await unfollowSeller(sellerId)
        : await followSeller(sellerId)

      if ("error" in data) {
        throw new Error(data.error ?? "Request failed")
      }

      setFollowerCount(data.followerCount)
    } catch (err: unknown) {
      // Revert optimistic update
      setFollowing(wasFollowing)
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1))
      const msg = err instanceof Error ? err.message : "Failed to update follow status"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const baseLabel = sellerCity ? `Follow — ${sellerCity}` : "Follow"
  const isDirectory = appearance === "directory"
  const isProfileHero = appearance === "profileHero"
  /** Matches seller profile banner ({@link SELLER_PROFILE_BANNER_DEFAULT}). */
  const unfollowHoverClasses =
    "border-[#5574AD] bg-[#5574AD] text-white hover:border-[#466091] hover:bg-[#466091] hover:text-white"

  return (
    <div className={cn("flex items-center gap-2", fillRow && "w-full min-w-0", className)}>
      <Button
        variant={isDirectory || isProfileHero ? "ghost" : following ? "default" : "outline"}
        size={size}
        onClick={handleClick}
        disabled={loading}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={cn(
          isDirectory
            ? "h-9 shrink-0 rounded-full px-5 text-sm font-bold shadow-none"
            : isProfileHero
              ? "h-9 shrink-0 rounded-full px-5 text-sm font-semibold shadow-none"
              : fillRow
                ? "min-h-touch w-full min-w-0 justify-center"
                : "min-w-[120px]",
          "transition-all duration-150",
          isDirectory &&
            !following &&
            "bg-muted text-listingHeart hover:bg-lightgray hover:text-listingHeart",
          isDirectory &&
            following &&
            !hovering &&
            "bg-lightgray text-primary hover:bg-lightgray",
          isDirectory &&
            following &&
            hovering &&
            unfollowHoverClasses,
          isProfileHero &&
            !following &&
            "bg-white text-listingHeart hover:bg-white/90",
          isProfileHero &&
            following &&
            !hovering &&
            "bg-white/90 text-listingHeart hover:bg-white",
          isProfileHero &&
            following &&
            hovering &&
            unfollowHoverClasses,
          !isDirectory &&
            !isProfileHero &&
            following &&
            !hovering &&
            "bg-foreground text-background hover:bg-foreground/90",
          !isDirectory &&
            !isProfileHero &&
            following &&
            hovering &&
            unfollowHoverClasses,
        )}
      >
        {loading ? (
          <>
            {!isDirectory && !isProfileHero ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {following ? "…" : isDirectory || isProfileHero ? "Follow" : "Following…"}
          </>
        ) : following ? (
          hovering ? (
            <>
              {!isDirectory && !isProfileHero ? <UserMinus className="mr-1.5 h-4 w-4" /> : null}
              Unfollow
            </>
          ) : (
            <>
              {!isDirectory && !isProfileHero ? <UserCheck className="mr-1.5 h-4 w-4" /> : null}
              Following
            </>
          )
        ) : (
          <>
            {!isDirectory && !isProfileHero ? <UserPlus className="mr-1.5 h-4 w-4" /> : null}
            {isDirectory || isProfileHero ? "Follow" : baseLabel}
          </>
        )}
      </Button>

      {showCount && (
        <span className="text-sm text-muted-foreground">
          · {followerCount.toLocaleString()} follower{followerCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  )
}
