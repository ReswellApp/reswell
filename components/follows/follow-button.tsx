"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FollowButtonProps {
  sellerId: string
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
}

export function FollowButton({
  sellerId,
  sellerName,
  sellerCity,
  initialFollowing,
  initialFollowerCount = 0,
  isLoggedIn,
  isOwnProfile = false,
  showCount = false,
  size = "default",
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [loading, setLoading] = useState(false)
  const [hovering, setHovering] = useState(false)
  const router = useRouter()

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
      toast.error(
        sellerName
          ? `Sign in to follow ${sellerName} and get notified of new listings`
          : "Sign in to follow this seller and get notified of new listings",
        {
          action: {
            label: "Sign in",
            onClick: () => router.push(`/auth/login?redirect=/sellers/${sellerId}`),
          },
        }
      )
      return
    }

    // Optimistic UI — toggle immediately, revert on error
    const wasFollowing = following
    setFollowing(!wasFollowing)
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1))
    setLoading(true)

    try {
      const res = await fetch("/api/follows", {
        method: wasFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Request failed")
      }

      const data = await res.json()
      // Sync with server's authoritative count
      setFollowerCount(data.followerCount)

      if (wasFollowing) {
        toast.success(`Unfollowed ${sellerName || "seller"}`)
      } else {
        toast.success(
          sellerName
            ? `Following ${sellerName}! You'll be notified of new listings.`
            : "Following! You'll be notified of new listings."
        )
      }
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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={following ? "default" : "outline"}
        size={size}
        onClick={handleClick}
        disabled={loading}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={cn(
          "min-w-[120px] transition-all duration-150",
          following && !hovering && "bg-foreground text-background hover:bg-foreground/90",
          following && hovering && "bg-destructive hover:bg-destructive/90 border-destructive text-destructive-foreground"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            {following ? "Unfollowing…" : "Following…"}
          </>
        ) : following ? (
          hovering ? (
            <>
              <UserMinus className="mr-1.5 h-4 w-4" />
              Unfollow
            </>
          ) : (
            <>
              <UserCheck className="mr-1.5 h-4 w-4" />
              Following
            </>
          )
        ) : (
          <>
            <UserPlus className="mr-1.5 h-4 w-4" />
            {baseLabel}
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
