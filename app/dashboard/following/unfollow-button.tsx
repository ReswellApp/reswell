"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, UserMinus } from "lucide-react"
import { unfollowSeller } from "@/app/actions/follows"

interface UnfollowButtonProps {
  sellerId: string
  sellerName: string
  followId: string
}

export function UnfollowButton({ sellerId, sellerName, followId: _followId }: UnfollowButtonProps) {
  const [loading, setLoading] = useState(false)
  const [unfollowed, setUnfollowed] = useState(false)
  const router = useRouter()

  async function handleUnfollow() {
    setLoading(true)
    try {
      const res = await unfollowSeller(sellerId)
      if ("error" in res) throw new Error()
      setUnfollowed(true)
      toast.success(`Unfollowed ${sellerName}`)
      router.refresh()
    } catch {
      toast.error("Failed to unfollow")
    } finally {
      setLoading(false)
    }
  }

  if (unfollowed) {
    return (
      <span className="text-xs text-muted-foreground">Unfollowed</span>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleUnfollow}
      disabled={loading}
      className="text-destructive border-destructive/40 hover:bg-destructive/10"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <>
          <UserMinus className="mr-1.5 h-3.5 w-3.5" />
          Unfollow
        </>
      )}
    </Button>
  )
}
